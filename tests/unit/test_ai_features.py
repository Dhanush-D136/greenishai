import datetime
import asyncio
import pytest
from backend.app.core.database import SessionLocal
from backend.app.main import init_db_defaults
from backend.app.models.models import (
    IrrigationZone, ZonePlant, SensorReading, IrrigationEvent,
    SystemState, AIAnomaly, AIRecommendation
)
from backend.app.services.ai_service import ai_service, utcnow
from backend.app.services.state_manager import state_manager


@pytest.fixture(scope="module")
def db_session():
    init_db_defaults()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_soil_moisture_predictive_decay(db_session):
    """
    Feature 1: Soil Moisture Prediction
    Validates +30m and +60m forecast calculations, trend classification, and confidence intervals.
    """
    zone = db_session.query(IrrigationZone).filter(IrrigationZone.zone_id == "zone-01").first()
    assert zone is not None

    forecast = ai_service.get_soil_moisture_forecast(zone_id="zone-01", db=db_session)
    assert forecast["zone_id"] == "zone-01"
    assert "current_moisture" in forecast
    assert "forecast_30m" in forecast
    assert "forecast_60m" in forecast
    assert forecast["forecast_30m"] is not None
    assert forecast["forecast_60m"] is not None
    assert forecast["trend_direction"] in ["DRYING", "STABLE", "RISING"]

    # In drying trend, 60m moisture should be less than or equal to 30m moisture
    if forecast["trend_direction"] == "DRYING":
        assert forecast["forecast_60m"] <= forecast["forecast_30m"]

    # Verify confidence intervals
    assert len(forecast["confidence_interval_30m"]) == 2
    assert forecast["confidence_interval_30m"][0] <= forecast["forecast_30m"] <= forecast["confidence_interval_30m"][1]
    assert len(forecast["confidence_interval_60m"]) == 2
    assert forecast["confidence_interval_60m"][0] <= forecast["forecast_60m"] <= forecast["confidence_interval_60m"][1]

    # Verify forecast points list
    assert len(forecast["forecast_curve"]) >= 2
    future_points = [p for p in forecast["forecast_curve"] if p.get("is_forecast")]
    assert len(future_points) >= 2


def test_layered_anomaly_detection_frozen_sensor(db_session):
    """
    Feature 2: Fault and Anomaly Detection - Frozen Sensor Check
    Injects 10 identical readings to trigger SENSOR_STUCK_READING anomaly.
    """
    zone = db_session.query(IrrigationZone).filter(IrrigationZone.zone_id == "zone-01").first()
    assert zone is not None

    now = utcnow()
    # Add 20 identical readings with future timestamps to guarantee they are the top recent samples
    readings = []
    for i in range(20):
        r = SensorReading(
            device_id=zone.controller_device_id,
            timestamp=now + datetime.timedelta(seconds=i * 2),
            soil_moisture_raw=2150,
            soil_moisture_percent=45.2,
            temperature_c=24.5,
            humidity_percent=60.0,
            rain_detected=False,
            pump_state="OFF",
            is_simulated=True
        )
        readings.append(r)
    db_session.add_all(readings)
    db_session.commit()

    detected = ai_service.run_anomaly_detection_scan(db=db_session)
    # Scan should either detect frozen sensor or confirm active rules
    frozen_anoms = [a for a in detected if a["anomaly_type"] in ["SENSOR_STUCK_READING", "FLATLINE"]]
    assert len(frozen_anoms) >= 1
    assert frozen_anoms[0]["category"] == "SENSOR"
    assert "identical" in frozen_anoms[0]["observed_evidence"].lower()


def test_ai_irrigation_recommendation_and_approval(db_session):
    """
    Feature 3: AI Irrigation Recommendations with Human Approval
    Validates recommendation evaluation, expiration, and operator approval flow.
    """
    rec = ai_service.evaluate_zone_recommendation(zone_id="zone-01", db=db_session)
    assert rec["zone_id"] == "zone-01"
    assert rec["suggested_action"] in ["IRRIGATE", "WAIT", "INSPECT"]
    assert rec["status"] == "PENDING"
    assert "expires_at" in rec
    assert rec["confidence"] >= 0.5

    rec_id = rec["recommendation_id"]

    if rec["suggested_action"] == "IRRIGATE":
        # Ensure pump is stopped before testing approval
        state_manager.stop_irrigation()
        # Test Human Approval
        approval_result = ai_service.approve_recommendation(
            recommendation_id=rec_id,
            user_email="admin@smartirrigate.io",
            db=db_session
        )
        assert approval_result["status"] == "APPROVED"
        assert approval_result["action_id"] is not None

        # Recommendation in DB should now be marked APPROVED
        db_rec = db_session.query(AIRecommendation).filter(AIRecommendation.recommendation_id == rec_id).first()
        assert db_rec.status == "APPROVED"
    else:
        # Test Rejection
        reject_result = ai_service.reject_recommendation(
            recommendation_id=rec_id,
            user_email="admin@smartirrigate.io",
            db=db_session
        )
        assert reject_result["status"] == "REJECTED"


def test_water_use_efficiency_analytics(db_session):
    """
    Feature 4: Water-Use Optimization & Pumping Efficiency Analytics
    Validates water consumption formula and efficiency score calculations.
    """
    # Create an irrigation event with known runtime
    now = utcnow()
    event = IrrigationEvent(
        device_id="esp32-01",
        action="START",
        trigger_type="AUTOMATIC_THRESHOLD",
        start_time=now - datetime.timedelta(hours=2),
        end_time=now - datetime.timedelta(hours=2) + datetime.timedelta(seconds=120),
        duration_seconds=120, # 2 minutes
        start_soil_moisture=30.0,
        end_soil_moisture=45.0 # +15.0% gain
    )
    db_session.add(event)
    db_session.commit()

    insights = ai_service.get_water_efficiency_insights(zone_id="zone-01", days=7, db=db_session)
    assert insights["zone_id"] == "zone-01"
    assert insights["period_days"] == 7
    assert insights["total_runtime_seconds"] >= 120
    assert insights["flow_rate_lpm"] == 1.5
    # Volume = 120s / 60 * 1.5 L/min = 3.0 Liters minimum
    assert insights["water_consumed_liters_estimate"] >= 3.0
    assert 0 <= insights["efficiency_score"] <= 100
    assert len(insights["recommendations"]) > 0


def test_ai_assistant_safety_interlock(db_session):
    """
    Feature 5: SmartIrrigate AI Assistant
    Validates grounded context retrieval, Gemini/context fallback, and safety interlock.
    Ensures that when a user asks to water, the AI NEVER toggles the pump directly,
    but instead generates a ProposedAction requiring manual approval.
    """
    # 1. Status query
    status_reply = asyncio.run(ai_service.process_chat_query(
        user_msg="What is the current soil moisture in Zone A?",
        user_email="admin@smartirrigate.io",
        zone_id="zone-01",
        db=db_session
    ))
    assert status_reply["role"] == "assistant"
    assert len(status_reply["content"]) > 10
    assert "moisture" in status_reply["content"].lower()

    # 2. Watering command request -> Must trigger safety interlock
    water_reply = asyncio.run(ai_service.process_chat_query(
        user_msg="Please water Zone A for 180 seconds immediately",
        user_email="admin@smartirrigate.io",
        zone_id="zone-01",
        db=db_session
    ))
    assert water_reply["role"] == "assistant"
    # Content must clearly state that human approval is required
    content_lower = water_reply["content"].lower()
    assert "approval" in content_lower or "safety" in content_lower or "proposed" in content_lower

    # A proposed action MUST have been generated with status PENDING
    assert water_reply["proposed_action"] is not None
    assert water_reply["proposed_action"]["target_zone"] == "zone-01"
    assert water_reply["proposed_action"]["duration_seconds"] == 180
    assert water_reply["proposed_action"]["status"] == "PENDING"
