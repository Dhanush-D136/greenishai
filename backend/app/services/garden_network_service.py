import datetime
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.config import settings
from backend.app.models.models import IrrigationZone, ZonePlant, SensorReading
from backend.app.services.state_manager import state_manager

logger = logging.getLogger("smartirrigate.garden_network_service")

def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class GardenNetworkService:
    """
    Intelligent Irrigation Network Service for SmartIrrigate.
    Implements:
    1. Graph topology validation (Water Source -> Pump -> Main Pipe -> Valves -> Branches -> Plants)
    2. Reachability analysis & disconnected branch detection
    3. Topology-aware sequential smart irrigation planning
    4. Hardware safety validation
    """

    @classmethod
    def get_default_network(cls, zone_id: str, plants: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Creates a clean, working default garden pipe network configured for the zone's plants.
        """
        if not plants:
            class _MockPlant:
                def __init__(self, id, name, category, target, min_m, max_m, x, y):
                    self.id = id
                    self.plant_name = name
                    self.water_category = category
                    self.target_moisture = target
                    self.desired_moisture_min = min_m
                    self.desired_moisture_max = max_m
                    self.pos_x = x
                    self.pos_y = y
            plants = [
                _MockPlant(1, "Tomato Bed", "HIGH", 75.0, 60.0, 80.0, 80.0, 240.0),
                _MockPlant(2, "Lettuce Bed", "HIGH", 80.0, 65.0, 85.0, 280.0, 240.0),
            ]

        components = [
            {
                "id": "ws-1",
                "type": "WATER_SOURCE",
                "name": "Rainwater Tank (500L)",
                "x": 48.0,
                "y": 60.0,
                "status": "ACTIVE",
                "properties": {"water_level_liters": 450.0, "source_type": "RAINWATER_RESERVOIR"}
            },
            {
                "id": "pump-1",
                "type": "MOTOR_PUMP",
                "name": "Submersible Pump 12V",
                "x": 168.0,
                "y": 60.0,
                "status": "OFF",
                "properties": {"flow_rate_lpm": 1.5, "rated_voltage": "12V DC", "max_runtime": 300}
            },
            {
                "id": "jn-1",
                "type": "JUNCTION",
                "name": "Main Distribution T-Junction",
                "x": 312.0,
                "y": 60.0,
                "status": "ACTIVE",
                "properties": {"ports_count": 3}
            },
            {
                "id": "valve-1",
                "type": "VALVE",
                "name": "Zone Isolation Valve 01",
                "x": 312.0,
                "y": 144.0,
                "status": "OPEN",
                "properties": {"valve_state": "OPEN", "control_mode": "SOLENOID_AUTO"}
            }
        ]

        pipes = [
            {
                "id": "pipe-ws-pump",
                "type": "MAIN",
                "from_node_id": "ws-1",
                "from_port": "outlet",
                "to_node_id": "pump-1",
                "to_port": "inlet",
                "points": [{"x": 96.0, "y": 84.0}, {"x": 168.0, "y": 84.0}],
                "status": "CONNECTED"
            },
            {
                "id": "pipe-pump-jn",
                "type": "MAIN",
                "from_node_id": "pump-1",
                "from_port": "outlet",
                "to_node_id": "jn-1",
                "to_port": "port_a",
                "points": [{"x": 216.0, "y": 84.0}, {"x": 312.0, "y": 84.0}],
                "status": "CONNECTED"
            },
            {
                "id": "pipe-jn-valve",
                "type": "MAIN",
                "from_node_id": "jn-1",
                "from_port": "port_b",
                "to_node_id": "valve-1",
                "to_port": "inlet",
                "points": [{"x": 324.0, "y": 96.0}, {"x": 324.0, "y": 144.0}],
                "status": "CONNECTED"
            }
        ]

        # Add Plant Zone nodes from existing database plants
        for i, plant in enumerate(plants):
            plant_node_id = f"plant-node-{plant.id}"
            components.append({
                "id": plant_node_id,
                "type": "PLANT_ZONE",
                "name": plant.plant_name,
                "x": float(plant.pos_x or (80.0 + (i % 3) * 200.0)),
                "y": float(plant.pos_y or (220.0 + (i // 3) * 130.0)),
                "status": "ACTIVE",
                "plant_id": plant.id,
                "properties": {
                    "category": plant.water_category,
                    "target_moisture": plant.target_moisture,
                    "min_moisture": plant.desired_moisture_min,
                    "max_moisture": plant.desired_moisture_max
                }
            })

            # Connect branch pipe from valve/junction to plant
            pipe_id = f"pipe-branch-{plant.id}"
            pipes.append({
                "id": pipe_id,
                "type": "BRANCH",
                "from_node_id": "valve-1",
                "from_port": "outlet",
                "to_node_id": plant_node_id,
                "to_port": "inlet",
                "points": [
                    {"x": 324.0, "y": 180.0},
                    {"x": float(plant.pos_x or (80.0 + (i % 3) * 200.0)) + 60.0, "y": float(plant.pos_y or (220.0 + (i // 3) * 130.0))}
                ],
                "status": "CONNECTED"
            })

        return {
            "zone_id": zone_id,
            "components": components,
            "pipes": pipes,
            "metadata": {"version": 1, "grid_snap": 24, "created_at": utcnow().isoformat()}
        }

    @classmethod
    def validate_network(cls, network_data: Dict[str, Any], plants_in_zone: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Validates garden pipe network topology:
        - Detects Water Sources and Motor Pumps.
        - Traces connected graph paths.
        - Identifies reachable vs unreachable plant zones.
        - Checks for disconnected pipes, closed valves, and isolated branches.
        """
        if plants_in_zone is None:
            plants_in_zone = []
        components = network_data.get("components", [])
        pipes = network_data.get("pipes", [])

        issues: List[Dict[str, Any]] = []
        comp_map = {c["id"]: c for c in components}

        # 1. Component presence checks
        water_sources = [c for c in components if c.get("type") == "WATER_SOURCE"]
        pumps = [c for c in components if c.get("type") == "MOTOR_PUMP"]
        plant_nodes = [c for c in components if c.get("type") == "PLANT_ZONE"]
        valves = [c for c in components if c.get("type") == "VALVE"]

        has_water_source = len(water_sources) > 0
        has_motor_pump = len(pumps) > 0

        if not has_water_source:
            issues.append({
                "code": "MISSING_WATER_SOURCE",
                "severity": "ERROR",
                "message": "No water source placed on grid. The irrigation network requires a designated water supply reservoir."
            })

        if not has_motor_pump:
            issues.append({
                "code": "MISSING_PUMP",
                "severity": "ERROR",
                "message": "No motor pump placed on grid. A pump is required to pressurize and deliver water to plant zones."
            })

        # 2. Build graph adjacency
        # Adjacency: node_id -> list of (neighbor_node_id, pipe_obj)
        graph: Dict[str, List[Tuple[str, Dict[str, Any]]]] = {c["id"]: [] for c in components}
        
        for p in pipes:
            from_id = p.get("from_node_id")
            to_id = p.get("to_node_id")

            if from_id not in comp_map or to_id not in comp_map:
                issues.append({
                    "code": "DANGLING_PIPE",
                    "severity": "WARNING",
                    "message": f"Pipe '{p.get('id', 'unknown')}' has disconnected endpoints.",
                    "component_id": p.get("id")
                })
                continue

            graph[from_id].append((to_id, p))
            graph[to_id].append((from_id, p))

        # 3. Check pump connected to water source
        pump_connected_to_source = False
        for pump in pumps:
            # Check direct pipe connection to any water source
            neighbors = [n for n, _ in graph.get(pump["id"], [])]
            for ws in water_sources:
                if ws["id"] in neighbors:
                    pump_connected_to_source = True
                    break

        if pumps and water_sources and not pump_connected_to_source:
            issues.append({
                "code": "PUMP_NOT_CONNECTED_TO_SOURCE",
                "severity": "ERROR",
                "message": "Motor pump is not connected to any water source. Connect the pump inlet to the water reservoir outlet.",
                "component_id": pumps[0]["id"]
            })

        # 4. Check closed valves
        closed_valve_ids = set()
        for v in valves:
            v_status = v.get("properties", {}).get("valve_state") or v.get("status")
            if v_status == "CLOSED":
                closed_valve_ids.add(v["id"])
                issues.append({
                    "code": "VALVE_CLOSED",
                    "severity": "WARNING",
                    "message": f"Valve '{v.get('name', 'Solenoid Valve')}' is CLOSED. Downstream branches will not receive water.",
                    "component_id": v["id"]
                })

        # 5. Graph traversal (BFS) from Pump outlet to identify reachable plant zones
        reachable_node_ids: Set[str] = set()
        supply_paths: Dict[str, List[str]] = {}

        if pump_connected_to_source:
            for pump in pumps:
                queue = [pump["id"]]
                visited = {pump["id"]}
                supply_paths[pump["id"]] = [pump.get("name", "Pump")]

                while queue:
                    curr = queue.pop(0)
                    curr_path = supply_paths.get(curr, [])

                    # If this node is a closed valve, do not propagate downstream water flow!
                    if curr in closed_valve_ids and curr != pump["id"]:
                        continue

                    for nxt, pipe in graph.get(curr, []):
                        if nxt not in visited:
                            # Don't backtrack to water source when distributing water from pump
                            if any(ws["id"] == nxt for ws in water_sources):
                                continue

                            visited.add(nxt)
                            queue.append(nxt)
                            reachable_node_ids.add(nxt)

                            nxt_name = comp_map[nxt].get("name", nxt)
                            pipe_type = pipe.get("type", "PIPE")
                            supply_paths[nxt] = curr_path + [f"[{pipe_type}]", nxt_name]

        # 6. Evaluate Plant Zone Reachability
        connected_plant_ids: List[str] = []
        unreachable_plant_ids: List[str] = []

        for p_node in plant_nodes:
            p_id = p_node["id"]
            if p_id in reachable_node_ids:
                connected_plant_ids.append(p_id)
            else:
                unreachable_plant_ids.append(p_id)
                issues.append({
                    "code": "UNREACHABLE_PLANT_ZONE",
                    "severity": "WARNING",
                    "message": f"Plant zone '{p_node.get('name', 'Plant')}' is not reachable from the active pump. Connect a branch pipe to supply water.",
                    "component_id": p_id
                })

        # Overall Status
        has_errors = any(i["severity"] == "ERROR" for i in issues)
        has_warnings = any(i["severity"] == "WARNING" for i in issues)

        if has_errors:
            overall_status = "ERROR"
            summary = "Irrigation network topology has critical errors (missing water source or pump connection)."
        elif has_warnings or len(unreachable_plant_ids) > 0:
            overall_status = "WARNING"
            summary = f"Network is partially functional: {len(connected_plant_ids)} reachable zones, {len(unreachable_plant_ids)} disconnected."
        else:
            overall_status = "VALID"
            summary = f"Complete, validated irrigation network: All {len(connected_plant_ids)} plant zones connected with uninterrupted supply paths."

        return {
            "is_valid": (overall_status != "ERROR"),
            "status": overall_status,
            "total_components": len(components),
            "total_pipes": len(pipes),
            "has_water_source": has_water_source,
            "has_motor_pump": has_motor_pump,
            "connected_plant_ids": connected_plant_ids,
            "unreachable_plant_ids": unreachable_plant_ids,
            "reachable_zones_count": len(connected_plant_ids),
            "total_zones_count": len(plant_nodes),
            "supply_paths": supply_paths,
            "issues": issues,
            "summary": summary
        }

    @classmethod
    def generate_irrigation_plan(
        cls,
        zone_id: str,
        network_data: Dict[str, Any],
        db: Session
    ) -> Dict[str, Any]:
        """
        Synthesizes a topology-aware sequential smart irrigation schedule:
        - Excludes unreachable/disconnected plant zones.
        - Prioritizes thirsty plants (HIGH water category / largest moisture deficit).
        - Respects single shared physical pump constraints via sequential watering tasks.
        - Calculates water volume per step and safety cutoffs.
        """
        zone = db.query(IrrigationZone).filter(IrrigationZone.zone_id == zone_id).first()
        if not zone:
            raise ValueError(f"Zone '{zone_id}' not found.")

        plants = zone.plants or []
        validation = cls.validate_network(network_data, plants)

        # Get latest sensor reading for live moisture context
        latest = (
            db.query(SensorReading)
            .filter(SensorReading.device_id == zone.controller_device_id)
            .order_by(desc(SensorReading.timestamp))
            .first()
        )
        current_moisture = latest.soil_moisture_percent if latest and latest.soil_moisture_percent is not None else 32.0

        reachable_ids = set(validation.get("connected_plant_ids", []))
        supply_paths = validation.get("supply_paths", {})
        components = {c["id"]: c for c in network_data.get("components", [])}

        tasks: List[Dict[str, Any]] = []
        unreachable_warnings: List[str] = []

        flow_rate_lpm = 1.5 # Calibrated 12V submersible flow rate

        # Build candidate list from reachable plant nodes
        candidate_plants: List[Dict[str, Any]] = []
        for c in network_data.get("components", []):
            if c.get("type") == "PLANT_ZONE":
                p_id = c["id"]
                p_name = c.get("name", "Plant")
                p_cat = c.get("properties", {}).get("category", "MEDIUM")
                p_target = float(c.get("properties", {}).get("target_moisture", 65.0))
                
                if p_id in reachable_ids:
                    # Calculate moisture deficit
                    deficit = max(0.0, p_target - current_moisture)
                    # Priority weighting: HIGH category gets +15 points
                    weight = deficit + (20.0 if p_cat == "HIGH" else 10.0 if p_cat == "MEDIUM" else 0.0)
                    candidate_plants.append({
                        "id": p_id,
                        "name": p_name,
                        "category": p_cat,
                        "target_moisture": p_target,
                        "deficit": deficit,
                        "weight": weight,
                        "supply_path": supply_paths.get(p_id, [])
                    })
                else:
                    unreachable_warnings.append(
                        f"Zone '{p_name}' skipped: Disconnected from active pipe network."
                    )

        # Sort candidate plants by priority weight descending
        candidate_plants.sort(key=lambda x: x["weight"], reverse=True)

        total_runtime = 0
        for idx, cp in enumerate(candidate_plants):
            # Calculate duration: 120s base + deficit scaling, capped at max_runtime_seconds
            step_duration = int(min(zone.max_runtime_seconds, max(60, 120 + int(cp["deficit"] * 4))))
            total_runtime += step_duration

            priority = "HIGH" if cp["category"] == "HIGH" or cp["deficit"] > 25.0 else "MEDIUM" if cp["category"] == "MEDIUM" else "LOW"
            path_str = " ➔ ".join([p for p in cp["supply_path"] if not p.startswith("[")])

            tasks.append({
                "step": idx + 1,
                "target_id": cp["id"],
                "target_name": cp["name"],
                "water_category": cp["category"],
                "current_moisture": current_moisture,
                "target_moisture": cp["target_moisture"],
                "duration_seconds": step_duration,
                "priority": priority,
                "supply_path": cp["supply_path"],
                "valve_states": {"valve-1": "OPEN"},
                "explanation": (
                    f"Sequential Task #{idx + 1}: Water {cp['name']} ({cp['category']} requirement) for {step_duration}s. "
                    f"Current moisture {current_moisture:.1f}% vs target {cp['target_moisture']}%. "
                    f"Supply Route: {path_str}."
                )
            })

        total_water_liters = round((total_runtime / 60.0) * flow_rate_lpm, 2)
        summary = (
            f"Generated sequential schedule of {len(tasks)} tasks totaling {round(total_runtime / 60.0, 1)} minutes "
            f"and ~{total_water_liters} Liters. Only reachable plant beds are scheduled; single-pump physical safety enforced."
        )

        return {
            "zone_id": zone_id,
            "generated_at": utcnow().isoformat(),
            "total_tasks": len(tasks),
            "total_water_liters_estimate": total_water_liters,
            "flow_rate_lpm": flow_rate_lpm,
            "unreachable_warnings": unreachable_warnings,
            "tasks": tasks,
            "summary": summary
        }


garden_network_service = GardenNetworkService()
