import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, init_db_defaults

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


def test_garden_network_crud_and_validation():
    """Verify garden pipe network retrieval, persistence, validation, and planning APIs."""
    headers = get_auth_headers()
    
    # 1. GET default network for zone-01
    resp = client.get("/api/zones/zone-01/network", headers=headers)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["zone_id"] == "zone-01"
    assert "network" in res_data
    network_data = res_data["network"]
    assert len(network_data["components"]) >= 3
    assert len(network_data["pipes"]) >= 2
    
    # 2. POST validate network
    val_resp = client.post("/api/zones/zone-01/network/validate", json=network_data, headers=headers)
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["has_water_source"] is True
    assert val_data["has_motor_pump"] is True
    
    # 3. PUT update network
    # Modify one node name
    network_data["components"][0]["name"] = "Primary Borewell Tank"
    put_resp = client.put("/api/zones/zone-01/network", json=network_data, headers=headers)
    assert put_resp.status_code == 200
    assert put_resp.json()["network"]["components"][0]["name"] == "Primary Borewell Tank"
    
    # Verify persistence via GET
    get_again = client.get("/api/zones/zone-01/network", headers=headers)
    assert get_again.status_code == 200
    assert get_again.json()["network"]["components"][0]["name"] == "Primary Borewell Tank"
    
    # 4. POST generate sequential plan
    plan_resp = client.post("/api/zones/zone-01/network/plan", json=network_data, headers=headers)
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    assert "tasks" in plan_data
    assert plan_data["total_tasks"] >= 0
