# 08 — Security, Reliability, Code Quality & Gap Analysis

**Project**: SmartIrrigate — vel greenish  
**Repository**: `Dhanush-D136/greenishai`  
**Investigation Date**: October 2026  
**Auditor**: Senior Cybersecurity Auditor & Reliability Engineer  

---

## 1. Security Architecture & Threat Surface Overview

The security posture of SmartIrrigate was evaluated across 5 core domains:
1. **Identity & Access Management (IAM)**: Operator authentication, role-based authorization, JWT expiration.
2. **Transport Layer Security & Network**: MQTT broker authentication, REST API exposure, CORS boundaries.
3. **Database & Data Protection**: Injection prevention, ORM parameterization, secret management.
4. **Physical Actuation & Cyber-Physical Safety**: Protection against rogue commands, runaway watering, physical damage.
5. **Edge & Device Hardening**: Firmware credentials, Wi-Fi security, replay attack prevention.

---

## 2. Prioritized Findings & Vulnerability Matrix

| ID | Finding / Vulnerability | Evidence / File Reference | Impact | Severity | Recommended Fix | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Default Fallback Secret Key in Code** | [`backend/app/core/config.py:14`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/core/config.py#L14): `SECRET_KEY = os.getenv("SECRET_KEY", "smartirrigate-velgreenish-super-secure-key-2026-very-secret-token")` | If `SECRET_KEY` is omitted from production environment, an attacker could forge administrative JWT tokens | **HIGH** | Remove default string in production. Raise an error if `SECRET_KEY` is not explicitly set in production environment. | **P1 (High)** |
| **SEC-02** | **Hardcoded MQTT Credentials in Firmware** | [`firmware/esp32/smartirrigate_esp32.ino:48-49`](file:///c:/Users/User/Desktop/SmartIrrigate/firmware/esp32/smartirrigate_esp32.ino#L48-L49): `MQTT_USER = "smartirrigate_device"`, `MQTT_PASS = "secure_device_token_2026"` | Firmware strings in compiled binary can be extracted via flash dumping | **MEDIUM** | Use per-device provisioned TLS certificates (MQTTS on port 8883) or generate credentials dynamically via captive portal (`WiFiManager`). | **P2 (Medium)** |
| **SEC-03** | **Unencrypted MQTT (Port 1883)** | [`infra/mosquitto/mosquitto.conf`](file:///c:/Users/User/Desktop/SmartIrrigate/infra/mosquitto/mosquitto.conf) and [`config.py:20`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/core/config.py#L20) | Telemetry and actuator commands travel in plaintext over local Wi-Fi, vulnerable to local eavesdropping | **MEDIUM** | Enable TLS/SSL with X.509 client certificates on port 8883. | **P2 (Medium)** |
| **SEC-04** | **Permissive CORS Configuration** | [`backend/app/main.py:230`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/main.py#L230): `allow_origins=["*"]` | Allows any website in the browser to interact with the API if operator is logged in | **LOW** | Restrict `allow_origins` to explicitly approved production domains (e.g. `https://velgreenish.vercel.app`). | **P3 (Low)** |
| **REL-01** | **No Physical Contention Lock on Multi-Zone Shared Pumps** | [`backend/app/api/zones.py:89`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/api/zones.py#L89) | If multiple software zones map to the same physical pump `pump-zone-01`, starting Zone 1 while Zone 2 is scheduled could water both beds simultaneously unless solenoid valves exist | **MEDIUM** | Implement hardware valve multiplexing or software queue lock for zones sharing a physical pump. | **P2 (Medium)** |
| **REL-02** | **Database Reset on Ephemeral Containers (Render Free Tier)** | SQLite default file `smartirrigate.db` on Render without persistent disk | Render free web services restart on idle and wipe local disk | **MEDIUM** | Provision a managed PostgreSQL instance (e.g. Render Postgres or Supabase) and configure `DATABASE_URL`. | **P2 (Medium)** |

---

## 3. Verified Security Strengths & Defenses

1. **SQL Injection Immune**:
   All database access is conducted through SQLAlchemy 2.0 ORM query builders and parameterized statements. Zero raw string-interpolated SQL queries exist in the codebase.
2. **Password Cryptographic Hashing**:
   Operator passwords are salted and hashed using **Bcrypt** (`backend/app/core/security.py:verify_password()`). Passwords are never stored in plaintext.
3. **Command Expiration & Nonce Tokens**:
   Every actuation command is generated with a unique UUID (`command_id`) and an expiration timestamp (`expires_at = now + 15s`). The ESP32 rejects stale commands to prevent replay attacks:
   ```python
   # backend/app/services/state_manager.py:151
   expires_at = now + datetime.timedelta(seconds=15)
   ```
4. **Autonomous Hardware Watchdog**:
   The ESP32 firmware enforces an independent 5-minute hardware watchdog cutoff (`LOCAL_MAX_RUNTIME_MS = 300000`). Even if an attacker floods the network with malicious `START` commands, the physical firmware will physically de-energize the relay after 5 minutes.
5. **Sensor Range Validation**:
   [`backend/app/services/irrigation_engine.py:73`](file:///c:/Users/User/Desktop/SmartIrrigate/backend/app/services/irrigation_engine.py#L73) rejects any reading outside $[0\%, 100\%]$, protecting the rule engine from arithmetic overflow or erroneous triggering.

