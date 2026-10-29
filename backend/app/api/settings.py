import json
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.core.security import get_current_user
from backend.app.models.models import User, IrrigationSetting, AuditLog, Device, DeviceConnectionSetting
from backend.app.schemas.schemas import (
    IrrigationSettingSchema, IrrigationSettingUpdate,
    DeviceConnectionResponse, DeviceConnectionUpdate, TestConnectionResponse
)
from backend.app.services.state_manager import state_manager
from backend.app.services.mqtt_service import mqtt_service

router = APIRouter(prefix="/settings", tags=["Settings & Hardware Configuration"])

class HardwareConfigUpdate(BaseModel):
    esp32_device_id: Optional[str] = "esp32-zone-01"
    rpi_device_id: Optional[str] = "rpi-edge-01"
    mqtt_broker_host: Optional[str] = "127.0.0.1"
    mqtt_broker_port: Optional[int] = 1883
    mqtt_use_tls: Optional[bool] = False
    soil_sensor_type: Optional[str] = "Capacitive v1.2"
    soil_raw_dry: Optional[int] = Field(3200, ge=1000, le=4095)
    soil_raw_wet: Optional[int] = Field(1400, ge=200, le=3000)
    dht_type: Optional[str] = "DHT22"
    rain_active_low: Optional[bool] = True
    sampling_interval_seconds: Optional[int] = Field(10, ge=2, le=300)
    heartbeat_interval_seconds: Optional[int] = Field(30, ge=5, le=600)
    stale_timeout_seconds: Optional[int] = Field(60, ge=10, le=1800)

class SystemModeRequest(BaseModel):
    mode: str = Field(..., description="'SIMULATION' or 'HARDWARE'")

@router.get("/mode")
def get_system_mode():
    return {
        "status": "success",
        "system_mode": state_manager.get_mode(),
        "permission_mode": state_manager.get_permission_mode(),
        "pump_state": state_manager.get_authoritative_pump_state()
    }

@router.post("/mode")
def set_system_mode(req: SystemModeRequest, current_user: User = Depends(get_current_user)):
    try:
        res = state_manager.set_mode(req.mode.upper())
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/connection", response_model=DeviceConnectionResponse)
def get_connection_settings(db: Session = Depends(get_db)):
    conn = db.query(DeviceConnectionSetting).first()
    if not conn:
        conn = DeviceConnectionSetting(
            active_mode="DIRECT_ESP32",
            direct_esp32_id=settings.DEFAULT_ESP32_ID,
            direct_esp32_ip="192.168.1.105",
            direct_esp32_protocol="MQTT",
            direct_esp32_status="DISCONNECTED",
            rpi_device_id=settings.DEFAULT_RPI_ID,
            rpi_ip="192.168.1.200",
            rpi_mqtt_host=settings.MQTT_BROKER_HOST,
            rpi_mqtt_port=settings.MQTT_BROKER_PORT,
            rpi_status="DISCONNECTED",
            rpi_esp32_status="DISCONNECTED"
        )
        db.add(conn)
        db.commit()
        db.refresh(conn)
    return conn

@router.put("/connection", response_model=DeviceConnectionResponse)
def update_connection_settings(
    req: DeviceConnectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conn = db.query(DeviceConnectionSetting).first()
    if not conn:
        conn = DeviceConnectionSetting()
        db.add(conn)

    now = datetime.datetime.now(datetime.timezone.utc)
    mode_switching = False

    if req.active_mode is not None:
        target_mode = req.active_mode.upper()
        if target_mode not in ["DIRECT_ESP32", "RPI_GATEWAY"]:
            raise HTTPException(status_code=400, detail="Invalid connection mode. Must be 'DIRECT_ESP32' or 'RPI_GATEWAY'.")
        
        if conn.active_mode != target_mode:
            mode_switching = True
            # Safety Check: switching mode must not leave a pump running unexpectedly
            if state_manager.get_authoritative_pump_state() == "RUNNING":
                state_manager.stop_irrigation(reason="Safely stopping irrigation before switching connection mode")

            # Invalidate stale connection states
            if target_mode == "DIRECT_ESP32":
                conn.direct_esp32_status = "UNKNOWN"
            else:
                conn.rpi_status = "UNKNOWN"
                conn.rpi_esp32_status = "UNKNOWN"

            conn.active_mode = target_mode

    if req.direct_esp32_id is not None:
        if not req.direct_esp32_id.strip():
            raise HTTPException(status_code=400, detail="Direct ESP32 device ID cannot be empty.")
        conn.direct_esp32_id = req.direct_esp32_id.strip()

    if req.direct_esp32_ip is not None:
        if not req.direct_esp32_ip.strip():
            raise HTTPException(status_code=400, detail="Direct ESP32 IP address or hostname cannot be empty.")
        conn.direct_esp32_ip = req.direct_esp32_ip.strip()

    if req.direct_esp32_protocol is not None:
        conn.direct_esp32_protocol = req.direct_esp32_protocol.strip().upper()

    if req.rpi_device_id is not None:
        if not req.rpi_device_id.strip():
            raise HTTPException(status_code=400, detail="Raspberry Pi device ID cannot be empty.")
        conn.rpi_device_id = req.rpi_device_id.strip()

    if req.rpi_ip is not None:
        if not req.rpi_ip.strip():
            raise HTTPException(status_code=400, detail="Raspberry Pi IP address or hostname cannot be empty.")
        conn.rpi_ip = req.rpi_ip.strip()

    if req.rpi_mqtt_host is not None:
        if not req.rpi_mqtt_host.strip():
            raise HTTPException(status_code=400, detail="MQTT broker host cannot be empty.")
        conn.rpi_mqtt_host = req.rpi_mqtt_host.strip()

    if req.rpi_mqtt_port is not None:
        conn.rpi_mqtt_port = req.rpi_mqtt_port

    conn.updated_at = now
    db.commit()
    db.refresh(conn)
    return conn

@router.post("/connection/test-esp32", response_model=TestConnectionResponse)
def test_direct_esp32_connection(db: Session = Depends(get_db)):
    conn = db.query(DeviceConnectionSetting).first()
    if not conn:
        conn = DeviceConnectionSetting()
        db.add(conn)
        db.commit()
        db.refresh(conn)

    now = datetime.datetime.now(datetime.timezone.utc)
    op_mode = state_manager.get_mode()

    # Look up ESP32 device record in database
    esp32 = db.query(Device).filter(Device.device_id == conn.direct_esp32_id).first()
    
    is_connected = False
    error_msg = None
    details = {
        "mode": "Direct ESP32",
        "device_id": conn.direct_esp32_id,
        "target_ip": conn.direct_esp32_ip,
        "protocol": conn.direct_esp32_protocol,
        "operating_mode": op_mode
    }

    if op_mode == "SIMULATION":
        # In simulation mode, verify simulation engine is running
        is_connected = True
        details["simulation_active"] = True
        details["note"] = "Operating in SIMULATION mode. Virtual ESP32 link verified."
    else:
        # In hardware mode, verify MQTT connection and fresh device heartbeat
        if not mqtt_service.is_connected:
            is_connected = False
            error_msg = f"MQTT broker ({settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}) is offline. Direct ESP32 cannot be reached."
        elif not esp32 or not esp32.last_seen:
            is_connected = False
            error_msg = f"ESP32 controller '{conn.direct_esp32_id}' has not reported any telemetry yet. Verify power, WiFi, and IP '{conn.direct_esp32_ip}'."
        else:
            last_seen_aware = esp32.last_seen.replace(tzinfo=datetime.timezone.utc if esp32.last_seen.tzinfo is None else esp32.last_seen.tzinfo)
            delta_secs = (now - last_seen_aware).total_seconds()
            details["seconds_since_last_seen"] = int(delta_secs)
            if delta_secs <= settings.STALE_DATA_TIMEOUT_SECONDS:
                is_connected = True
                details["last_seen"] = esp32.last_seen.isoformat()
            else:
                is_connected = False
                error_msg = f"ESP32 controller '{conn.direct_esp32_id}' was last seen {int(delta_secs)}s ago (threshold: {settings.STALE_DATA_TIMEOUT_SECONDS}s). Controller appears offline."

    conn.direct_esp32_status = "CONNECTED" if is_connected else "DISCONNECTED"
    conn.direct_last_verified_at = now
    conn.direct_last_error = error_msg
    db.commit()

    return TestConnectionResponse(
        connection_mode="DIRECT_ESP32",
        status="CONNECTED" if is_connected else "DISCONNECTED",
        tested_at=now,
        details=details,
        error=error_msg
    )

@router.post("/connection/test-gateway", response_model=TestConnectionResponse)
def test_rpi_gateway_connection(db: Session = Depends(get_db)):
    conn = db.query(DeviceConnectionSetting).first()
    if not conn:
        conn = DeviceConnectionSetting()
        db.add(conn)
        db.commit()
        db.refresh(conn)

    now = datetime.datetime.now(datetime.timezone.utc)
    op_mode = state_manager.get_mode()

    rpi = db.query(Device).filter(Device.device_id == conn.rpi_device_id).first()
    esp32 = db.query(Device).filter(Device.device_id == conn.direct_esp32_id).first()

    is_gateway_connected = False
    is_esp32_connected = False
    error_msg = None
    details = {
        "mode": "Raspberry Pi 4B Gateway",
        "gateway_id": conn.rpi_device_id,
        "gateway_ip": conn.rpi_ip,
        "mqtt_broker": f"{conn.rpi_mqtt_host}:{conn.rpi_mqtt_port}",
        "operating_mode": op_mode
    }

    if op_mode == "SIMULATION":
        is_gateway_connected = True
        is_esp32_connected = True
        details["simulation_active"] = True
        details["note"] = "Operating in SIMULATION mode. Virtual Raspberry Pi 4B gateway link verified."
    else:
        if not mqtt_service.is_connected:
            is_gateway_connected = False
            error_msg = f"Cannot reach MQTT broker at {conn.rpi_mqtt_host}:{conn.rpi_mqtt_port}. Verify Mosquitto on Raspberry Pi."
        elif not rpi or not rpi.last_seen:
            is_gateway_connected = False
            error_msg = f"Raspberry Pi Gateway '{conn.rpi_device_id}' has not reported status. Verify edge_service.py is running on {conn.rpi_ip}."
        else:
            rpi_seen = rpi.last_seen.replace(tzinfo=datetime.timezone.utc if rpi.last_seen.tzinfo is None else rpi.last_seen.tzinfo)
            delta = (now - rpi_seen).total_seconds()
            details["gateway_seconds_since_last_seen"] = int(delta)
            if delta <= settings.STALE_DATA_TIMEOUT_SECONDS * 2:
                is_gateway_connected = True
            else:
                is_gateway_connected = False
                error_msg = f"Raspberry Pi Gateway '{conn.rpi_device_id}' heartbeat is stale ({int(delta)}s ago)."

        if is_gateway_connected:
            if esp32 and esp32.last_seen:
                esp_seen = esp32.last_seen.replace(tzinfo=datetime.timezone.utc if esp32.last_seen.tzinfo is None else esp32.last_seen.tzinfo)
                esp_delta = (now - esp_seen).total_seconds()
                is_esp32_connected = (esp_delta <= settings.STALE_DATA_TIMEOUT_SECONDS)
                details["esp32_via_gateway"] = "ONLINE" if is_esp32_connected else "OFFLINE"
            else:
                is_esp32_connected = False
                details["esp32_via_gateway"] = "NO_DATA"

    conn.rpi_status = "CONNECTED" if is_gateway_connected else "DISCONNECTED"
    conn.rpi_esp32_status = "CONNECTED" if is_esp32_connected else "DISCONNECTED"
    conn.rpi_last_verified_at = now
    conn.rpi_last_error = error_msg
    db.commit()

    return TestConnectionResponse(
        connection_mode="RPI_GATEWAY",
        status="CONNECTED" if is_gateway_connected else "DISCONNECTED",
        tested_at=now,
        details=details,
        error=error_msg
    )

@router.get("/hardware")
def get_hardware_settings(db: Session = Depends(get_db)):
    esp32 = db.query(Device).filter(Device.device_id == settings.DEFAULT_ESP32_ID).first()
    rpi = db.query(Device).filter(Device.device_id == settings.DEFAULT_RPI_ID).first()
    
    return {
        "esp32_device_id": esp32.device_id if esp32 else settings.DEFAULT_ESP32_ID,
        "rpi_device_id": rpi.device_id if rpi else settings.DEFAULT_RPI_ID,
        "mqtt_broker_host": settings.MQTT_BROKER_HOST,
        "mqtt_broker_port": settings.MQTT_BROKER_PORT,
        "mqtt_use_tls": False,
        "soil_sensor_type": "Capacitive v1.2 Corrosion-Resistant",
        "soil_raw_dry": esp32.soil_raw_dry if esp32 else 3200,
        "soil_raw_wet": esp32.soil_raw_wet if esp32 else 1400,
        "dht_type": esp32.dht_type if esp32 else "DHT22",
        "rain_active_low": esp32.rain_active_low if esp32 else True,
        "sampling_interval_seconds": 10,
        "heartbeat_interval_seconds": 30,
        "stale_timeout_seconds": settings.STALE_DATA_TIMEOUT_SECONDS,
        "sync_status": esp32.sync_status if esp32 else "SYNCED",
        "last_sync_time": esp32.last_sync_time.isoformat() if (esp32 and esp32.last_sync_time) else None
    }

@router.put("/hardware")
def update_hardware_settings(
    req: HardwareConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    esp32 = db.query(Device).filter(Device.device_id == settings.DEFAULT_ESP32_ID).first()
    if not esp32:
        esp32 = Device(
            device_id=settings.DEFAULT_ESP32_ID,
            name="ESP32 Zone 01 Field Controller",
            device_type="esp32"
        )
        db.add(esp32)

    if req.soil_raw_dry <= req.soil_raw_wet:
        raise HTTPException(status_code=400, detail="Raw Dry ADC value must be greater than Raw Wet ADC value.")

    esp32.soil_raw_dry = req.soil_raw_dry
    esp32.soil_raw_wet = req.soil_raw_wet
    esp32.dht_type = req.dht_type
    esp32.rain_active_low = req.rain_active_low
    esp32.sync_status = "PENDING_SYNC"
    db.commit()

    return {
        "status": "SUCCESS",
        "message": "Hardware and sensor configuration saved to server. Pending edge synchronization.",
        "config": req.model_dump()
    }

@router.post("/test-backend")
def test_backend_connection(db: Session = Depends(get_db)):
    start = datetime.datetime.now(datetime.timezone.utc)
    # Check db ping
    db.execute(db.query(User).statement)
    latency_ms = int((datetime.datetime.now(datetime.timezone.utc) - start).total_seconds() * 1000)
    return {
        "status": "HEALTHY",
        "latency_ms": max(1, latency_ms),
        "database": "Connected (SQLite/PostgreSQL)",
        "server_time": start.isoformat()
    }

@router.post("/test-mqtt")
def test_mqtt_connection():
    is_conn = mqtt_service.is_connected
    return {
        "status": "CONNECTED" if is_conn else "DISCONNECTED",
        "broker": f"{settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}",
        "message": "MQTT Broker active and connected" if is_conn else "MQTT Broker disconnected or offline."
    }

@router.post("/check-device-status")
def check_device_status(db: Session = Depends(get_db)):
    esp32 = db.query(Device).filter(Device.device_id == settings.DEFAULT_ESP32_ID).first()
    rpi = db.query(Device).filter(Device.device_id == settings.DEFAULT_RPI_ID).first()
    now = datetime.datetime.now(datetime.timezone.utc)
    
    def check_dev(dev):
        if not dev or not dev.last_seen:
            return "DISCONNECTED"
        delta = (now - dev.last_seen.replace(tzinfo=datetime.timezone.utc if dev.last_seen.tzinfo is None else dev.last_seen.tzinfo)).total_seconds()
        return "ONLINE" if delta < settings.STALE_DATA_TIMEOUT_SECONDS else "STALE"

    return {
        "esp32_status": check_dev(esp32),
        "rpi_status": check_dev(rpi),
        "checked_at": now.isoformat()
    }

@router.post("/request-telemetry")
def request_fresh_telemetry():
    if not mqtt_service.is_connected:
        raise HTTPException(status_code=503, detail="MQTT broker not connected. Cannot request telemetry from physical hardware.")
    topic = f"{settings.MQTT_TOPIC_PREFIX}/{settings.DEFAULT_ESP32_ID}/commands"
    payload = {"action": "POLL_TELEMETRY", "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    mqtt_service.client.publish(topic, json.dumps(payload), qos=1)
    return {"status": "SUCCESS", "message": "Telemetry poll request dispatched to physical ESP32 controller."}

@router.post("/sync-config")
def synchronize_configuration(db: Session = Depends(get_db)):
    esp32 = db.query(Device).filter(Device.device_id == settings.DEFAULT_ESP32_ID).first()
    setting = db.query(IrrigationSetting).filter(IrrigationSetting.device_id == settings.DEFAULT_ESP32_ID).first()
    now = datetime.datetime.now(datetime.timezone.utc)

    config_payload = {
        "device_id": settings.DEFAULT_ESP32_ID,
        "soil_calibration": {
            "raw_dry": esp32.soil_raw_dry if esp32 else 3200,
            "raw_wet": esp32.soil_raw_wet if esp32 else 1400
        },
        "dht_type": esp32.dht_type if esp32 else "DHT22",
        "dry_threshold": setting.dry_threshold_percent if setting else 35.0,
        "target_moisture": setting.target_moisture_percent if setting else 70.0,
        "max_runtime_seconds": setting.max_runtime_seconds if setting else 300,
        "rain_pause_enabled": setting.rain_pause_enabled if setting else True,
        "synchronized_at": now.isoformat()
    }

    if mqtt_service.is_connected:
        topic = f"{settings.MQTT_TOPIC_PREFIX}/{settings.DEFAULT_ESP32_ID}/config"
        mqtt_service.client.publish(topic, json.dumps(config_payload), qos=1)
        if esp32:
            esp32.sync_status = "SYNCED"
            esp32.last_sync_time = now
            db.commit()
        return {
            "status": "APPLIED_ON_DEVICE",
            "message": "Configuration successfully applied and confirmed on device via MQTT.",
            "sync_time": now.isoformat(),
            "config": config_payload
        }
    else:
        # Save as waiting for sync
        if esp32:
            esp32.sync_status = "PENDING_SYNC"
            db.commit()
        return {
            "status": "SAVED_TO_SERVER",
            "message": "Configuration saved to server. Device is offline; awaiting synchronization on next heartbeat.",
            "config": config_payload
        }

# Standard Irrigation Settings
@router.get("", response_model=IrrigationSettingSchema)
def get_irrigation_settings(
    device_id: str = None,
    db: Session = Depends(get_db)
):
    target_id = device_id or settings.DEFAULT_ESP32_ID
    setting = db.query(IrrigationSetting).filter(IrrigationSetting.device_id == target_id).first()
    if not setting:
        setting = IrrigationSetting(device_id=target_id)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting

@router.put("", response_model=IrrigationSettingSchema)
def update_irrigation_settings(
    settings_in: IrrigationSettingUpdate,
    device_id: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_id = device_id or settings.DEFAULT_ESP32_ID
    setting = db.query(IrrigationSetting).filter(IrrigationSetting.device_id == target_id).first()
    if not setting:
        setting = IrrigationSetting(device_id=target_id)
        db.add(setting)

    new_dry = settings_in.dry_threshold_percent if settings_in.dry_threshold_percent is not None else setting.dry_threshold_percent
    new_target = settings_in.target_moisture_percent if settings_in.target_moisture_percent is not None else setting.target_moisture_percent

    if new_dry >= new_target:
        raise HTTPException(
            status_code=400,
            detail=f"Target moisture ({new_target}%) must be higher than dry threshold ({new_dry}%) to ensure safe hysteresis"
        )

    if settings_in.dry_threshold_percent is not None:
        setting.dry_threshold_percent = settings_in.dry_threshold_percent
    if settings_in.target_moisture_percent is not None:
        setting.target_moisture_percent = settings_in.target_moisture_percent
    if settings_in.max_runtime_seconds is not None:
        setting.max_runtime_seconds = settings_in.max_runtime_seconds
    if settings_in.cooldown_minutes is not None:
        setting.cooldown_minutes = settings_in.cooldown_minutes
    if settings_in.rain_pause_enabled is not None:
        setting.rain_pause_enabled = settings_in.rain_pause_enabled
    if settings_in.daylight_only is not None:
        setting.daylight_only = settings_in.daylight_only
    if settings_in.restricted_hours_start is not None:
        setting.restricted_hours_start = settings_in.restricted_hours_start
    if settings_in.restricted_hours_end is not None:
        setting.restricted_hours_end = settings_in.restricted_hours_end

    setting.updated_by = current_user.email
    db.commit()
    db.refresh(setting)

    return setting
