# 01 — Project File Map & Source Code Inventory

**Project**: SmartIrrigate — vel greenish  
**Repository**: `Dhanush-D136/greenishai`  
**Investigation Date**: October 2026  
**Auditor**: Senior Full-Stack Software Architect, IoT & AI Systems Engineer  

---

## 1. Project Root & Application Directory Structure

```
SmartIrrigate/
├── .env.example                               # Environment variable blueprint
├── .gitignore                                 # Git ignore patterns
├── docker-compose.yml                         # Container orchestration (FastAPI, Postgres, Mosquitto, Frontend)
├── pytest.ini                                 # Pytest test discovery configuration
├── README.md                                  # Repository overview and quickstart guide
├── check_db.py                                # Utility script to inspect database initialization
│
├── backend/                                   # FastAPI Cloud & Edge Application
│   ├── Dockerfile                             # Production Python 3.12 slim container with dynamic PORT support
│   ├── requirements.txt                       # Backend Python dependencies
│   ├── app/
│   │   ├── main.py                            # FastAPI application entrypoint, CORS, lifespan, and route mounts
│   │   ├── api/                               # Modular API route controllers
│   │   │   ├── alerts.py                      # Alert retrieval, acknowledge, resolve endpoints
│   │   │   ├── auth.py                        # JWT authentication, login, profile, password change
│   │   │   ├── dashboard.py                   # Consolidated dashboard telemetry, pump status, summary
│   │   │   ├── devices.py                     # Device CRUD, heartbeats, status, calibration parameters
│   │   │   ├── diagnostics.py                 # Telemetry metrics, queue depth, health, system diagnostics
│   │   │   ├── irrigation.py                  # Pump controls, settings, history, proposed actions
│   │   │   ├── sensors.py                     # Historical telemetry queries, CSV export
│   │   │   ├── settings.py                    # Connection architecture (Direct vs RPi) and thresholds
│   │   │   ├── simulation.py                  # Simulation engine controls, state injection, pause/resume
│   │   │   ├── ws.py                          # WebSocket endpoint for real-time live updates
│   │   │   └── zones.py                       # Zone management, plant layout designer, water plan analysis
│   │   ├── core/                              # Fundamental configuration & database setup
│   │   │   ├── config.py                      # Pydantic v2 Settings, environment variable loading
│   │   │   ├── database.py                    # SQLAlchemy engine, SessionLocal, Base declarative model
│   │   │   └── security.py                    # Password hashing (bcrypt) and JWT encoding/decoding
│   │   ├── models/                            # Persistent SQLAlchemy ORM database models
│   │   │   └── models.py                      # 14 Database table models
│   │   ├── schemas/                           # Pydantic v2 validation contracts
│   │   │   └── schemas.py                     # Request/response data models
│   │   └── services/                          # Asynchronous services and business logic engines
│   │       ├── irrigation_engine.py           # Deterministic rule-based irrigation decision engine
│   │       ├── mqtt_service.py                # Paho MQTT 2.0 client, subscriptions, message router
│   │       ├── simulation_service.py          # Multi-threaded software physics simulation engine
│   │       ├── state_manager.py               # Authoritative system mode and pump state coordinator
│   │       └── websocket_manager.py           # Active WebSocket connection broker and broadcaster
│
├── frontend/                                  # React 19 + TypeScript + Vite Web Application
│   ├── Dockerfile                             # Multi-stage production Nginx container
│   ├── package.json                           # Frontend npm dependencies and scripts
│   ├── package-lock.json                      # Locked npm dependency tree
│   ├── tsconfig.json                          # TypeScript root configuration
│   ├── tsconfig.app.json                      # Application TypeScript compiler settings
│   ├── tsconfig.node.json                     # Node/Vite build tool TypeScript configuration
│   ├── vite.config.ts                         # Vite configuration with Tailwind CSS v4 & dev proxies
│   ├── vercel.json                            # Vercel SPA client-side routing & API reverse proxy configuration
│   ├── index.html                             # Single Page Application HTML root
│   ├── public/                                # Static visual assets
│   │   ├── assets/                            # Brand logos and planter hero images
│   │   └── favicon.svg                        # SVG tree-sprout brand favicon
│   └── src/
│       ├── main.tsx                           # React DOM root render
│       ├── App.tsx                            # React Router v7 routes, ProtectedRoute, Global modals
│       ├── index.css                          # Tailwind CSS v4 directives, custom animations, custom scrollbars
│       ├── App.css                            # Glassmorphism and specialized layout styles
│       ├── types/
│       │   └── index.ts                       # Complete TypeScript interface contracts
│       ├── services/
│       │   └── api.ts                         # Fetch client with auto-fallback to live Render backend
│       ├── context/
│       │   ├── AuthContext.tsx                # JWT session management, login, logout, user profile state
│       │   └── RealtimeContext.tsx            # Resilient WebSocket connection provider with auto-reconnect
│       ├── components/                        # Reusable modular UI components
│       │   ├── Navbar.tsx                     # Top navigation, mode indicator, simulator toggle, profile menu
│       │   ├── BottomNav.tsx                  # Mobile portrait bottom navigation bar
│       │   ├── DeviceConnectionSection.tsx    # Dual ESP32 architecture selector & connectivity diagnostics
│       │   ├── PlantLayoutDesigner.tsx        # Interactive SVG drag-and-drop crop planner & conflict analysis
│       │   ├── PumpControlModal.tsx           # 3-Stage verified pump command actuator modal
│       │   └── SimulatorDrawer.tsx            # Slide-out interactive physics simulation testing rig
│       └── pages/                             # Application views
│           ├── DashboardPage.tsx              # Telemetry cards, charts, pump card, emergency controls
│           ├── DevicesPage.tsx                # Device hardware registry, calibration, and status
│           ├── DiagnosticsPage.tsx            # System health metrics, queue depth, MQTT status
│           ├── HistoryPage.tsx                # Historical telemetry data tables and CSV export
│           ├── IrrigationPage.tsx             # Threshold sliders, auto-rules, proposed action approvals
│           ├── LoginPage.tsx                  # Split-screen responsive login with pre-configured admin fill
│           ├── SettingsPage.tsx               # System operating mode, hardware configuration, connection tabs
│           └── ZonesPage.tsx                  # Zone-wise irrigation management, water plans, plant layouts
│
├── edge/                                      # Edge Gateway Firmware & Daemons
│   └── raspberry_pi/
│       └── edge_service.py                    # Autonomous Python edge gateway with offline SQLite buffer
│
├── firmware/                                  # Embedded Microcontroller Firmware
│   └── esp32/
│       └── smartirrigate_esp32.ino            # C++ Arduino firmware for ESP32 DevKit V1 with safety watchdog
│
├── simulator/                                 # Standalone Hardware Mocks
│   └── device_mock.py                         # CLI script for mock MQTT telemetry injection
│
├── infra/                                     # Infrastructure Configuration
│   └── mosquitto/
│       └── mosquitto.conf                     # Mosquitto MQTT broker configuration
│
├── docs/                                      # Deployment Documentation
│   └── commissioning_guide.md                 # Hardware assembly, flashing, and provisioning runbook
│
└── tests/                                     # Automated Test Suite (21 Passing Tests)
    ├── __init__.py
    ├── integration/
    │   ├── __init__.py
    │   ├── test_api.py                        # Health, auth, dashboard, and simulation API tests
    │   └── test_zones_and_connections.py      # Zone CRUD, plant conflict detection, single-pump safety
    └── unit/
        ├── __init__.py
        ├── test_irrigation_engine.py          # Unit tests for 8 rules of IrrigationEngine
        └── test_pump_and_simulation.py        # Pump authoritative state, moisture dynamics, mode safety
```

---

## 2. Comprehensive File Inventory & Categorization Table

| File / Relative Path | Technology | Purpose | Core Content | Why It Exists | Main Dependencies | Called By / Used By | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `backend/app/main.py` | Python / FastAPI | Application Entrypoint | App initialization, CORS, DB default seeding, lifespan manager, route aggregation | Bootstraps the backend, starts MQTT and Simulation threads, mounts routers | `fastapi`, `sqlalchemy`, `mqtt_service`, `simulation_service` | Uvicorn server (`CMD` in Dockerfile) | **Implemented & Verified** |
| `backend/app/core/config.py` | Python / Pydantic | App Configuration | `Settings` class with environment variable parsing (`.env`) | Provides type-safe global configuration | `pydantic-settings` | All backend modules | **Implemented & Verified** |
| `backend/app/core/database.py` | Python / SQLAlchemy | DB Session Engine | SQLite/PostgreSQL connection string, `engine`, `SessionLocal`, `Base`, `get_db` | Manages relational database transactions and connections | `sqlalchemy` | `main.py`, all API routers, models | **Implemented & Verified** |
| `backend/app/core/security.py` | Python / Passlib & JWT | Auth & Security | Password hashing (`bcrypt`), verification, JWT token generation & decode | Secures API endpoints and manages operator credentials | `bcrypt`, `passlib`, `pyjwt` | `auth.py`, `main.py`, dependencies | **Implemented & Verified** |
| `backend/app/models/models.py` | Python / SQLAlchemy | ORM Database Schema | 14 database table classes (`User`, `Device`, `SensorReading`, `SystemState`, `IrrigationZone`, etc.) | Defines relational structure and data persistence | `sqlalchemy` | `database.py`, all services & routes | **Implemented & Verified** |
| `backend/app/schemas/schemas.py` | Python / Pydantic v2 | Data Contracts | Request and response validation models with type annotations | Validates HTTP payload formats and serializes responses | `pydantic`, `email-validator` | All API routes | **Implemented & Verified** |
| `backend/app/services/irrigation_engine.py` | Python | Rule Engine | `IrrigationEngine.evaluate()` with 8 deterministic safety rules | Decides when to START, STOP, or HOLD watering | Standard library (`datetime`, `dataclasses`) | `mqtt_service.py`, `simulation_service.py`, `irrigation.py`, unit tests | **Implemented & Verified** |
| `backend/app/services/simulation_service.py` | Python / Threading | Physics Simulator | Background thread simulating diurnal temperature, moisture drying, pump wetting | Allows testing and demo without physical sensors or motors connected | `threading`, `time`, `random`, `sqlalchemy` | `main.py`, `simulation.py`, `state_manager.py` | **Implemented & Verified** |
| `backend/app/services/state_manager.py` | Python | State Coordinator | `SystemStateManager` managing mode switches and authoritative pump state | Eliminates state conflicts between Simulator and Hardware modes | `sqlalchemy`, `simulation_service`, `mqtt_service` | `main.py`, `settings.py`, `irrigation.py`, `zones.py` | **Implemented & Verified** |
| `backend/app/services/mqtt_service.py` | Python / Paho MQTT | MQTT Bridge | Ingests sensor telemetry, dispatches actuator commands, processes ACKs | Interfaces cloud backend with physical edge/ESP32 hardware | `paho-mqtt`, `sqlalchemy`, `irrigation_engine` | `main.py`, `state_manager.py`, `irrigation.py` | **Implemented & Verified** |
| `backend/app/services/websocket_manager.py` | Python / WebSockets | Live Broadcaster | Connection pool and JSON broadcast dispatcher | Pushes sub-second telemetry and pump state changes to web dashboard | `fastapi.WebSocket` | `simulation_service.py`, `mqtt_service.py`, `ws.py` | **Implemented & Verified** |
| `backend/app/api/auth.py` | Python / FastAPI | Auth Routes | `/api/auth/login`, `/api/auth/me`, `/api/auth/change-password` | Handles operator login and session identity | `security.py`, `models.py`, `schemas.py` | Frontend `AuthContext.tsx` | **Implemented & Verified** |
| `backend/app/api/dashboard.py` | Python / FastAPI | Dashboard Data | `/api/dashboard/summary`, `/api/dashboard/live` | Delivers aggregated telemetry, charts, and pump state | `models.py`, `state_manager.py`, `simulation_service.py` | Frontend `DashboardPage.tsx` | **Implemented & Verified** |
| `backend/app/api/devices.py` | Python / FastAPI | Device Management | `/api/devices`, `/api/devices/{id}`, `/api/devices/{id}/calibration` | Lists devices, logs heartbeats, updates sensor calibration offsets | `models.py`, `schemas.py` | Frontend `DevicesPage.tsx` | **Implemented & Verified** |
| `backend/app/api/diagnostics.py` | Python / FastAPI | System Diagnostics | `/api/diagnostics/summary`, `/api/diagnostics/queue-depth` | Provides telemetry message rates, health status, and failure logs | `models.py`, `mqtt_service.py` | Frontend `DiagnosticsPage.tsx` | **Implemented & Verified** |
| `backend/app/api/irrigation.py` | Python / FastAPI | Irrigation Controls | `/api/irrigation/pump/start`, `/pump/stop`, `/emergency-stop`, `/proposed-action` | Executes pump actuation commands and updates automation thresholds | `state_manager.py`, `irrigation_engine.py`, `models.py` | Frontend `IrrigationPage.tsx`, `PumpControlModal.tsx` | **Implemented & Verified** |
| `backend/app/api/sensors.py` | Python / FastAPI | Sensor History | `/api/sensors/history`, `/api/sensors/export-csv` | Queries time-series telemetry and exports CSV reports | `models.py`, `schemas.py`, `csv` | Frontend `HistoryPage.tsx` | **Implemented & Verified** |
| `backend/app/api/settings.py` | Python / FastAPI | Settings & Connection | `/api/settings/mode`, `/api/settings/connection`, `/connection/test-esp32` | Configures system mode and tests hardware connectivity | `state_manager.py`, `models.py` | Frontend `SettingsPage.tsx`, `DeviceConnectionSection.tsx` | **Implemented & Verified** |
| `backend/app/api/simulation.py` | Python / FastAPI | Simulator Controls | `/api/simulation/status`, `/start`, `/stop`, `/inject`, `/toggle-rain` | Gives frontend full control over simulated physical environmental variables | `simulation_service.py` | Frontend `SimulatorDrawer.tsx` | **Implemented & Verified** |
| `backend/app/api/ws.py` | Python / FastAPI | Live Stream Route | `/ws/live` WebSocket connection handler | Maintains bidirectional streaming socket with dashboard | `websocket_manager.py` | Frontend `RealtimeContext.tsx` | **Implemented & Verified** |
| `backend/app/api/zones.py` | Python / FastAPI | Zone & Plant API | `/api/zones`, `/api/zones/{id}/plants`, `/calculate-plan`, `/apply-plan` | Zone CRUD, SVG plant placement, crop water plan & conflict analysis | `models.py`, `schemas.py`, `state_manager.py` | Frontend `ZonesPage.tsx`, `PlantLayoutDesigner.tsx` | **Implemented & Verified** |
| `firmware/esp32/smartirrigate_esp32.ino` | C++ / Arduino | Field Firmware | Reads capacitive soil, DHT22, LDR, rain sensors; controls relay; publishes MQTT | Runs directly on ESP32 DevKit V1 microcontrollers in the field | `WiFi.h`, `PubSubClient.h`, `ArduinoJson.h`, `DHT.h` | Physical ESP32 Hardware | **Implemented & Verified** |
| `edge/raspberry_pi/edge_service.py` | Python 3 | Edge Daemon | Local Mosquitto bridge, local SQLite buffer, autonomous offline rule evaluation | Provides field autonomy when internet connectivity to cloud is broken | `paho-mqtt`, `sqlite3` | Raspberry Pi 4B Linux Host | **Implemented & Verified** |
| `frontend/src/App.tsx` | TypeScript / React | UI Router & Shell | React Router tree, ProtectedRoute wrapper, Top navbar, BottomNav, Global modals | Master visual orchestrator of the web frontend | `react-router-dom`, `AuthContext`, `RealtimeContext` | Browser Client Entry | **Implemented & Verified** |
| `frontend/src/services/api.ts` | TypeScript | API Client | Type-safe fetch wrapper with JWT injection and auto-fallback to live backend | Handles all REST communications with FastAPI backend | Standard Fetch API | All frontend pages and components | **Implemented & Verified** |
| `frontend/src/context/AuthContext.tsx` | TypeScript / React | Session Context | Stores JWT in localStorage, provides `user`, `login()`, `logout()`, `isLoading` | Preserves operator login across browser sessions | `React.createContext`, `api.ts` | `App.tsx`, `LoginPage.tsx`, `Navbar.tsx` | **Implemented & Verified** |
| `frontend/src/context/RealtimeContext.tsx` | TypeScript / React | WebSocket Context | Auto-reconnecting WebSocket client providing `lastMessage` and `isConnected` | Feeds live telemetry and motor state to UI widgets without polling | Standard WebSocket API | `DashboardPage.tsx`, `SimulatorDrawer.tsx` | **Implemented & Verified** |
| `frontend/src/components/Navbar.tsx` | TypeScript / React | Header Component | Brand header, mode badge (Simulator vs Hardware), Simulator toggle, Logout | Top-level navigation and system mode switching | `lucide-react`, `AuthContext` | `App.tsx` | **Implemented & Verified** |
| `frontend/src/components/BottomNav.tsx` | TypeScript / React | Mobile Navigation | Sticky mobile bottom bar with icons for Dashboard, Zones, Irrigation, Devices, Settings | Optimized mobile portrait navigation | `lucide-react`, `react-router-dom` | `App.tsx` | **Implemented & Verified** |
| `frontend/src/components/DeviceConnectionSection.tsx` | TypeScript / React | Connection UI | Direct ESP32 vs RPi Gateway selector, live ping test, step-by-step connection wizard | Manages and visualizes the dual connection architecture | `api.ts`, `lucide-react` | `SettingsPage.tsx` | **Implemented & Verified** |
| `frontend/src/components/PlantLayoutDesigner.tsx` | TypeScript / React | SVG Plant Planner | Drag-and-drop 2D plant positioning, water requirement categorization, conflict warning | Visual plant layout planner with water contention warnings | `lucide-react`, `api.ts` | `ZonesPage.tsx` | **Implemented & Verified** |
| `frontend/src/components/PumpControlModal.tsx` | TypeScript / React | Actuator Modal | 3-Stage physical command verification modal (Sent -> Ack -> Confirmed) | Prevents accidental watering and confirms physical relay state | `api.ts`, `lucide-react` | `App.tsx`, `DashboardPage.tsx`, `IrrigationPage.tsx` | **Implemented & Verified** |
| `frontend/src/components/SimulatorDrawer.tsx` | TypeScript / React | Test Rig Drawer | Slide-out panel to inject moisture, rain, sensor fault, speed up time, test pump | Allows examiners and operators to test physical edge cases on demand | `api.ts`, `RealtimeContext` | `App.tsx`, `DashboardPage.tsx` | **Implemented & Verified** |
| `frontend/src/pages/DashboardPage.tsx` | TypeScript / React | Main View | Live metric gauges, telemetry history chart, pump status banner, quick controls | Primary operational monitoring dashboard | `recharts`, `api.ts`, `RealtimeContext` | `App.tsx` (`/`) | **Implemented & Verified** |
| `frontend/src/pages/DevicesPage.tsx` | TypeScript / React | Device Registry | List of registered controllers, sync status, sensor calibration offsets | Hardware inventory management view | `api.ts`, `lucide-react` | `App.tsx` (`/devices`) | **Implemented & Verified** |
| `frontend/src/pages/DiagnosticsPage.tsx` | TypeScript / React | System Health | Metric summary, queue depths, error logs, MQTT connection status | Technical diagnostics view for engineers | `api.ts`, `lucide-react` | `App.tsx` (`/diagnostics`) | **Implemented & Verified** |
| `frontend/src/pages/HistoryPage.tsx` | TypeScript / React | Telemetry Logs | Filterable table of past sensor readings and one-click CSV export | Audit log and telemetry archive view | `api.ts`, `lucide-react` | `App.tsx` (`/history`) | **Implemented & Verified** |
| `frontend/src/pages/IrrigationPage.tsx` | TypeScript / React | Irrigation Rules | Auto-mode toggles, threshold sliders (Dry trigger, Target moisture), Proposed Action cards | Automation policy and manual control center | `api.ts`, `lucide-react` | `App.tsx` (`/irrigation`) | **Implemented & Verified** |
| `frontend/src/pages/LoginPage.tsx` | TypeScript / React | Login View | Nature-inspired split-screen login with pre-configured admin fill button | Authenticates operators into the system | `AuthContext`, `lucide-react` | `App.tsx` (`/login`) | **Implemented & Verified** |
| `frontend/src/pages/SettingsPage.tsx` | TypeScript / React | System Settings | Mode toggle (Simulation vs Hardware), Permission mode, Connection architecture tabs | Administrative configuration center | `api.ts`, `DeviceConnectionSection.tsx` | `App.tsx` (`/settings`) | **Implemented & Verified** |
| `frontend/src/pages/ZonesPage.tsx` | TypeScript / React | Zone Management | Zone cards, status indicators, plant counts, interactive layout designer drawer | Zone-wise micro-climate irrigation manager | `api.ts`, `PlantLayoutDesigner.tsx` | `App.tsx` (`/zones`) | **Implemented & Verified** |
| `simulator/device_mock.py` | Python 3 | CLI Test Script | Standalone CLI script publishing fake MQTT telemetry | Simulates an ESP32 publishing over MQTT for local testing | `paho-mqtt` | Developer Terminal | **Implemented & Verified** |
| `tests/integration/test_api.py` | Python / Pytest | API Tests | Tests health endpoint, dashboard read, devices list, admin login, command ACK | Verifies core REST endpoints operate without error | `pytest`, `fastapi.testclient` | Pytest Runner | **Executed & Passing** (5/5) |
| `tests/integration/test_zones_and_connections.py` | Python / Pytest | Zone & Conn Tests | Tests connection mode switching, offline accuracy, zone CRUD, plant conflicts, single-pump safety | Verifies dual-mode switching and plant water calculation safety | `pytest`, `fastapi.testclient` | Pytest Runner | **Executed & Passing** (6/6) |
| `tests/unit/test_irrigation_engine.py` | Python / Pytest | Engine Unit Tests | Tests 8 rules: dry start, target stop, rain pause, runtime cutoff, cooldown, invalid sensor | Proves deterministic behavior of rule-based irrigation engine | `pytest`, `irrigation_engine` | Pytest Runner | **Executed & Passing** (6/6) |
| `tests/unit/test_pump_and_simulation.py` | Python / Pytest | Physics Unit Tests | Tests authoritative pump initial state, start/stop, soil moisture saturation curve, mode safety | Proves simulation engine and state coordinator safety | `pytest`, `simulation_service`, `state_manager` | Pytest Runner | **Executed & Passing** (4/4) |
| `docker-compose.yml` | YAML / Compose | Deployment Spec | Multi-container definition: PostgreSQL, Mosquitto MQTT, FastAPI Backend, React Frontend | Containerized production deployment blueprint | Docker Compose | Docker Engine | **Implemented Spec** |
| `frontend/vercel.json` | JSON | Host Routing Spec | Single Page Application rewrites (`/(.*) -> /index.html`) & reverse proxy to Render | Ensures client routing & API proxying work on Vercel | Vercel Edge Network | Vercel Platform | **Implemented & Live** |
| `check_db.py` | Python | Scratch Script | Tests DB table creation directly | Quick verification of SQLite table creation | `sqlite3` | Ad-hoc CLI inspection | **Auxiliary Utility** |

---

## 3. Subsystem Classification & Entry Points

- **Frontend Entry**: [`frontend/src/main.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/main.tsx) mounting [`frontend/src/App.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/App.tsx).
- **Backend Entry**: [`backend/app/main.py`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/main.py) executed via Uvicorn.
- **Embedded Firmware Entry**: [`firmware/esp32/smartirrigate_esp32.ino`](file:///c:/Users/User/Desktop/SmartIrrigate/firmware/esp32/smartirrigate_esp32.ino) `setup()` and `loop()`.
- **Edge Gateway Entry**: [`edge/raspberry_pi/edge_service.py`](file:///c:/Users/User/Desktop/SmartIrrigate/edge/raspberry_pi/edge_service.py) `__main__` loop.
- **State Coordinator**: [`backend/app/services/state_manager.py`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/services/state_manager.py).
- **Core Business Logic**: [`backend/app/services/irrigation_engine.py`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/services/irrigation_engine.py) and [`backend/app/api/zones.py`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/api/zones.py).

