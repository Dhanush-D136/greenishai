import datetime
import uuid
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="operator") # "admin", "operator"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    
    commands = relationship("IrrigationCommand", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), unique=True, index=True, nullable=False) # e.g. "esp32-zone-01"
    name = Column(String(255), nullable=False)
    device_type = Column(String(50), nullable=False) # "esp32", "raspberry_pi", "pump", "sensor"
    status = Column(String(50), default="OFFLINE") # "ONLINE", "OFFLINE", "STALE", "FAULT"
    firmware_version = Column(String(50), nullable=True)
    ip_address = Column(String(50), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    is_simulated = Column(Boolean, default=False)
    soil_raw_dry = Column(Integer, default=3200)
    soil_raw_wet = Column(Integer, default=1400)
    dht_type = Column(String(20), default="DHT22") # "DHT11", "DHT22"
    rain_active_low = Column(Boolean, default=True)
    sync_status = Column(String(50), default="SYNCED") # "SYNCED", "PENDING_SYNC", "SYNC_FAILED"
    last_sync_time = Column(DateTime(timezone=True), nullable=True)
    config_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class SensorReading(Base):
    __tablename__ = "sensor_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), index=True, nullable=False)
    sequence = Column(Integer, nullable=True)
    soil_moisture_raw = Column(Integer, nullable=True)
    soil_moisture_percent = Column(Float, nullable=True) # calibrated 0.0 - 100.0%
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Float, nullable=True)
    light_raw = Column(Integer, nullable=True)
    light_percent = Column(Float, nullable=True)
    rain_detected = Column(Boolean, default=False)
    pump_state = Column(String(20), default="OFF") # "ON", "OFF", "UNKNOWN"
    is_simulated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    
    __table_args__ = (
        Index("idx_device_timestamp", "device_id", "timestamp"),
    )

class DeviceHeartbeat(Base):
    __tablename__ = "device_heartbeats"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow)
    battery_level = Column(Float, nullable=True)
    signal_strength = Column(Integer, nullable=True) # RSSI dBm
    uptime_seconds = Column(Integer, nullable=True)
    status = Column(String(50), default="ONLINE")
    created_at = Column(DateTime(timezone=True), default=utcnow)

class IrrigationSetting(Base):
    __tablename__ = "irrigation_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), unique=True, index=True, nullable=False)
    auto_mode_enabled = Column(Boolean, default=True)
    dry_threshold_percent = Column(Float, default=35.0) # Start watering below 35%
    target_moisture_percent = Column(Float, default=70.0) # Stop watering at 70%
    max_runtime_seconds = Column(Integer, default=300) # Max 5 mins continuous run
    cooldown_minutes = Column(Integer, default=30) # Minimum 30 mins between cycles
    rain_pause_enabled = Column(Boolean, default=True) # Pause if rain detected
    daylight_only = Column(Boolean, default=False) # Only water during daylight hours
    restricted_hours_start = Column(String(10), nullable=True) # e.g. "12:00"
    restricted_hours_end = Column(String(10), nullable=True) # e.g. "15:00"
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class IrrigationCommand(Base):
    __tablename__ = "irrigation_commands"
    
    id = Column(Integer, primary_key=True, index=True)
    command_id = Column(String(64), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(100), index=True, nullable=False)
    action = Column(String(50), nullable=False) # "START_PUMP", "STOP_PUMP", "EMERGENCY_STOP", "SET_MODE"
    parameters_json = Column(Text, nullable=True)
    issued_at = Column(DateTime(timezone=True), default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="SENT") # "SENT", "ACKNOWLEDGED", "EXECUTED", "REJECTED", "EXPIRED", "TIMED_OUT"
    ack_received_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_pump_state = Column(String(20), nullable=True) # "ON", "OFF"
    rejection_reason = Column(String(255), nullable=True)
    issued_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    user = relationship("User", back_populates="commands")

class IrrigationEvent(Base):
    __tablename__ = "irrigation_events"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), index=True, nullable=False)
    trigger_type = Column(String(50), nullable=False) # "AUTO_THRESHOLD", "MANUAL_REMOTE", "EMERGENCY_STOP", "TARGET_REACHED", "COOLDOWN_TIMEOUT", "RAIN_DETECTED"
    action = Column(String(20), nullable=False) # "START", "STOP"
    start_time = Column(DateTime(timezone=True), default=utcnow)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    water_volume_liters = Column(Float, nullable=True)
    start_soil_moisture = Column(Float, nullable=True)
    end_soil_moisture = Column(Float, nullable=True)
    reason = Column(String(255), nullable=True)
    triggered_by = Column(String(100), default="SYSTEM_AUTO")
    created_at = Column(DateTime(timezone=True), default=utcnow)

class SystemAlert(Base):
    __tablename__ = "system_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), nullable=True)
    severity = Column(String(20), default="INFO") # "INFO", "WARNING", "ERROR", "CRITICAL"
    category = Column(String(50), default="SYSTEM") # "DEVICE", "PUMP", "SENSOR", "COMMUNICATION"
    title = Column(String(255), default="System Alert")
    message = Column(String(500), nullable=False)
    source_mode = Column(String(50), default="SIMULATION") # "SIMULATION", "HARDWARE"
    status = Column(String(50), default="ACTIVE") # "ACTIVE", "ACKNOWLEDGED", "RESOLVED"
    action_recommended = Column(String(255), nullable=True)
    details_json = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

class SystemState(Base):
    __tablename__ = "system_states"
    
    id = Column(Integer, primary_key=True)
    operating_mode = Column(String(50), default="SIMULATION") # "SIMULATION", "HARDWARE"
    permission_mode = Column(String(50), default="AUTHORIZED_AUTO") # "AUTHORIZED_AUTO", "ASK_BEFORE_ACTION", "MANUAL_CONTROL"
    authoritative_pump_state = Column(String(20), default="OFF") # "OFF", "STARTING", "RUNNING", "STOPPING", "FAULT", "UNKNOWN"
    pump_started_at = Column(DateTime(timezone=True), nullable=True)
    last_irrigation_end = Column(DateTime(timezone=True), nullable=True)
    active_session_id = Column(String(64), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class ProposedAction(Base):
    __tablename__ = "proposed_actions"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), nullable=False) # "START_IRRIGATION", "STOP_IRRIGATION"
    reason = Column(String(500), nullable=False)
    soil_moisture_percent = Column(Float, nullable=True)
    dry_threshold_percent = Column(Float, nullable=True)
    status = Column(String(50), default="PENDING") # "PENDING", "APPROVED", "REJECTED", "EXPIRED"
    created_at = Column(DateTime(timezone=True), default=utcnow)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by = Column(String(255), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=False)
    details_json = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)
    
    user = relationship("User", back_populates="audit_logs")

class DeviceConnectionSetting(Base):
    __tablename__ = "device_connection_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    active_mode = Column(String(50), default="DIRECT_ESP32") # "DIRECT_ESP32", "RPI_GATEWAY"
    direct_esp32_id = Column(String(100), default="esp32-zone-01")
    direct_esp32_ip = Column(String(100), default="192.168.1.105")
    direct_esp32_protocol = Column(String(50), default="MQTT") # "MQTT", "HTTP_REST"
    direct_esp32_status = Column(String(50), default="DISCONNECTED") # "CONNECTED", "DISCONNECTED", "UNKNOWN"
    direct_last_verified_at = Column(DateTime(timezone=True), nullable=True)
    direct_last_error = Column(String(255), nullable=True)
    
    rpi_device_id = Column(String(100), default="rpi-edge-01")
    rpi_ip = Column(String(100), default="192.168.1.200")
    rpi_mqtt_host = Column(String(100), default="127.0.0.1")
    rpi_mqtt_port = Column(Integer, default=1883)
    rpi_status = Column(String(50), default="DISCONNECTED") # "CONNECTED", "DISCONNECTED", "UNKNOWN"
    rpi_esp32_status = Column(String(50), default="DISCONNECTED") # "CONNECTED", "DISCONNECTED", "UNKNOWN"
    rpi_last_verified_at = Column(DateTime(timezone=True), nullable=True)
    rpi_last_error = Column(String(255), nullable=True)
    
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class IrrigationZone(Base):
    __tablename__ = "irrigation_zones"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(100), unique=True, index=True, nullable=False) # e.g. "zone-01"
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    plant_categories = Column(String(255), default="Vegetables")
    controller_device_id = Column(String(100), default="esp32-zone-01")
    pump_device_id = Column(String(100), default="pump-zone-01")
    soil_moisture_target = Column(Float, default=70.0)
    soil_moisture_dry_threshold = Column(Float, default=35.0)
    hysteresis_buffer = Column(Float, default=5.0)
    max_runtime_seconds = Column(Integer, default=300)
    cooldown_minutes = Column(Integer, default=30)
    auto_irrigation_enabled = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    pipe_network_json = Column(Text, nullable=True)
    current_pump_state = Column(String(20), default="OFF") # "OFF", "RUNNING"
    last_irrigated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    
    plants = relationship("ZonePlant", back_populates="zone", cascade="all, delete-orphan", lazy="joined")

class ZonePlant(Base):
    __tablename__ = "zone_plants"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(100), ForeignKey("irrigation_zones.zone_id", ondelete="CASCADE"), nullable=False, index=True)
    plant_name = Column(String(100), nullable=False)
    water_category = Column(String(50), default="MEDIUM") # "HIGH", "MEDIUM", "LOW"
    desired_moisture_min = Column(Float, default=50.0)
    desired_moisture_max = Column(Float, default=75.0)
    target_moisture = Column(Float, default=65.0)
    pos_x = Column(Float, default=100.0)
    pos_y = Column(Float, default=100.0)
    width = Column(Float, default=140.0)
    height = Column(Float, default=100.0)
    watering_interval_days = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    
    zone = relationship("IrrigationZone", back_populates="plants")

class AIForecast(Base):
    __tablename__ = "ai_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(100), index=True, nullable=False)
    generated_at = Column(DateTime(timezone=True), default=utcnow)
    horizon_minutes = Column(Integer, nullable=False) # 30 or 60
    current_measured_moisture = Column(Float, nullable=False)
    predicted_moisture = Column(Float, nullable=False)
    confidence_min = Column(Float, nullable=False)
    confidence_max = Column(Float, nullable=False)
    trend_direction = Column(String(20), default="DRYING") # "DRYING", "STABLE", "RISING"
    model_type = Column(String(50), default="TREND_BASELINE") # "TREND_BASELINE", "EXPONENTIAL_DECAY", "RANDOM_FOREST"
    model_version = Column(String(50), default="v1.0.0-baseline")
    data_quality = Column(String(50), default="OPTIMAL") # "OPTIMAL", "FAIR", "INSUFFICIENT_DATA", "STALE_WARNING"
    historical_samples_count = Column(Integer, default=0)
    is_simulated = Column(Boolean, default=False)

class AIAnomaly(Base):
    __tablename__ = "ai_anomalies"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    zone_id = Column(String(100), index=True, nullable=True)
    device_id = Column(String(100), index=True, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)
    severity = Column(String(20), default="WARNING") # "INFO", "WARNING", "ERROR", "CRITICAL"
    category = Column(String(50), default="SENSOR") # "SENSOR", "IRRIGATION", "COMMUNICATION"
    anomaly_type = Column(String(100), nullable=False) # "OUT_OF_RANGE", "FLATLINE", "IMPLAUSIBLE_JUMP", "UNRESPONSIVE_SOIL", "PHANTOM_WATERING", "RUNTIME_EXCEEDED", "DISCONNECTED"
    observed_evidence = Column(String(500), nullable=False)
    explanation = Column(Text, nullable=False)
    suggested_action = Column(String(500), nullable=True)
    detection_method = Column(String(50), default="DETERMINISTIC_RULE") # "DETERMINISTIC_RULE", "STATISTICAL"
    status = Column(String(50), default="ACTIVE") # "ACTIVE", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String(255), nullable=True)

class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(String(64), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    zone_id = Column(String(100), index=True, nullable=False)
    suggested_action = Column(String(50), nullable=False) # "IRRIGATE", "WAIT", "INSPECT"
    proposed_duration_seconds = Column(Integer, default=300)
    reason = Column(Text, nullable=False)
    current_moisture = Column(Float, nullable=False)
    target_moisture = Column(Float, nullable=False)
    dry_threshold = Column(Float, nullable=False)
    rain_detected = Column(Boolean, default=False)
    forecast_30m = Column(Float, nullable=True)
    supporting_data_json = Column(Text, nullable=True)
    confidence = Column(Float, default=0.85)
    rules_version = Column(String(50), default="v1.2-agricultural")
    generated_at = Column(DateTime(timezone=True), default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), default="PENDING") # "PENDING", "APPROVED", "REJECTED", "EXPIRED", "EXECUTED"
    action_id = Column(Integer, nullable=True) # Linked ProposedAction id

class WaterEfficiencyMetric(Base):
    __tablename__ = "water_efficiency_metrics"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(100), index=True, nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), default=utcnow)
    total_runtime_seconds = Column(Integer, default=0)
    cycle_count = Column(Integer, default=0)
    avg_moisture_gain = Column(Float, default=0.0)
    water_consumed_liters_estimate = Column(Float, nullable=True)
    flow_rate_lpm = Column(Float, default=1.5) # Default 1.5 LPM calibrated submersible mini-pump
    efficiency_score = Column(Float, default=85.0) # 0-100 score
    inefficient_cycles_count = Column(Integer, default=0)
    recommendations_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(64), index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(String(20), nullable=False) # "user", "assistant"
    content = Column(Text, nullable=False)
    supporting_records_json = Column(Text, nullable=True)
    proposed_action_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

