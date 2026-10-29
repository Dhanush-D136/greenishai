import datetime
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

logger = logging.getLogger("smartirrigate.api.zones")

from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.core.security import get_current_user
from backend.app.models.models import (
    User, Device, SensorReading, IrrigationZone, ZonePlant,
    IrrigationEvent, SystemAlert
)
from backend.app.schemas.schemas import (
    ZoneCreate, ZoneUpdate, ZoneResponse, ZoneDetailResponse,
    PlantCreate, PlantUpdate, PlantResponse, BulkLayoutUpdateRequest,
    ZonePlanCalculationResponse, ApplyZoneSettingsRequest,
    SensorReadingResponse, GardenNetworkPayload, NetworkValidationResponse,
    GardenIrrigationPlanResponse
)
from backend.app.services.state_manager import state_manager
from backend.app.services.garden_network_service import garden_network_service

router = APIRouter(prefix="/zones", tags=["Irrigation Zones & Plant Planning"])

def make_aware(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt

@router.get("", response_model=List[ZoneResponse])
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(IrrigationZone).order_by(IrrigationZone.id.asc()).all()
    res = []
    authoritative_pump = state_manager.get_authoritative_pump_state()
    for z in zones:
        # Check actual pump state
        pump_state = z.current_pump_state if authoritative_pump == "RUNNING" else "OFF"
        z_dict = {
            "id": z.id,
            "zone_id": z.zone_id,
            "name": z.name,
            "description": z.description,
            "location": z.location,
            "plant_categories": z.plant_categories,
            "controller_device_id": z.controller_device_id,
            "pump_device_id": z.pump_device_id,
            "soil_moisture_target": z.soil_moisture_target,
            "soil_moisture_dry_threshold": z.soil_moisture_dry_threshold,
            "hysteresis_buffer": z.hysteresis_buffer,
            "max_runtime_seconds": z.max_runtime_seconds,
            "cooldown_minutes": z.cooldown_minutes,
            "auto_irrigation_enabled": z.auto_irrigation_enabled,
            "is_active": z.is_active,
            "notes": z.notes,
            "current_pump_state": pump_state,
            "last_irrigated_at": z.last_irrigated_at,
            "plant_count": len(z.plants) if z.plants else 0,
            "created_at": z.created_at,
            "updated_at": z.updated_at
        }
        res.append(z_dict)
    return res

@router.post("", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone(
    zone_in: ZoneCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate unique zone_id
    existing = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_in.zone_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Zone with ID '{zone_in.zone_id}' already exists.")

    if zone_in.soil_moisture_dry_threshold >= zone_in.soil_moisture_target:
        raise HTTPException(
            status_code=400,
            detail=f"Target moisture ({zone_in.soil_moisture_target}%) must be strictly greater than dry threshold ({zone_in.soil_moisture_dry_threshold}%)"
        )

    new_zone = IrrigationZone(
        zone_id=zone_in.zone_id,
        name=zone_in.name,
        description=zone_in.description,
        location=zone_in.location,
        plant_categories=zone_in.plant_categories or "Vegetables",
        controller_device_id=zone_in.controller_device_id or settings.DEFAULT_ESP32_ID,
        pump_device_id=zone_in.pump_device_id or "pump-zone-01",
        soil_moisture_target=zone_in.soil_moisture_target or 70.0,
        soil_moisture_dry_threshold=zone_in.soil_moisture_dry_threshold or 35.0,
        hysteresis_buffer=zone_in.hysteresis_buffer or 5.0,
        max_runtime_seconds=zone_in.max_runtime_seconds or 300,
        cooldown_minutes=zone_in.cooldown_minutes or 30,
        auto_irrigation_enabled=zone_in.auto_irrigation_enabled if zone_in.auto_irrigation_enabled is not None else True,
        is_active=True,
        notes=zone_in.notes
    )
    db.add(new_zone)
    db.commit()
    db.refresh(new_zone)

    return {
        "id": new_zone.id,
        "zone_id": new_zone.zone_id,
        "name": new_zone.name,
        "description": new_zone.description,
        "location": new_zone.location,
        "plant_categories": new_zone.plant_categories,
        "controller_device_id": new_zone.controller_device_id,
        "pump_device_id": new_zone.pump_device_id,
        "soil_moisture_target": new_zone.soil_moisture_target,
        "soil_moisture_dry_threshold": new_zone.soil_moisture_dry_threshold,
        "hysteresis_buffer": new_zone.hysteresis_buffer,
        "max_runtime_seconds": new_zone.max_runtime_seconds,
        "cooldown_minutes": new_zone.cooldown_minutes,
        "auto_irrigation_enabled": new_zone.auto_irrigation_enabled,
        "is_active": new_zone.is_active,
        "notes": new_zone.notes,
        "current_pump_state": new_zone.current_pump_state,
        "last_irrigated_at": new_zone.last_irrigated_at,
        "plant_count": 0,
        "created_at": new_zone.created_at,
        "updated_at": new_zone.updated_at
    }

@router.get("/{zone_id}", response_model=ZoneDetailResponse)
def get_zone_detail(zone_id: str, db: Session = Depends(get_db)):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    mode = state_manager.get_mode()
    is_sim_filter = (mode == "SIMULATION")
    latest_reading = db.query(SensorReading)\
        .filter(SensorReading.is_simulated == is_sim_filter)\
        .order_by(desc(SensorReading.timestamp))\
        .first()

    esp32 = db.query(Device).filter(Device.device_id == zone.controller_device_id).first()
    now = datetime.datetime.now(datetime.timezone.utc)
    hw_status = "OFFLINE"
    if esp32 and esp32.last_seen:
        diff = (now - make_aware(esp32.last_seen)).total_seconds()
        if diff < settings.STALE_DATA_TIMEOUT_SECONDS:
            hw_status = "ONLINE"
        elif diff < 600:
            hw_status = "STALE"

    authoritative_pump = state_manager.get_authoritative_pump_state()
    active_pump = zone.current_pump_state if authoritative_pump == "RUNNING" else "OFF"

    return {
        "id": zone.id,
        "zone_id": zone.zone_id,
        "name": zone.name,
        "description": zone.description,
        "location": zone.location,
        "plant_categories": zone.plant_categories,
        "controller_device_id": zone.controller_device_id,
        "pump_device_id": zone.pump_device_id,
        "soil_moisture_target": zone.soil_moisture_target,
        "soil_moisture_dry_threshold": zone.soil_moisture_dry_threshold,
        "hysteresis_buffer": zone.hysteresis_buffer,
        "max_runtime_seconds": zone.max_runtime_seconds,
        "cooldown_minutes": zone.cooldown_minutes,
        "auto_irrigation_enabled": zone.auto_irrigation_enabled,
        "is_active": zone.is_active,
        "notes": zone.notes,
        "current_pump_state": active_pump,
        "last_irrigated_at": zone.last_irrigated_at,
        "plant_count": len(zone.plants) if zone.plants else 0,
        "created_at": zone.created_at,
        "updated_at": zone.updated_at,
        "plants": zone.plants or [],
        "latest_reading": latest_reading,
        "hardware_status": hw_status if mode == "HARDWARE" else "ONLINE"
    }

@router.put("/{zone_id}", response_model=ZoneResponse)
def update_zone(
    zone_id: str,
    zone_in: ZoneUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    target = zone_in.soil_moisture_target if zone_in.soil_moisture_target is not None else zone.soil_moisture_target
    dry = zone_in.soil_moisture_dry_threshold if zone_in.soil_moisture_dry_threshold is not None else zone.soil_moisture_dry_threshold

    if dry >= target:
        raise HTTPException(
            status_code=400,
            detail=f"Target moisture ({target}%) must be higher than dry threshold ({dry}%)"
        )

    if zone_in.name is not None:
        zone.name = zone_in.name
    if zone_in.description is not None:
        zone.description = zone_in.description
    if zone_in.location is not None:
        zone.location = zone_in.location
    if zone_in.plant_categories is not None:
        zone.plant_categories = zone_in.plant_categories
    if zone_in.controller_device_id is not None:
        zone.controller_device_id = zone_in.controller_device_id
    if zone_in.pump_device_id is not None:
        zone.pump_device_id = zone_in.pump_device_id
    if zone_in.soil_moisture_target is not None:
        zone.soil_moisture_target = zone_in.soil_moisture_target
    if zone_in.soil_moisture_dry_threshold is not None:
        zone.soil_moisture_dry_threshold = zone_in.soil_moisture_dry_threshold
    if zone_in.hysteresis_buffer is not None:
        zone.hysteresis_buffer = zone_in.hysteresis_buffer
    if zone_in.max_runtime_seconds is not None:
        zone.max_runtime_seconds = zone_in.max_runtime_seconds
    if zone_in.cooldown_minutes is not None:
        zone.cooldown_minutes = zone_in.cooldown_minutes
    if zone_in.auto_irrigation_enabled is not None:
        zone.auto_irrigation_enabled = zone_in.auto_irrigation_enabled
    if zone_in.is_active is not None:
        zone.is_active = zone_in.is_active
    if zone_in.notes is not None:
        zone.notes = zone_in.notes

    zone.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(zone)

    return {
        "id": zone.id,
        "zone_id": zone.zone_id,
        "name": zone.name,
        "description": zone.description,
        "location": zone.location,
        "plant_categories": zone.plant_categories,
        "controller_device_id": zone.controller_device_id,
        "pump_device_id": zone.pump_device_id,
        "soil_moisture_target": zone.soil_moisture_target,
        "soil_moisture_dry_threshold": zone.soil_moisture_dry_threshold,
        "hysteresis_buffer": zone.hysteresis_buffer,
        "max_runtime_seconds": zone.max_runtime_seconds,
        "cooldown_minutes": zone.cooldown_minutes,
        "auto_irrigation_enabled": zone.auto_irrigation_enabled,
        "is_active": zone.is_active,
        "notes": zone.notes,
        "current_pump_state": zone.current_pump_state,
        "last_irrigated_at": zone.last_irrigated_at,
        "plant_count": len(zone.plants) if zone.plants else 0,
        "created_at": zone.created_at,
        "updated_at": zone.updated_at
    }

@router.delete("/{zone_id}")
def delete_zone(
    zone_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    # Safety check: Cannot delete a zone actively irrigating
    authoritative_pump = state_manager.get_authoritative_pump_state()
    if zone.current_pump_state == "RUNNING" and authoritative_pump == "RUNNING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete Zone '{zone.name}' while it is actively watering. Stop irrigation first."
        )

    # Protect against deleting the only configured zone
    total_zones = db.query(IrrigationZone).count()
    if total_zones <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the only remaining irrigation zone. Create a new zone before removing this one."
        )

    db.delete(zone)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Zone '{zone.name}' ({zone_id}) and its associated plant layout were deleted safely."
    }

@router.patch("/{zone_id}/autonomy")
def toggle_zone_autonomy(
    zone_id: str,
    payload: Dict[str, bool],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    enabled = payload.get("auto_irrigation_enabled", True)
    zone.auto_irrigation_enabled = enabled
    zone.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {
        "status": "SUCCESS",
        "zone_id": zone_id,
        "auto_irrigation_enabled": zone.auto_irrigation_enabled,
        "message": f"Autonomous irrigation {'enabled' if enabled else 'disabled'} for {zone.name}."
    }

# ==================== HARDWARE-AWARE IRRIGATION ACTUATION ====================
@router.post("/{zone_id}/irrigate")
def irrigate_zone(
    zone_id: str,
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    action = payload.get("action", "START").upper()
    duration = int(payload.get("duration_seconds", zone.max_runtime_seconds or 300))
    reason = payload.get("reason", f"Zone command by {current_user.email}")
    now = datetime.datetime.now(datetime.timezone.utc)

    if action == "START":
        # Check single-pump hardware contention
        authoritative_pump = state_manager.get_authoritative_pump_state()
        if authoritative_pump in ["RUNNING", "STARTING"]:
            # Check if it's already running for this zone or another zone
            other_active = db.query(IrrigationZone)\
                .filter(IrrigationZone.zone_id != zone_id, IrrigationZone.current_pump_state == "RUNNING")\
                .first()
            if other_active:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Pump contention: Physical pump is currently in use by '{other_active.name}'. "
                           f"The system hardware contains 1 pump and cannot water multiple zones simultaneously. "
                           f"Wait for the active cycle to complete or issue an emergency stop."
                )

        res = state_manager.start_irrigation(
            duration_seconds=duration,
            reason=f"[{zone.name}] {reason}",
            user_email=current_user.email
        )
        zone.current_pump_state = "RUNNING"
        zone.last_irrigated_at = now
        db.commit()
        return {
            "status": "STARTED",
            "zone_id": zone_id,
            "pump_state": res.get("pump_state", "RUNNING"),
            "message": f"Irrigation started for {zone.name} (Duration: {duration}s).",
            "result": res
        }

    elif action == "STOP":
        res = state_manager.stop_irrigation(
            reason=f"[{zone.name}] {reason}",
            user_email=current_user.email
        )
        zone.current_pump_state = "OFF"
        db.commit()
        return {
            "status": "STOPPED",
            "zone_id": zone_id,
            "pump_state": "OFF",
            "message": f"Irrigation stopped for {zone.name}.",
            "result": res
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'START' or 'STOP'.")


# ==================== PLANT LAYOUT & WATER PLANNING ====================
@router.get("/{zone_id}/plants", response_model=List[PlantResponse])
def get_zone_plants(zone_id: str, db: Session = Depends(get_db)):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")
    return zone.plants or []

@router.post("/{zone_id}/plants", response_model=PlantResponse, status_code=status.HTTP_201_CREATED)
def add_plant(
    zone_id: str,
    plant_in: PlantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    category = plant_in.water_category.upper()
    if category not in ["HIGH", "MEDIUM", "LOW"]:
        raise HTTPException(status_code=400, detail="Water requirement category must be 'HIGH', 'MEDIUM', or 'LOW'.")

    new_plant = ZonePlant(
        zone_id=zone_id,
        plant_name=plant_in.plant_name,
        water_category=category,
        desired_moisture_min=plant_in.desired_moisture_min,
        desired_moisture_max=plant_in.desired_moisture_max,
        target_moisture=plant_in.target_moisture,
        pos_x=plant_in.pos_x,
        pos_y=plant_in.pos_y,
        width=plant_in.width or 140.0,
        height=plant_in.height or 100.0,
        watering_interval_days=plant_in.watering_interval_days,
        notes=plant_in.notes
    )
    db.add(new_plant)
    db.commit()
    db.refresh(new_plant)
    return new_plant

@router.put("/{zone_id}/plants/{plant_id}", response_model=PlantResponse)
def update_plant(
    zone_id: str,
    plant_id: int,
    plant_in: PlantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plant = db.query(ZonePlant).filter(ZonePlant.id == plant_id, ZonePlant.zone_id == zone_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail=f"Plant with ID {plant_id} not found in Zone '{zone_id}'.")

    if plant_in.water_category is not None:
        cat = plant_in.water_category.upper()
        if cat not in ["HIGH", "MEDIUM", "LOW"]:
            raise HTTPException(status_code=400, detail="Water category must be 'HIGH', 'MEDIUM', or 'LOW'.")
        plant.water_category = cat

    if plant_in.plant_name is not None:
        plant.plant_name = plant_in.plant_name
    if plant_in.desired_moisture_min is not None:
        plant.desired_moisture_min = plant_in.desired_moisture_min
    if plant_in.desired_moisture_max is not None:
        plant.desired_moisture_max = plant_in.desired_moisture_max
    if plant_in.target_moisture is not None:
        plant.target_moisture = plant_in.target_moisture
    if plant_in.pos_x is not None:
        plant.pos_x = plant_in.pos_x
    if plant_in.pos_y is not None:
        plant.pos_y = plant_in.pos_y
    if plant_in.width is not None:
        plant.width = plant_in.width
    if plant_in.height is not None:
        plant.height = plant_in.height
    if plant_in.watering_interval_days is not None:
        plant.watering_interval_days = plant_in.watering_interval_days
    if plant_in.notes is not None:
        plant.notes = plant_in.notes

    plant.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(plant)
    return plant

@router.delete("/{zone_id}/plants/{plant_id}")
def delete_plant(
    zone_id: str,
    plant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    plant = db.query(ZonePlant).filter(ZonePlant.id == plant_id, ZonePlant.zone_id == zone_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail=f"Plant with ID {plant_id} not found in Zone '{zone_id}'.")
    db.delete(plant)
    db.commit()
    return {"status": "SUCCESS", "message": f"Plant '{plant.plant_name}' removed from Zone '{zone_id}'."}

@router.put("/{zone_id}/layout")
def save_bulk_layout(
    zone_id: str,
    req: BulkLayoutUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    # Update or insert plants
    now = datetime.datetime.now(datetime.timezone.utc)
    existing_plants = {p.id: p for p in zone.plants}
    kept_ids = []

    for item in req.plants:
        cat = item.water_category.upper()
        if cat not in ["HIGH", "MEDIUM", "LOW"]:
            cat = "MEDIUM"

        if item.id and item.id in existing_plants:
            p = existing_plants[item.id]
            p.plant_name = item.plant_name
            p.water_category = cat
            p.desired_moisture_min = item.desired_moisture_min or 50.0
            p.desired_moisture_max = item.desired_moisture_max or 75.0
            p.target_moisture = item.target_moisture or 65.0
            p.pos_x = item.pos_x
            p.pos_y = item.pos_y
            p.width = item.width or 140.0
            p.height = item.height or 100.0
            p.watering_interval_days = item.watering_interval_days
            p.notes = item.notes
            p.updated_at = now
            kept_ids.append(p.id)
        else:
            new_p = ZonePlant(
                zone_id=zone_id,
                plant_name=item.plant_name,
                water_category=cat,
                desired_moisture_min=item.desired_moisture_min or 50.0,
                desired_moisture_max=item.desired_moisture_max or 75.0,
                target_moisture=item.target_moisture or 65.0,
                pos_x=item.pos_x,
                pos_y=item.pos_y,
                width=item.width or 140.0,
                height=item.height or 100.0,
                watering_interval_days=item.watering_interval_days,
                notes=item.notes
            )
            db.add(new_p)
            db.flush()
            kept_ids.append(new_p.id)

    # Remove any plants not in the new layout
    for pid, p in existing_plants.items():
        if pid not in kept_ids:
            db.delete(p)

    db.commit()
    return {"status": "SUCCESS", "message": f"Saved layout with {len(kept_ids)} plant items."}

@router.get("/{zone_id}/calculate-plan", response_model=ZonePlanCalculationResponse)
def calculate_zone_plan(zone_id: str, db: Session = Depends(get_db)):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    plants = zone.plants or []
    if not plants:
        return {
            "zone_id": zone_id,
            "total_plants": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
            "calculated_target_moisture": zone.soil_moisture_target,
            "calculated_dry_threshold": zone.soil_moisture_dry_threshold,
            "explanation": "No plants currently configured in layout. Using default zone thresholds.",
            "has_conflict": False,
            "conflict_warning": None,
            "plants_summary": []
        }

    high_plants = [p for p in plants if p.water_category == "HIGH"]
    med_plants = [p for p in plants if p.water_category == "MEDIUM"]
    low_plants = [p for p in plants if p.water_category == "LOW"]

    # Calculate average target moisture & dry threshold
    avg_target = sum(p.target_moisture for p in plants) / len(plants)
    avg_min = sum(p.desired_moisture_min for p in plants) / len(plants)
    suggested_dry = round(max(15.0, min(avg_min, avg_target - 15.0)), 1)
    suggested_target = round(max(suggested_dry + 10.0, avg_target), 1)

    has_conflict = len(high_plants) > 0 and len(low_plants) > 0
    conflict_warning = None
    if has_conflict:
        high_names = ", ".join(p.plant_name for p in high_plants[:2])
        low_names = ", ".join(p.plant_name for p in low_plants[:2])
        conflict_warning = (
            f"⚠️ Incompatible Water Requirements Detected: This zone contains both High Water requirement "
            f"plants ({high_names}) and Low Water requirement plants ({low_names}). "
            f"Because this system operates a single sensor and single submersible pump for this zone, "
            f"watering to satisfy high-demand plants risks root rot for low-demand species. "
            f"Recommendation: Segregate contrasting plants into separate zones or install dedicated branch valves."
        )

    explanation = (
        f"Calculated from {len(plants)} plants ({len(high_plants)} High, {len(med_plants)} Medium, {len(low_plants)} Low). "
        f"Average target moisture is {suggested_target}% with a safety trigger threshold of {suggested_dry}%."
    )

    summary = [
        {
            "name": p.plant_name,
            "category": p.water_category,
            "target": p.target_moisture,
            "range": f"{p.desired_moisture_min}% - {p.desired_moisture_max}%"
        }
        for p in plants
    ]

    return {
        "zone_id": zone_id,
        "total_plants": len(plants),
        "high_count": len(high_plants),
        "medium_count": len(med_plants),
        "low_count": len(low_plants),
        "calculated_target_moisture": suggested_target,
        "calculated_dry_threshold": suggested_dry,
        "explanation": explanation,
        "has_conflict": has_conflict,
        "conflict_warning": conflict_warning,
        "plants_summary": summary
    }

@router.post("/{zone_id}/apply-plan")
def apply_zone_plan(
    zone_id: str,
    req: ApplyZoneSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    if req.soil_moisture_dry_threshold >= req.soil_moisture_target:
        raise HTTPException(
            status_code=400,
            detail=f"Target moisture ({req.soil_moisture_target}%) must be higher than dry threshold ({req.soil_moisture_dry_threshold}%)"
        )

    zone.soil_moisture_target = req.soil_moisture_target
    zone.soil_moisture_dry_threshold = req.soil_moisture_dry_threshold
    zone.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Applied plant water plan to Zone '{zone.name}'. New target: {zone.soil_moisture_target}%, dry threshold: {zone.soil_moisture_dry_threshold}%.",
        "soil_moisture_target": zone.soil_moisture_target,
        "soil_moisture_dry_threshold": zone.soil_moisture_dry_threshold
    }


# =============================================================================
# GARDEN PIPE & MOTOR DESIGNER ENDPOINTS
# =============================================================================

@router.get("/{zone_id}/network")
def get_garden_network(zone_id: str, db: Session = Depends(get_db)):
    """
    Returns the persistent garden pipe network for the zone, or a synthesized default network.
    """
    import json
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    plants = zone.plants or []

    if zone.pipe_network_json:
        try:
            network_data = json.loads(zone.pipe_network_json)
            validation = garden_network_service.validate_network(network_data, plants)
            return {
                "zone_id": zone_id,
                "network": network_data,
                "validation": validation
            }
        except Exception as e:
            logger.warning(f"Failed to parse stored pipe network JSON for zone {zone_id}: {e}")

    # Generate starter default network
    default_net = garden_network_service.get_default_network(zone_id, plants)
    validation = garden_network_service.validate_network(default_net, plants)
    return {
        "zone_id": zone_id,
        "network": default_net,
        "validation": validation
    }


@router.put("/{zone_id}/network")
def save_garden_network(
    zone_id: str,
    payload: GardenNetworkPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Persists updated pipe network components, pipes, and properties to database.
    Re-runs graph validation and returns updated network topology results.
    """
    import json
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    plants = zone.plants or []
    net_dict = payload.model_dump()
    validation = garden_network_service.validate_network(net_dict, plants)

    zone.pipe_network_json = json.dumps(net_dict)
    zone.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Garden pipe network saved successfully for '{zone.name}'.",
        "network": net_dict,
        "validation": validation
    }


@router.post("/{zone_id}/network/validate", response_model=NetworkValidationResponse)
def validate_garden_network(
    zone_id: str,
    payload: GardenNetworkPayload,
    db: Session = Depends(get_db)
):
    """
    Validates graph connectivity: Water Source -> Pump -> Pipes -> Plant Zones.
    Detects broken routes, closed valves, and unreachable beds.
    """
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    plants = zone.plants or []
    net_dict = payload.model_dump()
    return garden_network_service.validate_network(net_dict, plants)


@router.post("/{zone_id}/network/plan", response_model=GardenIrrigationPlanResponse)
def generate_garden_irrigation_plan(
    zone_id: str,
    payload: GardenNetworkPayload,
    db: Session = Depends(get_db)
):
    """
    Generates a topology-aware sequential irrigation plan only for reachable zones.
    """
    zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found.")

    net_dict = payload.model_dump()
    return garden_network_service.generate_irrigation_plan(zone_id, net_dict, db)


