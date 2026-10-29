import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, init_db_defaults
from backend.app.services.state_manager import state_manager

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db_defaults()

client = TestClient(app)

def get_auth_token():
    login_resp = client.post("/api/auth/login", json={
        "email": "admin@smartirrigate.io",
        "password": "SmartAdmin2026!"
    })
    assert login_resp.status_code == 200
    return login_resp.json()["access_token"]


def test_ai_forecast_endpoint():
    resp = client.get("/api/ai/forecast/zone-01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "zone-01"
    assert "current_moisture" in data
    assert "trend_direction" in data
    assert "forecast_curve" in data
    assert len(data["forecast_curve"]) > 0


def test_ai_anomalies_and_scan_endpoints():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger scan
    scan_resp = client.post("/api/ai/anomalies/scan", headers=headers)
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["status"] == "SUCCESS"
    assert "new_anomalies_count" in scan_data

    # 2. List anomalies
    list_resp = client.get("/api/ai/anomalies")
    assert list_resp.status_code == 200
    anomalies = list_resp.json()
    assert isinstance(anomalies, list)

    if len(anomalies) > 0:
        target_event = anomalies[0]["event_id"]
        # Acknowledge
        ack_resp = client.post(f"/api/ai/anomalies/{target_event}/acknowledge", headers=headers)
        assert ack_resp.status_code in [200, 400]

        # Resolve
        res_resp = client.post(f"/api/ai/anomalies/{target_event}/resolve", headers=headers)
        assert res_resp.status_code == 200
        assert res_resp.json()["status"] == "RESOLVED"


def test_ai_recommendations_and_evaluation_endpoints():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Evaluate zone recommendation
    eval_resp = client.post("/api/ai/recommendations/evaluate/zone-01", headers=headers)
    assert eval_resp.status_code == 200
    rec_data = eval_resp.json()
    assert rec_data["zone_id"] == "zone-01"
    assert "recommendation_id" in rec_data
    rec_id = rec_data["recommendation_id"]

    # 2. List recommendations
    list_resp = client.get("/api/ai/recommendations?zone_id=zone-01")
    assert list_resp.status_code == 200
    recs = list_resp.json()
    assert len(recs) >= 1

    # 3. Approve or Reject
    state_manager.stop_irrigation()
    if rec_data["suggested_action"] == "IRRIGATE":
        app_resp = client.post(f"/api/ai/recommendations/{rec_id}/approve", headers=headers)
        assert app_resp.status_code == 200
        assert app_resp.json()["status"] == "APPROVED"
    else:
        rej_resp = client.post(f"/api/ai/recommendations/{rec_id}/reject", headers=headers)
        assert rej_resp.status_code == 200
        assert rej_resp.json()["status"] == "REJECTED"


def test_ai_water_efficiency_endpoint():
    resp = client.get("/api/ai/water-efficiency/zone-01?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "zone-01"
    assert "efficiency_score" in data
    assert "total_runtime_seconds" in data
    assert "daily_runtimes" in data


def test_ai_chat_assistant_endpoint():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Ask general status question
    chat_resp = client.post("/api/ai/chat", json={
        "message": "Give me a summary of current soil moisture and system health.",
        "zone_id": "zone-01"
    }, headers=headers)
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["role"] == "assistant"
    assert len(chat_data["content"]) > 10

    # 2. Ask watering request (must trigger proposed action safety interlock)
    action_resp = client.post("/api/ai/chat", json={
        "message": "Turn on the pump for Zone A for 120 seconds please.",
        "zone_id": "zone-01"
    }, headers=headers)
    assert action_resp.status_code == 200
    action_data = action_resp.json()
    assert action_data["proposed_action"] is not None
    assert action_data["proposed_action"]["target_zone"] == "zone-01"
    assert action_data["proposed_action"]["duration_seconds"] == 120
