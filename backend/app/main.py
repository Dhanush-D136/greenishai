import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.core.security import get_password_hash
from backend.app.models.models import User, Device, IrrigationSetting, SystemState, DeviceConnectionSetting, IrrigationZone, ZonePlant
from backend.app.services.mqtt_service import mqtt_service
from backend.app.services.simulation_service import simulation_engine

from backend.app.api.auth import router as auth_router
from backend.app.api.dashboard import router as dashboard_router
from backend.app.api.devices import router as devices_router
from backend.app.api.sensors import router as sensors_router
from backend.app.api.irrigation import router as irrigation_router
from backend.app.api.settings import router as settings_router
from backend.app.api.diagnostics import router as diagnostics_router
from backend.app.api.simulation import router as simulation_router
from backend.app.api.alerts import router as alerts_router
from backend.app.api.zones import router as zones_router
from backend.app.api.ai import router as ai_router
from backend.app.api.ws import router as ws_router


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("smartirrigate")

def init_db_defaults():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Create default admin user if no users exist
        if db.query(User).count() == 0:
            admin_user = User(
                email="admin@smartirrigate.io",
                hashed_password=get_password_hash("SmartAdmin2026!"),
                full_name="Farm Administrator",
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            logger.info("Default administrator created (admin@smartirrigate.io / SmartAdmin2026!)")

        # Create default devices if none exist
        if not db.query(Device).filter(Device.device_id == settings.DEFAULT_ESP32_ID).first():
            esp32 = Device(
                device_id=settings.DEFAULT_ESP32_ID,
                name="ESP32 Zone 01 Field Controller",
                device_type="esp32",
                status="OFFLINE",
                firmware_version="v1.2.0-secure"
            )
            db.add(esp32)
            
        if not db.query(Device).filter(Device.device_id == settings.DEFAULT_RPI_ID).first():
            rpi = Device(
                device_id=settings.DEFAULT_RPI_ID,
                name="Raspberry Pi 4B Edge Gateway",
                device_type="raspberry_pi",
                status="OFFLINE",
                firmware_version="v1.0.4-edge-daemon"
            )
            db.add(rpi)

        # Create default settings
        if not db.query(IrrigationSetting).filter(IrrigationSetting.device_id == settings.DEFAULT_ESP32_ID).first():
            irr_setting = IrrigationSetting(
                device_id=settings.DEFAULT_ESP32_ID,
                auto_mode_enabled=True,
                dry_threshold_percent=35.0,
                target_moisture_percent=70.0,
                max_runtime_seconds=300,
                cooldown_minutes=30,
                rain_pause_enabled=True,
                daylight_only=False
            )
            db.add(irr_setting)

        # Create default DeviceConnectionSetting if none exists
        if not db.query(DeviceConnectionSetting).first():
            conn_setting = DeviceConnectionSetting(
                active_mode="DIRECT_ESP32",
                direct_esp32_id=settings.DEFAULT_ESP32_ID,
                direct_esp32_ip="192.168.1.105",
                direct_esp32_protocol="MQTT",
                direct_esp32_status="DISCONNECTED",
                rpi_device_id=settings.DEFAULT_RPI_ID,
                rpi_ip="192.168.1.200",
                rpi_mqtt_host=settings.MQTT_BROKER_HOST,
                rpi_mqtt_port=settings.MQTT_BROKER_PORT,
                rpi_status="DISCONNECTED",
                rpi_esp32_status="DISCONNECTED"
            )
            db.add(conn_setting)

        # Create default IrrigationZone and illustrative plant layout if none exists
        if not db.query(IrrigationZone).first():
            default_zone = IrrigationZone(
                zone_id="zone-01",
                name="Zone A — Vegetable Garden",
                description="Main vegetable and herb growing plot equipped with capacitive soil probe",
                location="North Greenhouse Plot 1",
                plant_categories="Vegetables, Herbs",
                controller_device_id=settings.DEFAULT_ESP32_ID,
                pump_device_id="pump-zone-01",
                soil_moisture_target=70.0,
                soil_moisture_dry_threshold=35.0,
                hysteresis_buffer=5.0,
                max_runtime_seconds=300,
                cooldown_minutes=30,
                auto_irrigation_enabled=True,
                is_active=True,
                notes="Initial production zone configured with four sample plant water profiles."
            )
            db.add(default_zone)
            db.flush()

            # Illustrative starting plant layout matching specification:
            # [Tomato] (Medium)   [Lettuce] (High)
            # [Rosemary] (Low)    [Cactus] (Low)
            starting_plants = [
                ZonePlant(
                    zone_id="zone-01",
                    plant_name="Tomato",
                    water_category="MEDIUM",
                    desired_moisture_min=50.0,
                    desired_moisture_max=75.0,
                    target_moisture=65.0,
                    pos_x=60.0,
                    pos_y=50.0,
                    width=150.0,
                    height=110.0,
                    notes="Solanum lycopersicum; regular watering required during flowering and fruiting"
                ),
                ZonePlant(
                    zone_id="zone-01",
                    plant_name="Lettuce",
                    water_category="HIGH",
                    desired_moisture_min=65.0,
                    desired_moisture_max=85.0,
                    target_moisture=80.0,
                    pos_x=270.0,
                    pos_y=50.0,
                    width=150.0,
                    height=110.0,
                    notes="Lactuca sativa; shallow root system requiring consistently moist soil"
                ),
                ZonePlant(
                    zone_id="zone-01",
                    plant_name="Rosemary",
                    water_category="LOW",
                    desired_moisture_min=25.0,
                    desired_moisture_max=45.0,
                    target_moisture=35.0,
                    pos_x=60.0,
                    pos_y=200.0,
                    width=150.0,
                    height=110.0,
                    notes="Salvia rosmarinus; Mediterranean herb with high drought tolerance"
                ),
                ZonePlant(
                    zone_id="zone-01",
                    plant_name="Cactus",
                    water_category="LOW",
                    desired_moisture_min=15.0,
                    desired_moisture_max=35.0,
                    target_moisture=25.0,
                    pos_x=270.0,
                    pos_y=200.0,
                    width=150.0,
                    height=110.0,
                    notes="Cactaceae; arid succulent, prone to root rot with excess water"
                ),
            ]
            db.add_all(starting_plants)

        # Create or sync default SystemState (operating mode & authoritative pump state)
        system_state = db.query(SystemState).first()
        if not system_state:
            system_state = SystemState(
                operating_mode="SIMULATION",
                permission_mode="AUTHORIZED_AUTO",
                authoritative_pump_state="OFF"
            )
            db.add(system_state)
        else:
            # On startup, reset pump state to OFF so it never starts falsely as RUNNING
            system_state.authoritative_pump_state = "OFF"

        db.commit()
    except Exception as e:
        logger.error(f"Error initializing database defaults: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting SmartIrrigate — vel greenish backend...")
    init_db_defaults()
    loop = asyncio.get_running_loop()
    
    # Initialize MQTT Service
    mqtt_service.set_async_loop(loop)
    mqtt_service.start()
    
    # Initialize authoritative Simulation Engine
    simulation_engine.set_async_loop(loop)
    simulation_engine.start_loop()
    
    yield
    # Shutdown
    logger.info("Shutting down SmartIrrigate backend...")
    simulation_engine.stop_loop()
    mqtt_service.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="IoT-Based Smart Irrigation and Remote Monitoring System Using ESP32 and Raspberry Pi 4B",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_PREFIX)
app.include_router(devices_router, prefix=settings.API_PREFIX)
app.include_router(sensors_router, prefix=settings.API_PREFIX)
app.include_router(irrigation_router, prefix=settings.API_PREFIX)
app.include_router(settings_router, prefix=settings.API_PREFIX)
app.include_router(diagnostics_router, prefix=settings.API_PREFIX)
app.include_router(simulation_router, prefix=settings.API_PREFIX)
app.include_router(alerts_router, prefix=settings.API_PREFIX)
app.include_router(zones_router, prefix=settings.API_PREFIX)
app.include_router(ai_router, prefix=settings.API_PREFIX)
app.include_router(ws_router)


@app.get("/")
def root():
    return {
        "app": "SmartIrrigate — vel greenish",
        "tagline": "Sense. Decide. Irrigate.",
        "docs_url": "/docs",
        "health_url": f"{settings.API_PREFIX}/health"
    }
