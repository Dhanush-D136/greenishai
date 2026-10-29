export type SystemMode = 'SIMULATION' | 'HARDWARE';
export type PumpState = 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAULT' | 'UNKNOWN';
export type PermissionMode = 'AUTHORIZED_AUTO' | 'ASK_BEFORE_ACTION' | 'MANUAL_CONTROL';

export interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SensorReading {
  id: number;
  device_id: string;
  timestamp: string;
  sequence?: number;
  soil_moisture_raw?: number;
  soil_moisture_percent?: number;
  temperature_c?: number;
  humidity_percent?: number;
  light_raw?: number;
  light_percent?: number;
  rain_detected: boolean;
  pump_state: 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAULT' | 'UNKNOWN' | 'ON';
  is_simulated: boolean;
  created_at: string;
}

export interface IrrigationSetting {
  device_id: string;
  auto_mode_enabled: boolean;
  dry_threshold_percent: number;
  target_moisture_percent: number;
  max_runtime_seconds: number;
  cooldown_minutes: number;
  rain_pause_enabled: boolean;
  daylight_only: boolean;
  restricted_hours_start?: string;
  restricted_hours_end?: string;
  updated_by?: string;
  updated_at: string;
}

export interface IrrigationEvent {
  id: number;
  device_id: string;
  trigger_type: string;
  action: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  water_volume_liters?: number;
  start_soil_moisture?: number;
  end_soil_moisture?: number;
  start_moisture_percent?: number;
  end_moisture_percent?: number;
  reason?: string;
  triggered_by: string;
  created_at: string;
}

export interface SystemAlert {
  id: number;
  device_id?: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: string;
  title: string;
  message: string;
  source_mode: 'SIMULATION' | 'HARDWARE';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  action_recommended?: string;
  is_read: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface ProposedAction {
  id: number;
  action: string;
  reason: string;
  soil_moisture_percent?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface SimulationStatus {
  status?: 'RUNNING' | 'PAUSED' | 'STOPPED';
  is_running: boolean;
  is_paused: boolean;
  speed: number;
  soil_moisture_percent: number;
  current_moisture?: number;
  dry_threshold?: number;
  target_moisture?: number;
  temperature_c: number;
  humidity_percent: number;
  light_raw: number;
  rain_detected: boolean;
  rain_active?: boolean;
  sensor_fault: boolean;
  pump_state: 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAULT' | 'UNKNOWN';
  pump_started_at?: string | null;
  session_runtime: number;
  last_decision_reason: string;
  last_decision_action: string;
  last_tick_time: string;
}

export interface DashboardData {
  system_status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  esp32_status: 'ONLINE' | 'OFFLINE' | 'STALE' | 'FAULT';
  rpi_status: 'ONLINE' | 'OFFLINE' | 'STALE' | 'FAULT';
  system_mode: 'SIMULATION' | 'HARDWARE';
  operating_mode: 'AUTO' | 'MANUAL';
  permission_mode: 'AUTHORIZED_AUTO' | 'ASK_BEFORE_ACTION' | 'MANUAL_CONTROL';
  pump_state: 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAULT' | 'UNKNOWN';
  latest_reading?: SensorReading | null;
  settings?: IrrigationSetting | null;
  latest_event?: IrrigationEvent | null;
  is_stale: boolean;
  stale_warning?: string | null;
  active_alerts_count: number;
  simulation_status?: SimulationStatus | null;
  pending_action?: ProposedAction | null;
  server_time: string;
}

export interface DeviceInfo {
  id: string;
  device_id: string;
  name: string;
  type: string;
  hardware: string;
  status: 'ONLINE' | 'OFFLINE' | 'STALE' | 'FAULT';
  firmware_version?: string;
  ip_address?: string;
  last_seen?: string;
  is_simulated?: boolean;
  description: string;
  last_reading?: string;
  raw_value?: number;
  pump_state?: string;
  metrics?: Record<string, string>;
}

export interface IrrigationStatus {
  device_id: string;
  system_mode: 'SIMULATION' | 'HARDWARE';
  permission_mode: 'AUTHORIZED_AUTO' | 'ASK_BEFORE_ACTION' | 'MANUAL_CONTROL';
  auto_mode_enabled: boolean;
  current_pump_state: 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'FAULT' | 'UNKNOWN';
  pump_started_at?: string | null;
  runtime_elapsed_secs: number;
  runtime_remaining_secs: number;
  cooldown_remaining_secs: number;
  max_runtime_limit_secs: number;
  last_command?: {
    command_id?: string;
    action?: string;
    status?: string;
    issued_at?: string;
    confirmed_pump_state?: string;
  } | null;
}

export interface DiagnosticsData {
  backend_status: string;
  database_connected: boolean;
  mqtt_broker_status: string;
  operating_mode: string;
  pump_state: string;
  last_esp32_heartbeat?: string | null;
  last_rpi_heartbeat?: string | null;
  last_telemetry_time?: string | null;
  last_command_time?: string | null;
  last_command_ack_status?: string | null;
  recent_errors: string[];
  active_alerts: any[];
  uptime_seconds: number;
}

export interface HardwareSettings {
  esp32_device_id?: string;
  rpi_device_id?: string;
  mqtt_broker?: string;
  mqtt_broker_host?: string;
  mqtt_port?: number;
  mqtt_broker_port?: number;
  mqtt_tls?: boolean;
  mqtt_use_tls?: boolean;
  mqtt_topic_prefix?: string;
  soil_sensor_type?: string;
  soil_raw_dry?: number;
  soil_raw_wet?: number;
  dht_type?: string;
  rain_active_low?: boolean;
  sampling_interval_seconds?: number;
  sensor_sampling_interval_secs?: number;
  heartbeat_interval_seconds?: number;
  heartbeat_interval_secs?: number;
  stale_timeout_seconds?: number;
  telemetry_freshness_threshold_secs?: number;
  sync_status?: string;
  last_sync_time?: string | null;
}

// Device Connection Settings
export interface DeviceConnectionSettings {
  id: number;
  active_mode: 'DIRECT_ESP32' | 'RPI_GATEWAY';
  direct_esp32_id: string;
  direct_esp32_ip: string;
  direct_esp32_protocol: string;
  direct_esp32_status: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';
  direct_last_verified_at?: string | null;
  direct_last_error?: string | null;
  rpi_device_id: string;
  rpi_ip: string;
  rpi_mqtt_host: string;
  rpi_mqtt_port: number;
  rpi_status: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';
  rpi_esp32_status: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';
  rpi_last_verified_at?: string | null;
  rpi_last_error?: string | null;
  updated_at: string;
}

export interface TestConnectionResult {
  connection_mode: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';
  tested_at: string;
  details: Record<string, any>;
  error?: string | null;
}

// Plant & Zone Management Types
export type WaterCategory = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ZonePlant {
  id: number;
  zone_id: string;
  plant_name: string;
  water_category: WaterCategory;
  desired_moisture_min: number;
  desired_moisture_max: number;
  target_moisture: number;
  pos_x: number;
  pos_y: number;
  width?: number;
  height?: number;
  watering_interval_days?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IrrigationZone {
  id: number;
  zone_id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  plant_categories?: string | null;
  controller_device_id: string;
  pump_device_id: string;
  soil_moisture_target: number;
  soil_moisture_dry_threshold: number;
  hysteresis_buffer: number;
  max_runtime_seconds: number;
  cooldown_minutes: number;
  auto_irrigation_enabled: boolean;
  is_active: boolean;
  notes?: string | null;
  current_pump_state: string;
  last_irrigated_at?: string | null;
  plant_count: number;
  created_at: string;
  updated_at: string;
}

export interface ZoneDetail extends IrrigationZone {
  plants: ZonePlant[];
  latest_reading?: SensorReading | null;
  hardware_status?: string;
}

export interface ZonePlanCalculation {
  zone_id: string;
  total_plants: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  calculated_target_moisture: number;
  calculated_dry_threshold: number;
  explanation: string;
  has_conflict: boolean;
  conflict_warning?: string | null;
  plants_summary: Array<{
    name: string;
    category: string;
    target: number;
    range: string;
  }>;
}

// ==================== CLOUD AI INTELLIGENCE TYPES ====================

export interface AIForecastPoint {
  timestamp: string;
  moisture_percent: number;
  is_forecast: boolean;
  confidence_min?: number | null;
  confidence_max?: number | null;
}

export interface AIForecastResponse {
  zone_id: string;
  current_moisture: number;
  forecast_30m?: number | null;
  forecast_60m?: number | null;
  confidence_interval_30m?: number[] | null;
  confidence_interval_60m?: number[] | null;
  trend_direction: 'DRYING' | 'STABLE' | 'RISING';
  model_type: string;
  model_version: string;
  data_quality: string;
  historical_samples_count: number;
  generated_at: string;
  warning_message?: string | null;
  forecast_curve: AIForecastPoint[];
}

export interface AIAnomalyResponse {
  id: number;
  event_id: string;
  zone_id?: string | null;
  device_id?: string | null;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: 'SENSOR' | 'IRRIGATION' | 'COMMUNICATION';
  anomaly_type: string;
  observed_evidence: string;
  explanation: string;
  suggested_action?: string | null;
  detection_method: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface AIRecommendationResponse {
  id: number;
  recommendation_id: string;
  zone_id: string;
  suggested_action: 'IRRIGATE' | 'WAIT' | 'INSPECT';
  proposed_duration_seconds: number;
  reason: string;
  current_moisture: number;
  target_moisture: number;
  dry_threshold: number;
  rain_detected: boolean;
  forecast_30m?: number | null;
  confidence: number;
  rules_version: string;
  generated_at: string;
  expires_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
  action_id?: number | null;
  is_expired: boolean;
}

export interface WaterEfficiencyResponse {
  zone_id: string;
  period_days: number;
  total_runtime_seconds: number;
  cycle_count: number;
  avg_moisture_gain: number;
  water_consumed_liters_estimate?: number | null;
  flow_rate_lpm: number;
  efficiency_score: number;
  inefficient_cycles_count: number;
  rain_watering_cycles_count: number;
  recommendations: string[];
  daily_runtimes: Array<{
    date: string;
    runtime_seconds: number;
    volume_liters: number;
  }>;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  supporting_records?: Record<string, any> | null;
  proposed_action?: {
    action_id: number;
    description: string;
    target_zone: string;
    duration_seconds: number;
    status: string;
  } | null;
  created_at: string;
}

export interface AIChatRequest {
  message: string;
  conversation_id?: string;
  zone_id?: string;
}

export interface AIChatResponse {
  conversation_id: string;
  role: string;
  content: string;
  supporting_records?: Record<string, any> | null;
  proposed_action?: {
    action_id: number;
    description: string;
    target_zone: string;
    duration_seconds: number;
    status: string;
  } | null;
  created_at: string;
}

// ==================== GARDEN PIPE & MOTOR DESIGNER TYPES ====================

export type GardenComponentType = 
  | 'WATER_SOURCE'
  | 'MOTOR_PUMP'
  | 'JUNCTION'
  | 'VALVE'
  | 'DRIP_OUTLET'
  | 'PLANT_ZONE';

export type PipeType = 'MAIN' | 'BRANCH';

export interface GardenComponent {
  id: string;
  type: GardenComponentType;
  name: string;
  x: number;
  y: number;
  status?: string;
  plant_id?: number | null;
  properties?: Record<string, any>;
}

export interface GardenPipe {
  id: string;
  type: PipeType;
  from_node_id: string;
  from_port: string;
  to_node_id: string;
  to_port: string;
  points?: Array<{ x: number; y: number }>;
  status?: string;
}

export interface GardenNetworkPayload {
  components: GardenComponent[];
  pipes: GardenPipe[];
  metadata?: Record<string, any>;
}

export interface NetworkValidationIssue {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  component_id?: string | null;
}

export interface NetworkValidationResponse {
  is_valid: boolean;
  status: 'VALID' | 'WARNING' | 'ERROR';
  total_components: number;
  total_pipes: number;
  has_water_source: boolean;
  has_motor_pump: boolean;
  connected_plant_ids: string[];
  unreachable_plant_ids: string[];
  reachable_zones_count: number;
  total_zones_count: number;
  issues: NetworkValidationIssue[];
  summary: string;
}

export interface GardenIrrigationTask {
  step: number;
  target_id: string;
  target_name: string;
  water_category: string;
  current_moisture: number;
  target_moisture: number;
  duration_seconds: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  supply_path: string[];
  valve_states?: Record<string, string>;
  explanation: string;
}

export interface GardenIrrigationPlanResponse {
  zone_id: string;
  generated_at: string;
  total_tasks: number;
  total_water_liters_estimate: number;
  flow_rate_lpm: number;
  unreachable_warnings: string[];
  tasks: GardenIrrigationTask[];
  summary: string;
}

