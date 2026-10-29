import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, init_db_defaults
from backend.app.services.state_manager import state_manager

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db_defaults()

client = TestClient(app)

def get_auth_headers():
    login_resp = client.post("/api/auth/login", json={
        "email": "admin@smartirrigate.io",
        "password": "SmartAdmin2026!"
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# ==================== ACCEPTANCE TESTS: CONNECTION MODES ====================

def test_connection_mode_selection_and_persistence():
    """Verify Direct ESP32 and RPi Gateway modes can be switched, persisted, and retrieved."""
    headers = get_auth_headers()
    
    # 1. Switch to DIRECT_ESP32
    resp1 = client.put("/api/settings/connection", json={
        "active_mode": "DIRECT_ESP32",
        "direct_esp32_id": "esp32-zone-01",
        "direct_esp32_ip": "192.168.1.105",
        "direct_esp32_protocol": "MQTT"
    }, headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["active_mode"] == "DIRECT_ESP32"
    assert data1["direct_esp32_ip"] == "192.168.1.105"

    # Verify persistence via GET
    get1 = client.get("/api/settings/connection", headers=headers)
    assert get1.status_code == 200
    assert get1.json()["active_mode"] == "DIRECT_ESP32"

    # 2. Switch to RPI_GATEWAY
    resp2 = client.put("/api/settings/connection", json={
        "active_mode": "RPI_GATEWAY",
        "rpi_device_id": "rpi-edge-01",
        "rpi_ip": "192.168.1.200",
        "rpi_mqtt_host": "192.168.1.200",
        "rpi_mqtt_port": 1883
    }, headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["active_mode"] == "RPI_GATEWAY"
    assert data2["rpi_status"] == "UNKNOWN" # Invalided on switch

    # Verify persistence after switch
    get2 = client.get("/api/settings/connection", headers=headers)
    assert get2.status_code == 200
    assert get2.json()["active_mode"] == "RPI_GATEWAY"
    assert get2.json()["rpi_ip"] == "192.168.1.200"

def test_connection_test_hardware_offline_accuracy():
    """Failed/unreachable hardware connections must accurately report DISCONNECTED, never fake success."""
    # Ensure hardware mode
    state_manager.set_mode("HARDWARE")
    
    # Test Direct ESP32 in hardware mode when physical device is absent
    test_esp = client.post("/api/settings/connection/test-esp32")
    assert test_esp.status_code == 200
    res_esp = test_esp.json()
    assert res_esp["status"] == "DISCONNECTED"
    assert res_esp["error"] is not None
    assert "offline" in res_esp["error"].lower() or "unreachable" in res_esp["error"].lower()

    # Test RPi Gateway in hardware mode when physical gateway is absent
    test_gw = client.post("/api/settings/connection/test-gateway")
    assert test_gw.status_code == 200
    res_gw = test_gw.json()
    assert res_gw["status"] == "DISCONNECTED"
    assert res_gw["error"] is not None

    # Reset back to simulation mode
    state_manager.set_mode("SIMULATION")

# ==================== ACCEPTANCE TESTS: ZONE CRUD & INDEPENDENCE ====================

def test_zone_crud_lifecycle():
    """Verify complete CRUD lifecycle: Create, Read, Update, Delete with safety checks."""
    headers = get_auth_headers()

    # 1. CREATE Zone
    create_payload = {
        "zone_id": "test-zone-orchard",
        "name": "Zone Orchard — Fruit Trees",
        "description": "Drip irrigated citrus and stone fruit section",
        "location": "South Slope",
        "plant_categories": "Fruit Trees",
        "soil_moisture_target": 75.0,
        "soil_moisture_dry_threshold": 40.0,
        "max_runtime_seconds": 360,
        "cooldown_minutes": 45,
        "auto_irrigation_enabled": True
    }
    create_resp = client.post("/api/zones", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["zone_id"] == "test-zone-orchard"
    assert created["soil_moisture_target"] == 75.0

    # 2. READ Zone Detail
    detail_resp = client.get(f"/api/zones/{created['zone_id']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["name"] == "Zone Orchard — Fruit Trees"
    assert detail["auto_irrigation_enabled"] is True

    # 3. UPDATE Zone
    update_payload = {
        "name": "Zone Orchard — Citrus Grove",
        "soil_moisture_target": 78.0,
        "soil_moisture_dry_threshold": 45.0,
        "auto_irrigation_enabled": False
    }
    update_resp = client.put(f"/api/zones/{created['zone_id']}", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Zone Orchard — Citrus Grove"
    assert updated["soil_moisture_target"] == 78.0
    assert updated["auto_irrigation_enabled"] is False

    # 4. DELETE Zone
    del_resp = client.delete(f"/api/zones/{created['zone_id']}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "SUCCESS"

    # Verify 404 after deletion
    detail_after = client.get(f"/api/zones/{created['zone_id']}")
    assert detail_after.status_code == 404

def test_zone_independence_and_autonomy_isolation():
    """Updating Zone A must never alter Zone B; autonomy toggle must be independently scoped."""
    headers = get_auth_headers()

    # Create Zone A and Zone B
    client.post("/api/zones", json={
        "zone_id": "zone-alpha",
        "name": "Zone Alpha",
        "soil_moisture_target": 65.0,
        "soil_moisture_dry_threshold": 30.0,
        "auto_irrigation_enabled": True
    }, headers=headers)

    client.post("/api/zones", json={
        "zone_id": "zone-beta",
        "name": "Zone Beta",
        "soil_moisture_target": 80.0,
        "soil_moisture_dry_threshold": 50.0,
        "auto_irrigation_enabled": True
    }, headers=headers)

    # Disable autonomy specifically in Zone Alpha
    patch_resp = client.patch("/api/zones/zone-alpha/autonomy", json={
        "auto_irrigation_enabled": False
    }, headers=headers)
    assert patch_resp.status_code == 200

    # Zone Alpha must now be disabled
    alpha = client.get("/api/zones/zone-alpha").json()
    assert alpha["auto_irrigation_enabled"] is False

    # Zone Beta MUST remain enabled!
    beta = client.get("/api/zones/zone-beta").json()
    assert beta["auto_irrigation_enabled"] is True

    # Clean up test zones
    client.delete("/api/zones/zone-alpha", headers=headers)
    client.delete("/api/zones/zone-beta", headers=headers)

# ==================== ACCEPTANCE TESTS: PLANT WATER DESIGNER ====================

def test_plant_designer_categories_and_conflict_detection():
    """Verify editable plant layout, High/Medium/Low categories, and incompatible requirement conflict warning."""
    headers = get_auth_headers()
    
    # 1. Inspect Zone 01 seeded plant layout
    plants_resp = client.get("/api/zones/zone-01/plants")
    assert plants_resp.status_code == 200
    plants = plants_resp.json()
    assert len(plants) >= 4 # Tomato, Lettuce, Rosemary, Cactus

    # Check water requirement categories present
    categories = {p["water_category"] for p in plants}
    assert "HIGH" in categories # Lettuce
    assert "MEDIUM" in categories # Tomato
    assert "LOW" in categories # Rosemary or Cactus

    # 2. Calculate zone plan
    calc_resp = client.get("/api/zones/zone-01/calculate-plan")
    assert calc_resp.status_code == 200
    calc = calc_resp.json()
    assert calc["total_plants"] >= 4
    assert calc["calculated_target_moisture"] > 0
    assert calc["calculated_dry_threshold"] > 0

    # Because Zone 01 contains both Lettuce (High) and Cactus/Rosemary (Low),
    # it MUST trigger a clear conflict warning!
    assert calc["has_conflict"] is True
    assert calc["conflict_warning"] is not None
    assert "Incompatible Water Requirements" in calc["conflict_warning"]

    # 3. Apply plan to zone settings
    apply_resp = client.post("/api/zones/zone-01/apply-plan", json={
        "soil_moisture_target": calc["calculated_target_moisture"],
        "soil_moisture_dry_threshold": calc["calculated_dry_threshold"]
    }, headers=headers)
    assert apply_resp.status_code == 200
    assert apply_resp.json()["status"] == "SUCCESS"

    # Verify zone now has the applied target
    z01 = client.get("/api/zones/zone-01").json()
    assert z01["soil_moisture_target"] == calc["calculated_target_moisture"]

# ==================== ACCEPTANCE TESTS: PUMP CONTENTION SAFETY ====================

def test_single_pump_hardware_contention_prevention():
    """Two zones sharing a single physical pump cannot run simultaneous irrigation commands."""
    headers = get_auth_headers()
    state_manager.set_mode("SIMULATION")

    # Create temporary secondary zone
    client.post("/api/zones", json={
        "zone_id": "zone-gamma",
        "name": "Zone Gamma",
        "soil_moisture_target": 70.0,
        "soil_moisture_dry_threshold": 35.0
    }, headers=headers)

    # 1. Start irrigation on Zone 01
    start1 = client.post("/api/zones/zone-01/irrigate", json={
        "action": "START",
        "duration_seconds": 120
    }, headers=headers)
    assert start1.status_code == 200
    assert start1.json()["pump_state"] == "RUNNING"

    # 2. Attempt to start simultaneous irrigation on Zone Gamma -> MUST BE REJECTED!
    start2 = client.post("/api/zones/zone-gamma/irrigate", json={
        "action": "START",
        "duration_seconds": 120
    }, headers=headers)
    assert start2.status_code == 409 # HTTP 409 Conflict
    assert "Pump contention" in start2.json()["detail"]

    # 3. Stop irrigation on Zone 01
    stop1 = client.post("/api/zones/zone-01/irrigate", json={
        "action": "STOP"
    }, headers=headers)
    assert stop1.status_code == 200
    assert stop1.json()["pump_state"] == "OFF"

    # Clean up Zone Gamma
    client.delete("/api/zones/zone-gamma", headers=headers)

