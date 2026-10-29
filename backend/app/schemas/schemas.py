import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None
    role: Optional[str] = "operator"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime.datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Device schemas
class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: str
    name: str
    device_type: str
    status: str
    firmware_version: Optional[str] = None
    ip_address: Optional[str] = None
    last_seen: Optional[datetime.datetime] = None
    is_simulated: bool
    created_at: datetime.datetime

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    config_json: Optional[str] = None

# Telemetry schemas
class TelemetryPayload(BaseModel):
    device_id: str
    timestamp: Optional[datetime.datetime] = None
    sequence: Optional[int] = None
    soil_moisture_raw: Optional[int] = None
    soil_moisture_percent: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = None
    light_raw: Optional[int] = None
    rain_detected: bool = False
    pump_state: Optional[str] = "OFF"
    is_simulated: bool = False

class SensorReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: str
    timestamp: datetime.datetime
    sequence: Optional[int] = None
    soil_moisture_raw: Optional[int] = None
    soil_moisture_percent: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_percent: Optional[float] = None
    light_raw: Optional[int] = None
    light_percent: Optional[float] = None
    rain_detected: bool
    pump_state: str
    is_simulated: bool
    created_at: datetime.datetime

# Irrigation Command Schemas
class CommandRequest(BaseModel):
    action: str = Field(..., description="START_PUMP, STOP_PUMP, EMERGENCY_STOP")
    device_id: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=10, le=86400, description="Runtime duration in seconds (up to 24 hours)")
    reason: Optional[str] = "Manual remote action"

class CommandResponse(BaseModel):
    command_id: str
    device_id: str
    action: str
    status: str
    issued_at: datetime.datetime
    expires_at: datetime.datetime
    confirmed_pump_state: Optional[str] = None
    message: str

class CommandAckPayload(BaseModel):
    command_id: str
    device_id: str
    status: str # "ACKNOWLEDGED", "REJECTED"
    confirmed_pump_state: str # "ON", "OFF"
    timestamp: Optional[datetime.datetime] = None
    error_message: Optional[str] = None

class ModeToggleRequest(BaseModel):
    device_id: Optional[str] = None
    auto_mode_enabled: bool

# Settings schemas
class IrrigationSettingSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    device_id: str
    auto_mode_enabled: bool
    dry_threshold_percent: float
    target_moisture_percent: float
    max_runtime_seconds: int
    cooldown_minutes: int
    rain_pause_enabled: bool
    daylight_only: bool
    restricted_hours_start: Optional[str] = None
    restricted_hours_end: Optional[str] = None
    updated_by: Optional[str] = None
    updated_at: datetime.datetime

class IrrigationSettingUpdate(BaseModel):
    dry_threshold_percent: Optional[float] = Field(None, ge=10.0, le=80.0)
    target_moisture_percent: Optional[float] = Field(None, ge=30.0, le=95.0)
    max_runtime_seconds: Optional[int] = Field(None, ge=30, le=1800)
    cooldown_minutes: Optional[int] = Field(None, ge=5, le=360)
    rain_pause_enabled: Optional[bool] = None
    daylight_only: Optional[bool] = None
    restricted_hours_start: Optional[str] = None
    restricted_hours_end: Optional[str] = None

# Event schemas
class IrrigationEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: str
    trigger_type: str
    action: str
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    duration_seconds: Optional[int] = None
    water_volume_liters: Optional[float] = None
    start_soil_moisture: Optional[float] = None
    end_soil_moisture: Optional[float] = None
    reason: Optional[str] = None
    triggered_by: str
    created_at: datetime.datetime

# Alerts
class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: Optional[str] = None
    severity: str # "INFO", "WARNING", "ERROR", "CRITICAL"
    category: str # "DEVICE", "PUMP", "SENSOR", "COMMUNICATION"
    title: str
    message: str
    source_mode: str # "SIMULATION", "HARDWARE"
    status: str # "ACTIVE", "ACKNOWLEDGED", "RESOLVED"
    action_recommended: Optional[str] = None
    is_read: bool
    created_at: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None

class ProposedActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    action: str
    reason: str
    soil_moisture_percent: Optional[float] = None
    status: str
    created_at: datetime.datetime

# System Mode & Permission Schemas
class SystemModeUpdateRequest(BaseModel):
    mode: str = Field(..., description="'SIMULATION' or 'HARDWARE'")

class PermissionModeUpdateRequest(BaseModel):
    permission_mode: str = Field(..., description="'AUTHORIZED_AUTO', 'ASK_BEFORE_ACTION', or 'MANUAL_CONTROL'")

# Dashboard Overview
class DashboardOverviewResponse(BaseModel):
    system_status: str # "ONLINE", "OFFLINE", "DEGRADED"
    esp32_status: str
    rpi_status: str
    system_mode: str # "SIMULATION", "HARDWARE"
    operating_mode: str # "AUTO", "MANUAL"
    permission_mode: str # "AUTHORIZED_AUTO", "ASK_BEFORE_ACTION", "MANUAL_CONTROL"
    pump_state: str # "OFF", "STARTING", "RUNNING", "STOPPING", "FAULT", "UNKNOWN"
    latest_reading: Optional[SensorReadingResponse] = None
    settings: Optional[IrrigationSettingSchema] = None
    latest_event: Optional[IrrigationEventResponse] = None
    is_stale: bool
    stale_warning: Optional[str] = None
    active_alerts_count: int
    simulation_status: Optional[Dict[str, Any]] = None
    pending_action: Optional[ProposedActionResponse] = None
    server_time: datetime.datetime

# System Health & Diagnostics
class DiagnosticsResponse(BaseModel):
    backend_status: str
    database_connected: bool
    mqtt_broker_status: str
    operating_mode: str
    pump_state: str
    last_esp32_heartbeat: Optional[datetime.datetime] = None
    last_rpi_heartbeat: Optional[datetime.datetime] = None
    last_telemetry_time: Optional[datetime.datetime] = None
    last_command_time: Optional[datetime.datetime] = None
    last_command_ack_status: Optional[str] = None
    recent_errors: List[str] = []
    active_alerts: List[Dict[str, Any]] = []
    uptime_seconds: float

# Device Connection Settings Schemas
class DeviceConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    active_mode: str # "DIRECT_ESP32" or "RPI_GATEWAY"
    direct_esp32_id: str
    direct_esp32_ip: str
    direct_esp32_protocol: str
    direct_esp32_status: str
    direct_last_verified_at: Optional[datetime.datetime] = None
    direct_last_error: Optional[str] = None
    rpi_device_id: str
    rpi_ip: str
    rpi_mqtt_host: str
    rpi_mqtt_port: int
    rpi_status: str
    rpi_esp32_status: str
    rpi_last_verified_at: Optional[datetime.datetime] = None
    rpi_last_error: Optional[str] = None
    updated_at: datetime.datetime

class DeviceConnectionUpdate(BaseModel):
    active_mode: Optional[str] = Field(None, description="'DIRECT_ESP32' or 'RPI_GATEWAY'")
    direct_esp32_id: Optional[str] = None
    direct_esp32_ip: Optional[str] = None
    direct_esp32_protocol: Optional[str] = None
    rpi_device_id: Optional[str] = None
    rpi_ip: Optional[str] = None
    rpi_mqtt_host: Optional[str] = None
    rpi_mqtt_port: Optional[int] = Field(None, ge=1, le=65535)

class TestConnectionResponse(BaseModel):
    connection_mode: str
    status: str # "CONNECTED", "DISCONNECTED", "UNKNOWN"
    tested_at: datetime.datetime
    details: Dict[str, Any]
    error: Optional[str] = None

# Plant Schemas
class PlantBase(BaseModel):
    plant_name: str = Field(..., min_length=1, max_length=100)
    water_category: str = Field(..., description="'HIGH', 'MEDIUM', or 'LOW'")
    desired_moisture_min: float = Field(default=50.0, ge=0.0, le=100.0)
    desired_moisture_max: float = Field(default=75.0, ge=0.0, le=100.0)
    target_moisture: float = Field(default=65.0, ge=0.0, le=100.0)
    pos_x: float = Field(default=100.0)
    pos_y: float = Field(default=100.0)
    width: Optional[float] = Field(default=140.0)
    height: Optional[float] = Field(default=100.0)
    watering_interval_days: Optional[int] = Field(None, ge=1, le=365)
    notes: Optional[str] = None

class PlantCreate(PlantBase):
    pass

class PlantUpdate(BaseModel):
    plant_name: Optional[str] = None
    water_category: Optional[str] = None
    desired_moisture_min: Optional[float] = None
    desired_moisture_max: Optional[float] = None
    target_moisture: Optional[float] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    watering_interval_days: Optional[int] = None
    notes: Optional[str] = None

class PlantResponse(PlantBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    zone_id: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

class PlantLayoutItemUpdate(BaseModel):
    id: Optional[int] = None
    plant_name: str
    water_category: str
    desired_moisture_min: Optional[float] = 50.0
    desired_moisture_max: Optional[float] = 75.0
    target_moisture: Optional[float] = 65.0
    pos_x: float
    pos_y: float
    width: Optional[float] = 140.0
    height: Optional[float] = 100.0
    watering_interval_days: Optional[int] = None
    notes: Optional[str] = None

class BulkLayoutUpdateRequest(BaseModel):
    plants: List[PlantLayoutItemUpdate]

# Zone Schemas
class ZoneCreate(BaseModel):
    zone_id: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-zA-Z0-9_\-]+$")
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    location: Optional[str] = None
    plant_categories: Optional[str] = "Vegetables"
    controller_device_id: Optional[str] = "esp32-zone-01"
    pump_device_id: Optional[str] = "pump-zone-01"
    soil_moisture_target: Optional[float] = Field(70.0, ge=20.0, le=95.0)
    soil_moisture_dry_threshold: Optional[float] = Field(35.0, ge=10.0, le=80.0)
    hysteresis_buffer: Optional[float] = Field(5.0, ge=1.0, le=20.0)
    max_runtime_seconds: Optional[int] = Field(300, ge=30, le=1800)
    cooldown_minutes: Optional[int] = Field(30, ge=5, le=360)
    auto_irrigation_enabled: Optional[bool] = True
    notes: Optional[str] = None

class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    plant_categories: Optional[str] = None
    controller_device_id: Optional[str] = None
    pump_device_id: Optional[str] = None
    soil_moisture_target: Optional[float] = Field(None, ge=20.0, le=95.0)
    soil_moisture_dry_threshold: Optional[float] = Field(None, ge=10.0, le=80.0)
    hysteresis_buffer: Optional[float] = Field(None, ge=1.0, le=20.0)
    max_runtime_seconds: Optional[int] = Field(None, ge=30, le=1800)
    cooldown_minutes: Optional[int] = Field(None, ge=5, le=360)
    auto_irrigation_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class ZoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    zone_id: str
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    plant_categories: Optional[str] = None
    controller_device_id: str
    pump_device_id: str
    soil_moisture_target: float
    soil_moisture_dry_threshold: float
    hysteresis_buffer: float
    max_runtime_seconds: int
    cooldown_minutes: int
    auto_irrigation_enabled: bool
    is_active: bool
    notes: Optional[str] = None
    current_pump_state: str
    last_irrigated_at: Optional[datetime.datetime] = None
    plant_count: int = 0
    created_at: datetime.datetime
    updated_at: datetime.datetime

class ZoneDetailResponse(ZoneResponse):
    plants: List[PlantResponse] = []
    latest_reading: Optional[SensorReadingResponse] = None
    hardware_status: Optional[str] = "ONLINE"

class ZonePlanCalculationResponse(BaseModel):
    zone_id: str
    total_plants: int
    high_count: int
    medium_count: int
    low_count: int
    calculated_target_moisture: float
    calculated_dry_threshold: float
    explanation: str
    has_conflict: bool
    conflict_warning: Optional[str] = None
    plants_summary: List[Dict[str, Any]]

class ApplyZoneSettingsRequest(BaseModel):
    soil_moisture_target: float = Field(..., ge=20.0, le=95.0)
    soil_moisture_dry_threshold: float = Field(..., ge=10.0, le=80.0)

# ==================== AI CLOUD INTELLIGENCE SCHEMAS ====================

class AIForecastPoint(BaseModel):
    timestamp: str
    moisture_percent: float
    is_forecast: bool
    confidence_min: Optional[float] = None
    confidence_max: Optional[float] = None

class AIForecastResponse(BaseModel):
    zone_id: str
    current_moisture: float
    forecast_30m: Optional[float] = None
    forecast_60m: Optional[float] = None
    confidence_interval_30m: Optional[List[float]] = None
    confidence_interval_60m: Optional[List[float]] = None
    trend_direction: str # "DRYING", "STABLE", "RISING"
    model_type: str # "TREND_BASELINE", "EXPONENTIAL_DECAY", "RANDOM_FOREST"
    model_version: str
    data_quality: str # "OPTIMAL", "FAIR", "INSUFFICIENT_DATA", "STALE_WARNING"
    historical_samples_count: int
    generated_at: str
    warning_message: Optional[str] = None
    forecast_curve: List[AIForecastPoint] = []

class AIAnomalyResponse(BaseModel):
    id: int
    event_id: str
    zone_id: Optional[str] = None
    device_id: Optional[str] = None
    timestamp: str
    severity: str # "INFO", "WARNING", "ERROR", "CRITICAL"
    category: str # "SENSOR", "IRRIGATION", "COMMUNICATION"
    anomaly_type: str
    observed_evidence: str
    explanation: str
    suggested_action: Optional[str] = None
    detection_method: str
    status: str # "ACTIVE", "ACKNOWLEDGED", "RESOLVED"
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None

class AIRecommendationResponse(BaseModel):
    id: int
    recommendation_id: str
    zone_id: str
    suggested_action: str # "IRRIGATE", "WAIT", "INSPECT"
    proposed_duration_seconds: int
    reason: str
    current_moisture: float
    target_moisture: float
    dry_threshold: float
    rain_detected: bool
    forecast_30m: Optional[float] = None
    confidence: float
    rules_version: str
    generated_at: str
    expires_at: str
    status: str # "PENDING", "APPROVED", "REJECTED", "EXPIRED", "EXECUTED"
    action_id: Optional[int] = None
    is_expired: bool = False

class WaterEfficiencyResponse(BaseModel):
    zone_id: str
    period_days: int
    total_runtime_seconds: int
    cycle_count: int
    avg_moisture_gain: float
    water_consumed_liters_estimate: Optional[float] = None
    flow_rate_lpm: float
    efficiency_score: float # 0 - 100
    inefficient_cycles_count: int
    rain_watering_cycles_count: int
    recommendations: List[str] = []
    daily_runtimes: List[Dict[str, Any]] = []

class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    conversation_id: Optional[str] = None
    zone_id: Optional[str] = None

class AIChatResponse(BaseModel):
    conversation_id: str
    role: str = "assistant"
    content: str
    supporting_records: Optional[Dict[str, Any]] = None
    proposed_action: Optional[Dict[str, Any]] = None
    created_at: str

# ==================== GARDEN PIPE DESIGNER SCHEMAS ====================

class GardenComponent(BaseModel):
    id: str
    type: str # "WATER_SOURCE", "MOTOR_PUMP", "JUNCTION", "VALVE", "DRIP_OUTLET", "PLANT_ZONE"
    name: str
    x: float
    y: float
    status: Optional[str] = "ACTIVE"
    plant_id: Optional[int] = None
    properties: Optional[Dict[str, Any]] = None

class GardenPipe(BaseModel):
    id: str
    type: str # "MAIN", "BRANCH"
    from_node_id: str
    from_port: str
    to_node_id: str
    to_port: str
    points: Optional[List[Dict[str, float]]] = None
    status: Optional[str] = "CONNECTED"

class GardenNetworkPayload(BaseModel):
    components: List[GardenComponent]
    pipes: List[GardenPipe]
    metadata: Optional[Dict[str, Any]] = None

class NetworkValidationIssue(BaseModel):
    code: str
    severity: str # "ERROR", "WARNING", "INFO"
    message: str
    component_id: Optional[str] = None

class NetworkValidationResponse(BaseModel):
    is_valid: bool
    status: str # "VALID", "WARNING", "ERROR"
    total_components: int
    total_pipes: int
    has_water_source: bool
    has_motor_pump: bool
    connected_plant_ids: List[str]
    unreachable_plant_ids: List[str]
    reachable_zones_count: int
    total_zones_count: int
    issues: List[NetworkValidationIssue]
    summary: str

class GardenIrrigationTask(BaseModel):
    step: int
    target_id: str
    target_name: str
    water_category: str
    current_moisture: float
    target_moisture: float
    duration_seconds: int
    priority: str # "HIGH", "MEDIUM", "LOW"
    supply_path: List[str]
    valve_states: Dict[str, str] = {}
    explanation: str

class GardenIrrigationPlanResponse(BaseModel):
    zone_id: str
    generated_at: str
    total_tasks: int
    total_water_liters_estimate: float
    flow_rate_lpm: float
    unreachable_warnings: List[str] = []
    tasks: List[GardenIrrigationTask]
    summary: str


