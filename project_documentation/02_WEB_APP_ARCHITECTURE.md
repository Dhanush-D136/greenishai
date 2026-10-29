# 02 — Web Application Architecture: Frontend, Backend & Database

**Project**: SmartIrrigate — vel greenish  
**Repository**: `Dhanush-D136/greenishai`  
**Investigation Date**: October 2026  
**Auditor**: Senior Full-Stack Software Architect  

---

## 1. High-Level Full-Stack System Architecture

```mermaid
graph TD
    subgraph Client ["Frontend Client (React 19 + TypeScript + Vite)"]
        UI_Login["LoginPage.tsx (/login)"]
        UI_Dash["DashboardPage.tsx (/)"]
        UI_Zones["ZonesPage.tsx (/zones)"]
        UI_Irrig["IrrigationPage.tsx (/irrigation)"]
        UI_Devs["DevicesPage.tsx (/devices)"]
        UI_Hist["HistoryPage.tsx (/history)"]
        UI_Diag["DiagnosticsPage.tsx (/diagnostics)"]
        UI_Set["SettingsPage.tsx (/settings)"]
        
        Drawer["SimulatorDrawer.tsx"]
        Modal["PumpControlModal.tsx"]
        PlantDesigner["PlantLayoutDesigner.tsx"]
        
        AuthCtx["AuthContext.tsx (JWT in localStorage)"]
        RTCtx["RealtimeContext.tsx (WebSocket /ws/live)"]
        APIClient["services/api.ts (Fetch with Auth headers)"]
    end

    subgraph Server ["FastAPI Backend (Python 3.12)"]
        FastAPI_App["backend/app/main.py"]
        Router_Auth["/api/auth (auth.py)"]
        Router_Dash["/api/dashboard (dashboard.py)"]
        Router_Irrig["/api/irrigation (irrigation.py)"]
        Router_Zones["/api/zones (zones.py)"]
        Router_Devs["/api/devices (devices.py)"]
        Router_Sens["/api/sensors (sensors.py)"]
        Router_Set["/api/settings (settings.py)"]
        Router_Diag["/api/diagnostics (diagnostics.py)"]
        Router_Sim["/api/simulation (simulation.py)"]
        Router_WS["/ws/live (ws.py)"]
        
        Engine_Rules["irrigation_engine.py (8 Safety Rules)"]
        Engine_State["state_manager.py (Authoritative State)"]
        Engine_Sim["simulation_service.py (Background Thread)"]
        Service_MQTT["mqtt_service.py (Paho MQTT Client)"]
        Manager_WS["websocket_manager.py (Active Sockets)"]
    end

    subgraph Storage ["Database (SQLite / PostgreSQL)"]
        DB_Users["users"]
        DB_Devices["devices & device_heartbeats"]
        DB_Readings["sensor_readings"]
        DB_Settings["irrigation_settings & device_connection_settings"]
        DB_Zones["irrigation_zones & zone_plants"]
        DB_Events["irrigation_events & irrigation_commands"]
        DB_Alerts["system_alerts & audit_logs & proposed_actions"]
        DB_State["system_states"]
    end

    subgraph Hardware ["Physical Edge & IoT Layer"]
        ESP32["ESP32 Field Controller (smartirrigate_esp32.ino)"]
        RPi["Raspberry Pi 4B Gateway (edge_service.py)"]
        Broker["Mosquitto MQTT Broker (port 1883)"]
    end

    %% Communication Links
    APIClient -->|HTTPS REST| FastAPI_App
    RTCtx <-->|WSS Live Stream| Router_WS
    FastAPI_App --> Router_Auth & Router_Dash & Router_Irrig & Router_Zones & Router_Devs & Router_Sens & Router_Set & Router_Diag & Router_Sim & Router_WS
    
    Router_Irrig --> Engine_State & Engine_Rules
    Router_Zones --> DB_Zones
    Router_Dash --> Engine_State & DB_Readings
    Router_Sim --> Engine_Sim
    
    Service_MQTT <-->|TCP MQTT Topics| Broker
    ESP32 <-->|WiFi MQTT| Broker
    RPi <-->|Local MQTT & Offline SQLite| Broker
    
    FastAPI_App --> Storage
```

---

## 2. Frontend Architecture (React 19 + TypeScript + Vite)

### A. Technology & Framework Versions
- **Framework**: React 19.3.1 (`react`, `react-dom`)
- **Language**: TypeScript 7.0.2 (`tsconfig.app.json`, `tsconfig.json`)
- **Build Tool**: Vite 8.3.5 (`vite.config.ts`, `@vitejs/plugin-react` 6.1.2)
- **Styling**: Tailwind CSS v4.3.3 (`@tailwindcss/vite`, `clsx`, `tailwind-merge`)
- **Routing**: React Router DOM v7.18.5
- **Data Fetching & Caching**: TanStack React Query v5.105.0
- **Visualization**: Recharts v3.10.1 (ResponsiveContainer, AreaChart, LineChart)
- **Icons**: Lucide React v1.62.0

### B. Application Routing & Shell ([`frontend/src/App.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/App.tsx))
- **Entry Point**: [`frontend/src/main.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/main.tsx) creates the React 19 DOM root at element `#root`.
- **Protected Routing**: `ProtectedRoute` checks `useAuth().isAuthenticated`. Unauthenticated users attempting to view any route other than `/login` are immediately redirected via `<Navigate to="/login" replace />`.
- **Global Layout**:
  1. `<Navbar />`: Fixed top desktop navigation bar (hidden on `/login`).
  2. `<main>`: Responsive container (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`).
  3. `<BottomNav />`: Fixed bottom navigation for mobile portrait screens.
  4. `<SimulatorDrawer />`: Global slide-out testing drawer triggered from Navbar or Dashboard.
  5. `<PumpControlModal />`: Global 3-stage command actuator modal.

### C. Detailed Page-by-Page Technical Specification

#### 1. Login Page ([`frontend/src/pages/LoginPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/LoginPage.tsx))
- **Visuals**: Split-screen design. Left/Top displays nature-inspired photography, college brand badges ("Vel Tech High Tech"), and system highlights. Right/Bottom features the frosted glassmorphism login card.
- **Functionality**: Collects operator email and password. Includes a one-click button **"Use Pre-configured Farm Admin Credentials"** that pre-fills `admin@smartirrigate.io` / `SmartAdmin2026!`.
- **API Invocation**: Calls `api.login(email, password)` ➔ `POST /api/auth/login`.
- **Session Handshake**: On HTTP 200, extracts `access_token` and `user` object, commits them to `localStorage` via `AuthContext.login()`, and navigates to `/`.
- **Failure State**: Catches HTTP 401 or network errors and renders a red alert banner (`Failed to fetch`, `Invalid email or password`).

#### 2. Dashboard Page ([`frontend/src/pages/DashboardPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/DashboardPage.tsx))
- **Visuals**:
  1. **System Banner**: Current operating mode (`SIMULATION` vs `HARDWARE`), permission mode (`AUTHORIZED_AUTO`, `ASK_BEFORE_ACTION`, `MANUAL_CONTROL`), and quick mode switch button.
  2. **Authoritative Pump Status Card**: Live animation showing whether the physical pump relay is `RUNNING` or `OFF`, elapsed runtime, and an **"Emergency Stop"** red button.
  3. **Live Metric Gauges**: 4 cards displaying Soil Moisture (%), Ambient Temperature (°C), Relative Humidity (%), and Ambient Light (%).
  4. **Interactive 24-Hour Telemetry Graph**: Recharts Area chart plotting Soil Moisture vs Temperature with gradient fills.
  5. **Recent Irrigation Events Log**: Table detailing recent watering cycles, duration, and triggering reasons.
- **Data Source**: Polls `/api/dashboard/summary` every 4 seconds and consumes live WebSocket frames from `RealtimeContext` for instant sub-second gauge movement.

#### 3. Zones Page ([`frontend/src/pages/ZonesPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/ZonesPage.tsx))
- **Visuals**: Grid of micro-climate irrigation zone cards (e.g. "Zone 01 - Main Greenhouse", "Zone 02 - Arid Succulent Bed"). Shows target moisture, dry threshold, plant count, and pump state.
- **Functionality**:
  - Add, edit, or delete zones (`POST`, `PUT`, `DELETE /api/zones`).
  - Slide-out drawer mounting [`PlantLayoutDesigner.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/components/PlantLayoutDesigner.tsx).
- **Physical Boundary Transparency**: Clearly badges shared hardware. If multiple software zones share controller `esp32-zone-01`, turning on the pump in Zone 1 warns that physical water delivery will be directed according to hardware plumbing.

#### 4. Interactive Plant Layout Designer ([`frontend/src/components/PlantLayoutDesigner.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/components/PlantLayoutDesigner.tsx))
- **Visuals**: Interactive 2D graphical grid canvas representing the physical planter bed.
- **Features**:
  - Add crops (Tomato, Lettuce, Rosemary, Cactus, Strawberries, etc.) with water categories (`HIGH`, `MEDIUM`, `LOW`).
  - Drag and position plants on the 2D grid (`pos_x`, `pos_y`).
  - **Live Crop Plan Calculation**: Automatically invokes `/api/zones/{id}/calculate-plan` to compute weighted average target moisture.
  - **Water Requirement Conflict Warning**: If the bed contains both `HIGH` demand plants (e.g., Lettuce) and `LOW` demand plants (e.g., Rosemary/Cactus), renders a prominent amber alert explaining the risk of root rot under single-sensor watering.
  - **"Apply to Zone" Button**: Commits calculated thresholds directly to zone automation settings.

#### 5. Irrigation Control Page ([`frontend/src/pages/IrrigationPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/IrrigationPage.tsx))
- **Visuals**: Automation settings and threshold sliders.
- **Controls**:
  - **Auto Mode Enabled**: Master automation toggle.
  - **Dry Threshold Slider**: Soil moisture (%) below which irrigation starts (default: 35%).
  - **Target Moisture Slider**: Soil moisture (%) at which irrigation stops (default: 70%).
  - **Max Continuous Runtime Slider**: Watchdog shutoff safety limit (default: 300 seconds).
  - **Cooldown Interval Slider**: Minimum rest time between cycles (default: 30 minutes).
  - **Precautionary Rain Pause Toggle**: Halts watering if rain is detected.
  - **Proposed Action Card**: When in `ASK_BEFORE_ACTION` permission mode, displays pending recommendations with "Approve" and "Reject" buttons.

#### 6. Devices Page ([`frontend/src/pages/DevicesPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/DevicesPage.tsx))
- **Visuals**: Device hardware registry cards for ESP32 Field Controller and Raspberry Pi Edge Gateway.
- **Functionality**: Displays IP address, firmware version, RSSI signal strength (dBm), last seen timestamp, and calibration constants (`SOIL_DRY_RAW = 3200`, `SOIL_WET_RAW = 1400`).

#### 7. Settings Page ([`frontend/src/pages/SettingsPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/SettingsPage.tsx))
- **Visuals**:
  - System Operating Mode switcher (`SIMULATION` vs `HARDWARE`).
  - Permission Level selector (`AUTHORIZED_AUTO`, `ASK_BEFORE_ACTION`, `MANUAL_CONTROL`).
  - Mounts [`DeviceConnectionSection.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/components/DeviceConnectionSection.tsx).
- **Dual Architecture Selector**: Radio toggle between **Direct ESP32 Cloud Connection** and **Raspberry Pi 4B Edge Gateway**. Live "Test Connection" button executes non-destructive ping/socket probes.

#### 8. Diagnostics Page ([`frontend/src/pages/DiagnosticsPage.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/pages/DiagnosticsPage.tsx))
- **Visuals**: Technical engineering cards for message queue depths, MQTT broker connection status, database transaction latency, and active system alerts.

---

## 3. Backend Architecture (FastAPI + Python 3.12)

### A. Technology & Libraries
- **Framework**: FastAPI `>=0.110.0`
- **ASGI Server**: Uvicorn `[standard] >=0.28.0`
- **ORM / Database Engine**: SQLAlchemy `>=2.0.28`
- **Data Validation**: Pydantic `>=2.6.4`, `pydantic-settings >=2.2.1`, `email-validator >=2.1.0`
- **Security**: Passlib `>=1.7.4`, Bcrypt `>=4.0.0`, PyJWT `>=2.8.0`
- **IoT Protocols**: Paho MQTT `>=2.0.0`, WebSockets `>=12.0`
- **Drivers**: SQLite (standard library) and Psycopg2-binary `>=2.9.9` (PostgreSQL)

### B. Application Lifespan & Thread Management ([`backend/app/main.py`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/main.py))
FastAPI uses an `asynccontextmanager` lifespan handler:
1. **Startup**:
   - Calls `init_db_defaults()`: creates database tables via `Base.metadata.create_all()` and seeds default admin operator (`admin@smartirrigate.io`), default ESP32 device, default irrigation zone ("Zone 01"), starting plants, and initial `SystemState`.
   - Captures running async event loop via `asyncio.get_running_loop()`.
   - Starts `mqtt_service.set_async_loop(loop)` and `mqtt_service.start()`.
   - Starts `simulation_engine.set_async_loop(loop)` and `simulation_engine.start_loop()`.
2. **Shutdown**:
   - Stops `simulation_engine.stop_loop()`.
   - Disconnects `mqtt_service.stop()`.

### C. Complete API Route Reference Table

| Endpoint | HTTP Method | Implementation File & Function | Purpose | Request Body / Parameters | Response Schema | Auth Required | DB Models Accessed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | `api/auth.py:login()` | Authenticates operator, generates JWT | `UserLogin` (`email`, `password`) | `TokenResponse` (`access_token`, `token_type`, `user`) | No | `User` |
| `/api/auth/me` | `GET` | `api/auth.py:get_current_user_profile()` | Retrieves authenticated user profile | None | `UserResponse` | Yes (Bearer JWT) | `User` |
| `/api/auth/change-password` | `POST` | `api/auth.py:change_password()` | Updates operator password | `UserChangePassword` | `{"status": "SUCCESS"}` | Yes | `User` |
| `/api/dashboard/summary` | `GET` | `api/dashboard.py:get_dashboard_summary()` | Consolidated telemetry, status, charts | None | `DashboardData` | No (Public demo read) | `SensorReading`, `SystemState`, `Device` |
| `/api/dashboard/live` | `GET` | `api/dashboard.py:get_live_telemetry()` | Latest instantaneous sensor values | None | `SensorReadingResponse` | No | `SensorReading` |
| `/api/devices` | `GET` | `api/devices.py:list_devices()` | Lists registered hardware controllers | None | `List[DeviceInfo]` | No | `Device` |
| `/api/devices/{device_id}` | `GET` | `api/devices.py:get_device()` | Retrieves specific device details | Path `device_id` | `DeviceInfo` | No | `Device` |
| `/api/devices/{device_id}/calibration` | `PUT` | `api/devices.py:update_calibration()` | Updates sensor raw calibration | `DeviceCalibrationUpdate` | `DeviceInfo` | Yes | `Device` |
| `/api/irrigation/status` | `GET` | `api/irrigation.py:get_irrigation_status()` | Live pump state, mode, thresholds | None | `IrrigationStatus` | No | `SystemState`, `IrrigationSetting` |
| `/api/irrigation/settings` | `GET` | `api/irrigation.py:get_irrigation_settings()` | Active automation thresholds | `device_id` (query) | `IrrigationSettingSchema` | No | `IrrigationSetting` |
| `/api/irrigation/settings` | `PUT` | `api/irrigation.py:update_irrigation_settings()`| Updates thresholds (dry/target) | `IrrigationSettingUpdate` | `IrrigationSettingSchema` | Yes | `IrrigationSetting` |
| `/api/irrigation/pump/start` | `POST` | `api/irrigation.py:start_pump()` | Initiates watering cycle | `PumpStartRequest` (`duration`, `reason`) | `{"status": "SUCCESS", "command_id": ...}` | Yes | `IrrigationCommand`, `SystemState` |
| `/api/irrigation/pump/stop` | `POST` | `api/irrigation.py:stop_pump()` | Stops watering cycle | `PumpStopRequest` (`reason`) | `{"status": "SUCCESS"}` | Yes | `IrrigationCommand`, `SystemState` |
| `/api/irrigation/pump/emergency-stop` | `POST` | `api/irrigation.py:emergency_stop()` | Immediate hardware cut-off | None | `{"status": "EMERGENCY_STOP_TRIGGERED"}` | Yes | `IrrigationCommand`, `SystemState` |
| `/api/irrigation/proposed-action` | `GET` | `api/irrigation.py:get_proposed_action()` | Pending AI recommendation | None | `Optional[ProposedActionResponse]` | No | `ProposedAction` |
| `/api/irrigation/proposed-action/{id}/approve` | `POST` | `api/irrigation.py:approve_proposed_action()` | Approves AI recommendation | Path `id` | `{"status": "APPROVED"}` | Yes | `ProposedAction`, `SystemState` |
| `/api/irrigation/proposed-action/{id}/reject` | `POST` | `api/irrigation.py:reject_proposed_action()` | Rejects AI recommendation | Path `id` | `{"status": "REJECTED"}` | Yes | `ProposedAction` |
| `/api/zones` | `GET` | `api/zones.py:list_zones()` | Lists all micro-climate zones | None | `List[ZoneResponse]` | No | `IrrigationZone`, `ZonePlant` |
| `/api/zones` | `POST` | `api/zones.py:create_zone()` | Creates a new irrigation zone | `ZoneCreate` | `ZoneResponse` | Yes | `IrrigationZone` |
| `/api/zones/{zone_id}` | `GET` | `api/zones.py:get_zone()` | Retrieves zone details & plants | Path `zone_id` | `ZoneDetailResponse` | No | `IrrigationZone`, `ZonePlant` |
| `/api/zones/{zone_id}/plants` | `POST` | `api/zones.py:add_plant()` | Adds crop to zone layout | `PlantCreate` | `PlantResponse` | Yes | `ZonePlant` |
| `/api/zones/{zone_id}/layout` | `PUT` | `api/zones.py:bulk_update_layout()` | Saves 2D SVG plant positions | `BulkLayoutUpdateRequest` | `List[PlantResponse]` | Yes | `ZonePlant` |
| `/api/zones/{zone_id}/calculate-plan` | `GET` | `api/zones.py:calculate_zone_plan()` | Computes water plan & conflicts | Path `zone_id` | `ZonePlanCalculationResponse` | No | `IrrigationZone`, `ZonePlant` |
| `/api/zones/{zone_id}/apply-plan` | `POST` | `api/zones.py:apply_zone_plan()` | Applies calculated plan to zone | `ApplyZoneSettingsRequest` | `{"status": "SUCCESS"}` | Yes | `IrrigationZone` |
| `/api/sensors/history` | `GET` | `api/sensors.py:get_sensor_history()` | Historical readings with time filter | `hours`, `limit` (query) | `List[SensorReadingResponse]` | No | `SensorReading` |
| `/api/sensors/export-csv` | `GET` | `api/sensors.py:export_csv()` | Downloads sensor readings as CSV | `hours` (query) | `StreamingResponse` (text/csv) | No | `SensorReading` |
| `/api/settings/mode` | `GET` | `api/settings.py:get_system_mode()` | Current system & permission mode | None | `{"system_mode": ..., "permission_mode": ...}` | No | `SystemState` |
| `/api/settings/mode` | `POST` | `api/settings.py:set_system_mode()` | Switches Simulation vs Hardware | `SystemModeRequest` (`mode`) | `{"status": "SUCCESS", "mode": ...}` | Yes | `SystemState` |
| `/api/settings/connection` | `GET` | `api/settings.py:get_connection_settings()` | Dual ESP32 connection configs | None | `DeviceConnectionResponse` | No | `DeviceConnectionSetting` |
| `/api/settings/connection` | `PUT` | `api/settings.py:update_connection_settings()`| Updates active connection mode | `DeviceConnectionUpdate` | `DeviceConnectionResponse` | Yes | `DeviceConnectionSetting` |
| `/api/settings/connection/test-esp32` | `POST` | `api/settings.py:test_esp32_connection()` | Live probe of Direct ESP32 link | None | `TestConnectionResponse` | No | None (Socket probe) |
| `/api/settings/connection/test-gateway` | `POST` | `api/settings.py:test_gateway_connection()` | Live probe of RPi Gateway link | None | `TestConnectionResponse` | No | None (Socket probe) |
| `/api/simulation/status` | `GET` | `api/simulation.py:get_simulation_status()` | Simulation engine telemetry | None | `SimulationStatus` | No | Memory (SimulationEngine) |
| `/api/simulation/inject` | `POST` | `api/simulation.py:inject_telemetry()` | Overrides simulated sensor values | `SimulationInjectRequest` | `SimulationStatus` | Yes | Memory (SimulationEngine) |
| `/api/simulation/toggle-rain` | `POST` | `api/simulation.py:toggle_rain()` | Toggles simulated rain sensor | `{"rain": bool}` | `{"rain_detected": bool}` | Yes | Memory (SimulationEngine) |
| `/api/alerts` | `GET` | `api/alerts.py:list_alerts()` | Retrieves active alerts | `status` (query) | `List[SystemAlertResponse]` | No | `SystemAlert` |
| `/ws/live` | `WebSocket`| `api/ws.py:websocket_live_endpoint()` | Bidirectional live telemetry stream | WebSocket frames | JSON telemetry frames | No | Connected memory pool |

---

## 4. Database Architecture & Schema Specification

### A. Database Technology
- **Default / Development**: Local SQLite (`sqlite:///./smartirrigate.db`).
- **Production / Enterprise**: PostgreSQL via SQLAlchemy connection URL (`postgresql://user:pass@host:5432/dbname`).
- **Primary Schema Definition**: [`backend/app/models/models.py`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/models/models.py).

### B. Entity-Relationship Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ irrigation_commands : "issues"
    users ||--o{ audit_logs : "generates"
    
    devices ||--o{ sensor_readings : "reports"
    devices ||--o{ device_heartbeats : "sends"
    devices ||--o{ irrigation_settings : "configured_by"
    devices ||--o{ irrigation_commands : "receives"
    devices ||--o{ irrigation_events : "executes"
    devices ||--o{ system_alerts : "flags"
    
    irrigation_zones ||--o{ zone_plants : "contains"
    devices ||--o{ irrigation_zones : "controls"

    users {
        int id PK
        string email UK
        string hashed_password
        string full_name
        string role
        boolean is_active
        datetime created_at
    }

    devices {
        int id PK
        string device_id UK
        string name
        string device_type
        string status
        int soil_raw_dry
        int soil_raw_wet
        string ip_address
        datetime last_seen
        boolean is_simulated
    }

    sensor_readings {
        int id PK
        string device_id FK
        datetime timestamp
        int soil_moisture_raw
        float soil_moisture_percent
        float temperature_c
        float humidity_percent
        int light_raw
        float light_percent
        boolean rain_detected
        string pump_state
        boolean is_simulated
    }

    irrigation_settings {
        int id PK
        string device_id UK
        boolean auto_mode_enabled
        float dry_threshold_percent
        float target_moisture_percent
        int max_runtime_seconds
        int cooldown_minutes
        boolean rain_pause_enabled
        boolean daylight_only
    }

    irrigation_commands {
        int id PK
        string command_id UK
        string device_id FK
        string action
        datetime issued_at
        datetime expires_at
        string status
        datetime ack_received_at
        string confirmed_pump_state
        int issued_by_user_id FK
    }

    irrigation_events {
        int id PK
        string device_id FK
        string trigger_type
        string action
        datetime start_time
        datetime end_time
        int duration_seconds
        float start_soil_moisture
        float end_soil_moisture
        string reason
    }

    system_alerts {
        int id PK
        string device_id FK
        string severity
        string category
        string title
        string message
        string status
        boolean is_read
    }

    system_states {
        int id PK
        string operating_mode
        string permission_mode
        string authoritative_pump_state
        datetime pump_started_at
        datetime last_irrigation_end
    }

    proposed_actions {
        int id PK
        string action
        string reason
        float soil_moisture_percent
        float dry_threshold_percent
        string status
        datetime created_at
    }

    device_connection_settings {
        int id PK
        string active_mode
        string direct_esp32_id
        string direct_esp32_ip
        string direct_esp32_status
        string rpi_device_id
        string rpi_ip
        string rpi_status
    }

    irrigation_zones {
        int id PK
        string zone_id UK
        string name
        string controller_device_id FK
        float soil_moisture_target
        float soil_moisture_dry_threshold
        float hysteresis_buffer
        int max_runtime_seconds
        int cooldown_minutes
        string current_pump_state
    }

    zone_plants {
        int id PK
        string zone_id FK
        string plant_name
        string water_category
        float desired_moisture_min
        float desired_moisture_max
        float target_moisture
        float pos_x
        float pos_y
    }
```

---

## 5. End-to-End Request Lifecycle Example: Triggering a Pump Actuation

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operator (Browser)
    participant UI as PumpControlModal.tsx
    participant Auth as AuthContext (JWT)
    participant API as /api/irrigation/pump/start
    participant State as SystemStateManager
    participant DB as SQLite/PostgreSQL
    participant MQTT as MQTTService
    participant ESP as ESP32 (smartirrigate_esp32.ino)

    Operator->>UI: Clicks "Confirm Start Pump (5 mins)"
    UI->>Auth: Retrieves Bearer JWT token from localStorage
    UI->>API: POST /api/irrigation/pump/start {duration: 300, reason: "Manual remote"}
    API->>API: Validates JWT token and operator permissions
    API->>State: start_irrigation(duration=300)
    
    alt Mode == "SIMULATION"
        State->>DB: Records IrrigationEvent & SystemAlert (Simulated)
        State->>UI: HTTP 200 {status: "SUCCESS", pump_state: "RUNNING"}
        State-->>UI: WebSocket Broadcasts live state frame
    else Mode == "HARDWARE"
        State->>DB: Creates IrrigationCommand record (status: "SENT", expires_at: +15s)
        State->>MQTT: Publishes to smartirrigate/esp32-zone-01/commands
        MQTT->>ESP: MQTT Packet {command_id: "uuid", action: "START_PUMP"}
        ESP->>ESP: Verifies command and asserts GPIO 23 HIGH (Relay closes)
        ESP->>MQTT: Publishes to smartirrigate/esp32-zone-01/command-ack
        MQTT->>DB: Updates IrrigationCommand (status: "ACKNOWLEDGED", confirmed: "ON")
        MQTT->>State: Sets authoritative pump state to "RUNNING"
        API->>UI: HTTP 200 {status: "SUCCESS", command_id: "uuid"}
        MQTT-->>UI: WebSocket Broadcasts confirmed physical relay state
    end
    UI->>Operator: Modal transitions to Stage 3 ("State Confirmed: Pumping")
```

