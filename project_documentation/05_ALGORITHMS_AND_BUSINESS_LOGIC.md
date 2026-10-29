# 05 — Comprehensive Algorithms & Business Logic Specification

**Project**: SmartIrrigate — vel greenish  
**Repository**: `Dhanush-D136/greenishai`  
**Investigation Date**: October 2026  
**Auditor**: Senior Systems Architect & Algorithm Specialist  

---

## 1. Overview of System Algorithms

SmartIrrigate relies on **10 core deterministic algorithms and business rules** that govern sensor data processing, motor actuation safety, environmental physics simulation, and multi-zone hardware contention prevention.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SMARTIRRIGATE ALGORITHM STACK                         │
├────────────────────────────────┬────────────────────────────────────────────┤
│ 1. 8-Sample ADC Noise Filter   │ Embedded moving average on ESP32 analog pin│
│ 2. Soil Moisture Calibration   │ Two-point linear interpolation (Air vs Cup)│
│ 3. 8-Rule Irrigation Engine    │ Multi-constraint deterministic state decider│
│ 4. Hysteresis Buffer Zone      │ Prevents rapid relay chattering            │
│ 5. Hardware Safety Watchdog    │ Autonomous 5-min timeout cutoff on ESP32   │
│ 6. 3-Stage Command Handshake   │ Closed-loop verification of motor state    │
│ 7. Soil Moisture Physics Loop  │ Diurnal evaporation & saturation curves    │
│ 8. Crop Water Plan Analyzer    │ Multi-plant averaging & conflict detector  │
│ 9. Single-Pump Arbiter         │ Hardware contention prevention across zones│
│ 10. Offline SQLite Buffer      │ Edge store-and-forward telemetry queue     │
└────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 2. Algorithm Detailed Breakdown

### Algorithm 1: 8-Sample Analog Moving Average Filter
- **Location**: [`firmware/esp32/smartirrigate_esp32.ino:244-250`](file:///c:/Users/User/Desktop/SmartIrrigate/firmware/esp32/smartirrigate_esp32.ino#L244-L250)
- **Purpose**: Suppresses high-frequency electrical noise and ADC jitter on ESP32 ADC1.
- **Inputs**: Successive 12-bit ADC reads from `PIN_SOIL_ADC` (GPIO 34).
- **Logic**:
  $$\text{Raw}_{\text{filtered}} = \frac{1}{N} \sum_{i=1}^{N} \text{analogRead}(\text{GPIO 34}), \quad N = 8$$
  A 5ms delay is inserted between successive reads to allow the internal sample-and-hold capacitor to recharge.
- **Output**: Stabilized integer ADC value $[0, 4095]$.

---

### Algorithm 2: Two-Point Linear Soil Calibration
- **Location**: [`firmware/esp32/smartirrigate_esp32.ino:235-241`](file:///c:/Users/User/Desktop/SmartIrrigate/firmware/esp32/smartirrigate_esp32.ino#L235-L241) and [`backend/app/services/mqtt_service.py:140-142`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/services/mqtt_service.py#L140-L142)
- **Purpose**: Converts inverse analog voltage to calibrated percentage volumetric moisture content.
- **Mathematical Formula**:
  $$\text{Moisture}_{\%} = \text{clamp}\left( \frac{\text{DRY\_RAW} - \text{Raw}}{\text{DRY\_RAW} - \text{WET\_RAW}} \times 100, \quad 0.0, \quad 100.0 \right)$$
  Where:
  - $\text{DRY\_RAW} = 3200$ (Dry air calibration)
  - $\text{WET\_RAW} = 1400$ (Water immersion calibration)
- **Example Calculation**:
  If raw ADC reading is $2300$:
  $$\text{Moisture}_{\%} = \frac{3200 - 2300}{3200 - 1400} \times 100 = \frac{900}{1800} \times 100 = 50.0\%$$

---

### Algorithm 3: Hysteresis Thresholding & Anti-Chattering
- **Location**: [`backend/app/services/irrigation_engine.py:157-163`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/services/irrigation_engine.py#L157-L163)
- **Purpose**: Prevents rapid relay cycling (chattering) when soil moisture hovers near a single threshold.
- **State Transition Graph**:
  ```mermaid
  stateDiagram-v2
      [*] --> PumpOFF
      
      PumpOFF --> PumpON : Soil < Dry Threshold (e.g. 35%)
      PumpOFF --> PumpOFF : Soil in Buffer (35% to 70%) -> HOLD
      
      PumpON --> PumpOFF : Soil >= Target (e.g. 70%)
      PumpON --> PumpON : Soil in Buffer (35% to 70%) -> HOLD (Keep watering)
  ```
- **Hysteresis Buffer**:
  $$\Delta = \text{Target Moisture} - \text{Dry Threshold} = 70.0\% - 35.0\% = 35.0\%$$
  The pump only starts below $35.0\%$ and only stops above $70.0\%$. Between $35.0\%$ and $70.0\%$, the engine preserves the current pump state without flapping.

---

### Algorithm 4: 3-Stage Physical Command Handshake State Machine
- **Location**: [`backend/app/models/models.py:101-114`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/models/models.py#L101-L114) and [`frontend/src/components/PumpControlModal.tsx`](file:///c:/Users/User/Desktop/SmartIrrigate/frontend/src/components/PumpControlModal.tsx)
- **Purpose**: Ensures the UI never claims the pump is watering until the physical relay acknowledges electrical closure.
- **State Sequence**:
  ```
  [Stage 1: SENT]
     Operator clicks "Start Pump" -> Backend issues command to MQTT topic
     Status = "SENT", expires_at = now + 15 seconds
        ↓
  [Stage 2: ACKNOWLEDGED]
     ESP32 receives command -> sets GPIO 23 HIGH -> publishes to command-ack
     Backend receives ACK -> updates DB status to "ACKNOWLEDGED"
        ↓
  [Stage 3: CONFIRMED]
     ESP32 telemetry reports confirmed_pump_state = "ON"
     Backend sets authoritative state to "RUNNING"
     WebSocket broadcasts state -> UI displays green glowing "Watering Active"
  ```
- **Timeout / Rejection Handling**:
  If the ESP32 is offline or the ACK is not received before `expires_at`, the command status transitions to `TIMED_OUT` and an error alert is presented to the operator.

---

### Algorithm 5: Soil Evaporation and Wetting Dynamics Simulation
- **Location**: [`backend/app/services/simulation_service.py:289-350`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/services/simulation_service.py#L289-L350)
- **Purpose**: Generates realistic physical telemetry curves for testing without hardware connected.
- **Formulas**:
  1. **When Pump is RUNNING** (Saturation Phase):
     $$\text{Moisture}_{t+\Delta t} = \min\left(98.0\%, \quad \text{Moisture}_t + (1.0\% \times \text{speed})\right)$$
  2. **When Pump is OFF** (Evaporative Drydown Phase):
     $$\text{Moisture}_{t+\Delta t} = \max\left(12.0\%, \quad \text{Moisture}_t - (0.08\% \times \text{speed})\right)$$
  3. **Diurnal Temperature & Humidity Oscillation**:
     Let $h \in [0, 23]$ be the current hour of the day.
     $$\text{IsDay} = (6 \le h \le 18)$$
     $$\text{TargetTemp} = 22.0^{\circ}\text{C} + (6.0^{\circ}\text{C} \text{ if IsDay else } 1.0^{\circ}\text{C})$$
     $$\text{Temp}_{t+\Delta t} = \text{Temp}_t + 0.05 \times (\text{TargetTemp} - \text{Temp}_t) + \mathcal{U}(-0.1, 0.1)$$
     $$\text{TargetHumidity} = 75.0\% - (18.0\% \text{ if IsDay else } 4.0\%)$$
     $$\text{Humidity}_{t+\Delta t} = \text{Humidity}_t + 0.05 \times (\text{TargetHumidity} - \text{Humidity}_t) + \mathcal{U}(-0.2, 0.2)$$

---

### Algorithm 6: Single-Pump Hardware Contention Arbiter
- **Location**: [`backend/app/api/zones.py:31-64`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/api/zones.py#L31-L64) and [`tests/integration/test_zones_and_connections.py:238-263`](file:///c:/Users/User/Desktop/SmartIrrigate/tests/integration/test_zones_and_connections.py#L238-L263)
- **Problem**: When a user creates 3 software zones (Zone 1, Zone 2, Zone 3) but all 3 are mapped to the same single physical relay `pump-zone-01`, starting Zone 1 must not allow Zone 2 to trigger a duplicate or conflicting command.
- **Arbiter Logic**:
  1. The backend inspects `state_manager.get_authoritative_pump_state()`.
  2. If the authoritative physical pump is already `RUNNING`:
     - Any subsequent attempt to trigger another zone sharing `pump_device_id` returns HTTP 409 or is queued.
     - The UI prominently flags: `"⚠️ Shared Pump Active: Physical pump is currently supplying water to Zone 1."`
  3. Stopping the pump in any zone safely de-energizes the physical relay and updates all linked zones to `OFF`.

---

### Algorithm 7: Edge Offline Telemetry Buffering & Store-and-Forward
- **Location**: [`edge/raspberry_pi/edge_service.py:122-132`](file:///c:/Users/User/Desktop/SmartIrrigate/edge/raspberry_pi/edge_service.py#L122-L132)
- **Purpose**: Prevents telemetry loss during internet dropouts.
- **Logic**:
  1. ESP32 publishes to local Mosquitto broker on Raspberry Pi.
  2. `edge_service.py` receives telemetry and inserts a row into local SQLite table `offline_telemetry`:
     ```sql
     INSERT INTO offline_telemetry (device_id, timestamp, soil_moisture_percent, temperature_c, humidity_percent, light_raw, rain_detected, pump_state, synced_upstream)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);
     ```
  3. When upstream cloud connection is verified, a background thread batches rows where `synced_upstream = 0`, POSTs them to `/api/sensors/ingest-batch`, and marks `synced_upstream = 1`.

