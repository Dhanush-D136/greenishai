import pytest
from backend.app.core.database import SessionLocal
from backend.app.main import init_db_defaults
from backend.app.services.garden_network_service import GardenNetworkService


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db_defaults()


def test_default_network_structure():
    """Verify default network generates all required topology elements."""
    network = GardenNetworkService.get_default_network("zone-01")
    assert network["zone_id"] == "zone-01"
    assert len(network["components"]) >= 5
    assert len(network["pipes"]) >= 4
    
    types = [c["type"] for c in network["components"]]
    assert "WATER_SOURCE" in types
    assert "MOTOR_PUMP" in types
    assert "PLANT_ZONE" in types
    assert "VALVE" in types


def test_network_validation_success():
    """Verify valid default network passes graph reachability validation."""
    network = GardenNetworkService.get_default_network("zone-01")
    res = GardenNetworkService.validate_network(network)
    
    assert res["is_valid"] is True
    assert res["has_water_source"] is True
    assert res["has_motor_pump"] is True
    assert len(res["connected_plant_ids"]) > 0
    assert len(res["unreachable_plant_ids"]) == 0


def test_network_validation_missing_pump():
    """Verify validation catches missing pump with appropriate error."""
    network = GardenNetworkService.get_default_network("zone-01")
    network["components"] = [c for c in network["components"] if c["type"] != "MOTOR_PUMP"]
    
    res = GardenNetworkService.validate_network(network)
    assert res["is_valid"] is False
    assert res["has_motor_pump"] is False
    assert any("pump" in issue["message"].lower() for issue in res["issues"] if issue["severity"] == "ERROR")


def test_network_validation_closed_valve():
    """Verify closed valve correctly marks downstream plant beds as blocked/unreachable."""
    network = GardenNetworkService.get_default_network("zone-01")
    for comp in network["components"]:
        if comp["type"] == "VALVE":
            comp["status"] = "CLOSED"
            comp.setdefault("properties", {})["valve_state"] = "CLOSED"
            
    res = GardenNetworkService.validate_network(network)
    assert len(res["unreachable_plant_ids"]) > 0
    assert len(res["connected_plant_ids"]) == 0


def test_irrigation_plan_generation():
    """Verify sequential irrigation planning based on crop deficits and network reachability."""
    network = GardenNetworkService.get_default_network("zone-01")
    
    db = SessionLocal()
    try:
        plan = GardenNetworkService.generate_irrigation_plan(
            zone_id="zone-01",
            network_data=network,
            db=db
        )
        assert plan["total_tasks"] > 0
        assert plan["total_water_liters_estimate"] > 0
        assert len(plan["tasks"]) > 0
        assert "tasks" in plan
    finally:
        db.close()
