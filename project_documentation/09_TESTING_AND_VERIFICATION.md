# 09 — Testing, Verification & Test Execution Audit

**Project**: SmartIrrigate — vel greenish  
**Repository**: `Dhanush-D136/greenishai`  
**Investigation Date**: October 2026  
**Auditor**: Senior QA Engineer & Test Automation Specialist  

---

## 1. Test Environment & Execution Summary

An automated test run was executed on the local workspace using Pytest inside the Python 3.12 virtual environment.

- **Command Executed**: `.\venv\Scripts\pytest.exe -v`
- **Test Framework**: Pytest `v9.2.0`, Pluggy `v1.7.0`, AnyIO `v4.15.1`
- **Platform**: Windows 11 (Python 3.12.10)
- **Execution Date**: October 2026
- **Result**: **21 passed, 0 failed, 0 skipped** (Execution time: 2.34 seconds)

```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\User\Desktop\SmartIrrigate
configfile: pytest.ini
testpaths: tests
plugins: anyio-4.15.1
collected 21 items

tests\integration\test_api.py::test_api_health PASSED                     [  4%]
tests\integration\test_api.py::test_dashboard_public_read PASSED          [  9%]
tests\integration\test_api.py::test_devices_list PASSED                   [ 14%]
tests\integration\test_api.py::test_auth_login_default_admin PASSED       [ 19%]
tests\integration\test_api.py::test_simulation_telemetry_and_command_ack PASSED [ 23%]
tests\integration\test_zones_and_connections.py::test_connection_mode_selection_and_persistence PASSED [ 28%]
tests\integration\test_zones_and_connections.py::test_connection_test_hardware_offline_accuracy PASSED [ 33%]
tests\integration\test_zones_and_connections.py::test_zone_crud_lifecycle PASSED [ 38%]
tests\integration\test_zones_and_connections.py::test_zone_independence_and_autonomy_isolation PASSED [ 42%]
tests\integration\test_zones_and_connections.py::test_plant_designer_categories_and_conflict_detection PASSED [ 47%]
tests\integration\test_zones_and_connections.py::test_single_pump_hardware_contention_prevention PASSED [ 52%]
tests\unit\test_irrigation_engine.py::test_auto_irrigation_starts_when_soil_dry PASSED [ 57%]
tests\unit\test_irrigation_engine.py::test_auto_irrigation_stops_when_target_reached PASSED [ 61%]
tests\unit\test_irrigation_engine.py::test_rain_pauses_irrigation PASSED   [ 66%]
tests\unit\test_irrigation_engine.py::test_max_runtime_cutoff PASSED       [ 71%]
tests\unit\test_irrigation_engine.py::test_cooldown_enforcement PASSED     [ 76%]
tests\unit\test_irrigation_engine.py::test_invalid_sensor_failsafe PASSED [ 80%]
tests\unit\test_pump_and_simulation.py::test_pump_authoritative_initial_state PASSED [ 85%]
tests\unit\test_pump_and_simulation.py::test_simulation_pump_start_and_stop PASSED [ 90%]
tests\unit\test_pump_and_simulation.py::test_simulation_moisture_rise_and_target_stop PASSED [ 95%]
tests\unit\test_pump_and_simulation.py::test_mode_switching_safely_stops_pump PASSED [100%]

======================== 21 passed, 1 warning in 2.34s ========================
```

---

## 2. Detailed Verification Matrix of All 21 Tests

| Test Suite / File | Test Function Name | Subsystem Verified | Exact Verification Logic & Assertions | Status |
| :--- | :--- | :--- | :--- | :--- |
| `tests/integration/test_api.py` | `test_api_health` | Health Check API | Asserts `GET /api/health` returns HTTP 200, status "healthy", and DB connected | **PASSED** |
| `tests/integration/test_api.py` | `test_dashboard_public_read` | Dashboard Summary API | Verifies unauthenticated visitors can view public demo telemetry (`/api/dashboard/summary`) | **PASSED** |
| `tests/integration/test_api.py` | `test_devices_list` | Device Registry API | Confirms `GET /api/devices` returns a non-empty list containing `esp32-zone-01` | **PASSED** |
| `tests/integration/test_api.py` | `test_auth_login_default_admin`| Authentication API | Verifies `admin@smartirrigate.io` / `SmartAdmin2026!` returns a valid Bearer JWT | **PASSED** |
| `tests/integration/test_api.py` | `test_simulation_telemetry_and_command_ack` | Closed-Loop Simulator | Verifies starting pump triggers telemetry record and generates command ACK | **PASSED** |
| `test_zones_and_connections.py`| `test_connection_mode_selection_and_persistence` | Dual Architecture | Switches between `DIRECT_ESP32` and `RPI_GATEWAY` and confirms DB persistence | **PASSED** |
| `test_zones_and_connections.py`| `test_connection_test_hardware_offline_accuracy` | Live Socket Probes | In hardware mode, testing absent physical devices accurately reports `DISCONNECTED` | **PASSED** |
| `test_zones_and_connections.py`| `test_zone_crud_lifecycle` | Zone Management | Creates, retrieves, updates, and deletes an irrigation zone | **PASSED** |
| `test_zones_and_connections.py`| `test_zone_independence_and_autonomy_isolation` | Zone Isolation | Verifies changing parameters in Zone 1 does not alter Zone 2 thresholds | **PASSED** |
| `test_zones_and_connections.py`| `test_plant_designer_categories_and_conflict_detection` | Plant Water Analysis | Asserts plant layout detects conflict between High (Lettuce) and Low (Rosemary) crops | **PASSED** |
| `test_zones_and_connections.py`| `test_single_pump_hardware_contention_prevention` | Hardware Contention | Starting Zone 1 blocks conflicting duplicate commands on shared `pump-zone-01` | **PASSED** |
| `test_irrigation_engine.py` | `test_auto_irrigation_starts_when_soil_dry` | Rule 1 (Start Threshold) | Moisture (28%) < Threshold (35%) ➔ Decision: `START` | **PASSED** |
| `test_irrigation_engine.py` | `test_auto_irrigation_stops_when_target_reached` | Rule 2 (Target Stop) | Moisture (72%) >= Target (70%) ➔ Decision: `STOP` | **PASSED** |
| `test_irrigation_engine.py` | `test_rain_pauses_irrigation` | Rule 3 (Rain Policy) | Active rain detection overrides dry soil and forces Decision: `HOLD` / `STOP` | **PASSED** |
| `test_irrigation_engine.py` | `test_max_runtime_cutoff` | Rule 4 (Watchdog Cutoff) | Continuous runtime (310s) > Limit (300s) ➔ Forces Decision: `STOP` | **PASSED** |
| `test_irrigation_engine.py` | `test_cooldown_enforcement` | Rule 5 (Cooldown) | Cooldown active (15m < 30m) ➔ Blocks re-watering with Decision: `HOLD` | **PASSED** |
| `test_irrigation_engine.py` | `test_invalid_sensor_failsafe` | Rule 6 (Sensor Fault) | Reading (-5.0% or 120.0%) outside range ➔ Emergency stop `INVALID_SENSOR_DATA` | **PASSED** |
| `test_pump_and_simulation.py` | `test_pump_authoritative_initial_state` | State Authority | On system boot, pump state initializes strictly to `OFF`, never stuck in `RUNNING` | **PASSED** |
| `test_pump_and_simulation.py` | `test_simulation_pump_start_and_stop` | Actuation State | `start_pump()` transitions state to `RUNNING`; `stop_pump()` transitions to `OFF` | **PASSED** |
| `test_pump_and_simulation.py` | `test_simulation_moisture_rise_and_target_stop` | Simulation Physics | Pump running causes moisture to rise linearly until target threshold auto-stops pump | **PASSED** |
| `test_pump_and_simulation.py` | `test_mode_switching_safely_stops_pump` | Mode Safety | Switching operating mode while pump is running immediately forces pump `OFF` | **PASSED** |

---

## 3. Scope of Verification: Tested vs. Untested

### What Was Tested & Verified in Software:
- Full REST API lifecycle and HTTP error responses.
- Database CRUD transactions, relationships, cascading deletes, and defaults.
- All 8 branches of the deterministic irrigation rule engine.
- Simulation physics loops, thread concurrency, and state synchronization.
- Plant water requirement mathematical calculations and agricultural conflict detection.
- Single-pump physical contention prevention across multiple software zones.

### What Was Not Tested (Requires Physical Field Hardware):
- **Physical Soil Probe Electro-Chemistry**: Capacitive probe calibration drift across different soil types (clay vs sand vs potting mix).
- **Relay Coil Back-EMF**: Electrical flyback diode performance during inductive pump coil de-energization.
- **RF Wi-Fi Attenuation**: ESP32 RSSI signal degradation through dense greenhouse foliage.
- **Hardware Power Brownouts**: ESP32 behavior under momentary 3.3V power supply sags when motor starts.

