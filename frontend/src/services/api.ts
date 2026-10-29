import type {
  AuthResponse,
  DashboardData,
  DeviceInfo,
  IrrigationStatus,
  IrrigationSetting,
  IrrigationEvent,
  SensorReading,
  DiagnosticsData,
  HardwareSettings,
  SystemAlert,
  SimulationStatus,
  User,
  DeviceConnectionSettings,
  TestConnectionResult,
  IrrigationZone,
  ZoneDetail,
  ZonePlant,
  ZonePlanCalculation,
  AIForecastResponse,
  AIAnomalyResponse,
  AIRecommendationResponse,
  WaterEfficiencyResponse,
  AIChatRequest,
  AIChatResponse,
  GardenNetworkPayload,
  NetworkValidationResponse,
  GardenIrrigationPlanResponse
} from '../types';

export let rawBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'https://greenishai.onrender.com' : '');
if (rawBase.includes('greenishai-backend.onrender.com')) {
  rawBase = rawBase.replace('greenishai-backend.onrender.com', 'greenishai.onrender.com');
}
export const API_BASE = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('smartirrigate_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) errorMsg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  async checkHealth(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string }>(res);
  },

  // Authentication
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse<AuthResponse>(res);
  },

  async register(email: string, password: string, full_name?: string): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name })
    });
    return handleResponse<User>(res);
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<User>(res);
  },

  // Dashboard Overview
  async getDashboard(): Promise<DashboardData> {
    const res = await fetch(`${API_BASE}/dashboard`);
    return handleResponse<DashboardData>(res);
  },

  // Operating Mode & Permissions
  async getSystemMode(): Promise<{ status: string; system_mode: 'SIMULATION' | 'HARDWARE'; permission_mode: string; pump_state: string }> {
    const res = await fetch(`${API_BASE}/settings/mode`);
    return handleResponse(res);
  },

  async setSystemMode(mode: 'SIMULATION' | 'HARDWARE'): Promise<{ status: string; mode: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ mode })
    });
    return handleResponse(res);
  },

  async getPermissionMode(): Promise<{ status: string; permission_mode: 'AUTHORIZED_AUTO' | 'ASK_BEFORE_ACTION' | 'MANUAL_CONTROL' }> {
    const res = await fetch(`${API_BASE}/irrigation/permission`);
    return handleResponse(res);
  },

  async setPermissionMode(permission_mode: 'AUTHORIZED_AUTO' | 'ASK_BEFORE_ACTION' | 'MANUAL_CONTROL'): Promise<{ status: string; permission_mode: string; message: string }> {
    const res = await fetch(`${API_BASE}/irrigation/permission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ permission_mode })
    });
    return handleResponse(res);
  },

  async decideProposedAction(action_id: number, decision: 'APPROVE' | 'REJECT'): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/irrigation/approve-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ action_id, decision })
    });
    return handleResponse(res);
  },

  // Devices
  async getDevices(): Promise<{ devices: DeviceInfo[]; count: number; timestamp: string }> {
    const res = await fetch(`${API_BASE}/devices`);
    return handleResponse<{ devices: DeviceInfo[]; count: number; timestamp: string }>(res);
  },

  // Sensors & History Telemetry
  async getLatestSensor(mode?: string): Promise<SensorReading | null> {
    const url = mode ? `${API_BASE}/sensors/latest?mode=${mode}` : `${API_BASE}/sensors/latest`;
    const res = await fetch(url);
    return handleResponse<SensorReading | null>(res);
  },

  async getSensorHistory(hours: number = 24, mode?: string): Promise<SensorReading[]> {
    const modeParam = mode ? `&mode=${mode}` : '';
    const res = await fetch(`${API_BASE}/sensors/history?hours=${hours}&limit=500${modeParam}`);
    return handleResponse<SensorReading[]>(res);
  },

  getExportUrl(hours: number = 168, mode?: string): string {
    const modeParam = mode ? `&mode=${mode}` : '';
    return `${API_BASE}/sensors/export?hours=${hours}${modeParam}`;
  },

  // Irrigation Controls & Authoritative State
  async getIrrigationStatus(): Promise<IrrigationStatus> {
    const res = await fetch(`${API_BASE}/irrigation/status`);
    return handleResponse<IrrigationStatus>(res);
  },

  async sendIrrigationCommand(
    action: 'START_PUMP' | 'STOP_PUMP' | 'EMERGENCY_STOP',
    duration_seconds?: number,
    reason?: string
  ): Promise<{ command_id: string; message: string; status: string }> {
    const res = await fetch(`${API_BASE}/irrigation/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ action, duration_seconds, reason })
    });
    return handleResponse<{ command_id: string; message: string; status: string }>(res);
  },

  async setIrrigationMode(auto_mode_enabled: boolean): Promise<{ message: string; auto_mode_enabled: boolean }> {
    const res = await fetch(`${API_BASE}/irrigation/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ auto_mode_enabled })
    });
    return handleResponse<{ message: string; auto_mode_enabled: boolean }>(res);
  },

  async getIrrigationEvents(limit: number = 50, mode?: string): Promise<IrrigationEvent[]> {
    const modeParam = mode ? `&mode=${mode}` : '';
    const res = await fetch(`${API_BASE}/irrigation/events?limit=${limit}${modeParam}`);
    return handleResponse<IrrigationEvent[]>(res);
  },

  // Critical Alerts Management
  async getAlerts(status?: string, severity?: string, mode?: string): Promise<SystemAlert[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    if (mode) params.append('mode', mode);
    const res = await fetch(`${API_BASE}/alerts?${params.toString()}`);
    return handleResponse<SystemAlert[]>(res);
  },

  async acknowledgeAlert(alert_id: number): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/alerts/${alert_id}/acknowledge`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async resolveAlert(alert_id: number): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/alerts/${alert_id}/resolve`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Settings
  async getSettings(): Promise<IrrigationSetting> {
    const res = await fetch(`${API_BASE}/settings`);
    return handleResponse<IrrigationSetting>(res);
  },

  async updateSettings(settings: Partial<IrrigationSetting>): Promise<IrrigationSetting> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(settings)
    });
    return handleResponse<IrrigationSetting>(res);
  },

  async getHardwareSettings(): Promise<HardwareSettings> {
    const res = await fetch(`${API_BASE}/settings/hardware`);
    return handleResponse<HardwareSettings>(res);
  },

  async updateHardwareSettings(data: Partial<HardwareSettings>): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/hardware`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async testBackendConnection(): Promise<{ status: string; latency_ms: number; database: string }> {
    const res = await fetch(`${API_BASE}/settings/test-backend`, { method: 'POST' });
    return handleResponse(res);
  },

  async testBackend(): Promise<{ status: string; latency_ms: number; database: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/test-backend`, { method: 'POST' });
    return handleResponse(res);
  },

  async testMqttConnection(): Promise<{ status: string; broker: string; message: string; connected: boolean }> {
    const res = await fetch(`${API_BASE}/settings/test-mqtt`, { method: 'POST' });
    return handleResponse(res);
  },

  async testMqtt(): Promise<{ status: string; broker: string; message: string; connected: boolean }> {
    const res = await fetch(`${API_BASE}/settings/test-mqtt`, { method: 'POST' });
    return handleResponse(res);
  },

  async checkDeviceStatus(): Promise<{ esp32_status: string; rpi_status: string; checked_at: string; status: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/check-device-status`, { method: 'POST' });
    return handleResponse(res);
  },

  async requestFreshTelemetry(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/request-telemetry`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async requestTelemetry(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/settings/request-telemetry`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async synchronizeConfiguration(): Promise<{ status: string; message: string; sync_time?: string; sync_status?: string; edge_target?: string; synced_at?: string }> {
    const res = await fetch(`${API_BASE}/settings/sync-config`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async syncConfig(): Promise<{ status: string; message: string; sync_time?: string; sync_status?: string; edge_target?: string; synced_at?: string }> {
    const res = await fetch(`${API_BASE}/settings/sync-config`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Diagnostics
  async getDiagnostics(): Promise<DiagnosticsData> {
    const res = await fetch(`${API_BASE}/system/diagnostics`);
    return handleResponse<DiagnosticsData>(res);
  },

  // Simulation Engine Controls
  async getSimulationStatus(): Promise<SimulationStatus> {
    const res = await fetch(`${API_BASE}/simulation/status`);
    const data = await handleResponse<any>(res);
    const sim = data.simulation || {};
    return {
      ...sim,
      status: sim.is_running ? (sim.is_paused ? 'PAUSED' : 'RUNNING') : 'STOPPED',
      current_moisture: sim.soil_moisture_percent,
      dry_threshold: 35.0,
      target_moisture: 70.0,
      rain_active: sim.rain_detected
    };
  },

  // Simulation Engine Controls
  async controlSimulation(action: 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'RESET', initial_moisture?: number): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/simulation/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, initial_moisture })
    });
    return handleResponse(res);
  },

  async setSimulationSpeed(speed: number): Promise<{ status: string; speed: number }> {
    const res = await fetch(`${API_BASE}/simulation/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    });
    return handleResponse(res);
  },

  async setSimulationMoisture(soil_moisture_percent: number): Promise<{ status: string; soil_moisture_percent: number }> {
    const res = await fetch(`${API_BASE}/simulation/moisture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soil_moisture_percent })
    });
    return handleResponse(res);
  },

  async toggleSimulationRain(): Promise<{ status: string; rain_detected: boolean }> {
    const res = await fetch(`${API_BASE}/simulation/toggle-rain`, { method: 'POST' });
    return handleResponse(res);
  },

  async toggleSimulationFault(): Promise<{ status: string; sensor_fault: boolean }> {
    const res = await fetch(`${API_BASE}/simulation/toggle-fault`, { method: 'POST' });
    return handleResponse(res);
  },

  async seedDemoHistory(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/simulation/seed-demo-history`, {
      method: 'POST'
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  // Device Connection API
  async getConnectionSettings(): Promise<DeviceConnectionSettings> {
    const res = await fetch(`${API_BASE}/settings/connection`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<DeviceConnectionSettings>(res);
  },

  async updateConnectionSettings(payload: Partial<DeviceConnectionSettings>): Promise<DeviceConnectionSettings> {
    const res = await fetch(`${API_BASE}/settings/connection`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse<DeviceConnectionSettings>(res);
  },

  async testDirectEsp32(): Promise<TestConnectionResult> {
    const res = await fetch(`${API_BASE}/settings/connection/test-esp32`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<TestConnectionResult>(res);
  },

  async testRpiGateway(): Promise<TestConnectionResult> {
    const res = await fetch(`${API_BASE}/settings/connection/test-gateway`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<TestConnectionResult>(res);
  },

  // Zones Management API
  async getZones(): Promise<IrrigationZone[]> {
    const res = await fetch(`${API_BASE}/zones`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<IrrigationZone[]>(res);
  },

  async createZone(payload: any): Promise<IrrigationZone> {
    const res = await fetch(`${API_BASE}/zones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse<IrrigationZone>(res);
  },

  async getZoneDetail(zoneId: string): Promise<ZoneDetail> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ZoneDetail>(res);
  },

  async updateZone(zoneId: string, payload: any): Promise<IrrigationZone> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse<IrrigationZone>(res);
  },

  async deleteZone(zoneId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  async toggleZoneAutonomy(zoneId: string, enabled: boolean): Promise<{ status: string; auto_irrigation_enabled: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/autonomy`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ auto_irrigation_enabled: enabled })
    });
    return handleResponse(res);
  },

  async irrigateZone(zoneId: string, action: 'START' | 'STOP', durationSeconds?: number, reason?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/irrigate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({
        action,
        duration_seconds: durationSeconds,
        reason
      })
    });
    return handleResponse(res);
  },

  // Plant Layout & Water Planning API
  async getZonePlants(zoneId: string): Promise<ZonePlant[]> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/plants`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ZonePlant[]>(res);
  },

  async addZonePlant(zoneId: string, payload: Partial<ZonePlant>): Promise<ZonePlant> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/plants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse<ZonePlant>(res);
  },

  async updateZonePlant(zoneId: string, plantId: number, payload: Partial<ZonePlant>): Promise<ZonePlant> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/plants/${plantId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse<ZonePlant>(res);
  },

  async deleteZonePlant(zoneId: string, plantId: number): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/plants/${plantId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  async saveBulkLayout(zoneId: string, plants: Partial<ZonePlant>[]): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/layout`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ plants })
    });
    return handleResponse(res);
  },

  async calculateZonePlan(zoneId: string): Promise<ZonePlanCalculation> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/calculate-plan`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ZonePlanCalculation>(res);
  },

  async applyZonePlan(zoneId: string, targetMoisture: number, dryThreshold: number): Promise<{ status: string; message: string; soil_moisture_target: number; soil_moisture_dry_threshold: number }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/apply-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({
        soil_moisture_target: targetMoisture,
        soil_moisture_dry_threshold: dryThreshold
      })
    });
    return handleResponse(res);
  },

  // ==================== CLOUD AI INTELLIGENCE ====================

  async getAIForecast(zoneId: string): Promise<AIForecastResponse> {
    const res = await fetch(`${API_BASE}/ai/forecast/${encodeURIComponent(zoneId)}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AIForecastResponse>(res);
  },

  async getAIAnomalies(params?: { status?: string; zone_id?: string; category?: string; limit?: number }): Promise<AIAnomalyResponse[]> {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.zone_id) q.append('zone_id', params.zone_id);
    if (params?.category) q.append('category', params.category);
    if (params?.limit) q.append('limit', params.limit.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${API_BASE}/ai/anomalies${qs}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AIAnomalyResponse[]>(res);
  },

  async triggerAIAnomalyScan(): Promise<{ status: string; scanned_at: string; new_anomalies_count: number; anomalies: AIAnomalyResponse[] }> {
    const res = await fetch(`${API_BASE}/ai/anomalies/scan`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async acknowledgeAIAnomaly(eventId: string): Promise<AIAnomalyResponse> {
    const res = await fetch(`${API_BASE}/ai/anomalies/${encodeURIComponent(eventId)}/acknowledge`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AIAnomalyResponse>(res);
  },

  async resolveAIAnomaly(eventId: string): Promise<AIAnomalyResponse> {
    const res = await fetch(`${API_BASE}/ai/anomalies/${encodeURIComponent(eventId)}/resolve`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AIAnomalyResponse>(res);
  },

  async getAIRecommendations(params?: { zone_id?: string; status?: string; limit?: number }): Promise<AIRecommendationResponse[]> {
    const q = new URLSearchParams();
    if (params?.zone_id) q.append('zone_id', params.zone_id);
    if (params?.status) q.append('status', params.status);
    if (params?.limit) q.append('limit', params.limit.toString());
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${API_BASE}/ai/recommendations${qs}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AIRecommendationResponse[]>(res);
  },

  async evaluateAIRecommendation(zoneId: string): Promise<AIRecommendationResponse> {
    const res = await fetch(`${API_BASE}/ai/recommendations/evaluate/${encodeURIComponent(zoneId)}`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AIRecommendationResponse>(res);
  },

  async approveAIRecommendation(recommendationId: string): Promise<{ status: string; recommendation: any; action: any }> {
    const res = await fetch(`${API_BASE}/ai/recommendations/${encodeURIComponent(recommendationId)}/approve`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async rejectAIRecommendation(recommendationId: string): Promise<{ status: string; recommendation_id: string }> {
    const res = await fetch(`${API_BASE}/ai/recommendations/${encodeURIComponent(recommendationId)}/reject`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getWaterEfficiency(zoneId: string, days: number = 7): Promise<WaterEfficiencyResponse> {
    const res = await fetch(`${API_BASE}/ai/water-efficiency/${encodeURIComponent(zoneId)}?days=${days}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<WaterEfficiencyResponse>(res);
  },

  async sendAIChat(message: string, conversationId?: string, zoneId?: string): Promise<AIChatResponse> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        zone_id: zoneId
      })
    });
    return handleResponse<AIChatResponse>(res);
  },

  // ==================== GARDEN PIPE & MOTOR DESIGNER ====================

  async getGardenNetwork(zoneId: string): Promise<{ zone_id: string; network: GardenNetworkPayload; validation: NetworkValidationResponse }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/network`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async saveGardenNetwork(zoneId: string, payload: GardenNetworkPayload): Promise<{ status: string; message: string; network: GardenNetworkPayload; validation: NetworkValidationResponse }> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/network`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  async validateGardenNetwork(zoneId: string, payload: GardenNetworkPayload): Promise<NetworkValidationResponse> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/network/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  async generateGardenIrrigationPlan(zoneId: string, payload: GardenNetworkPayload): Promise<GardenIrrigationPlanResponse> {
    const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/network/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  }
};
