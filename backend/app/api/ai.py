import datetime
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.models import User
from backend.app.schemas.schemas import (
    AIForecastResponse, AIAnomalyResponse, AIRecommendationResponse,
    WaterEfficiencyResponse, AIChatRequest, AIChatResponse
)
from backend.app.services.ai_service import ai_service

logger = logging.getLogger("smartirrigate.api.ai")

router = APIRouter(prefix="/ai", tags=["Cloud AI Intelligence"])


# =============================================================================
# FEATURE 1: SOIL-MOISTURE PREDICTION
# =============================================================================

@router.get("/forecast/{zone_id}", response_model=AIForecastResponse)
def get_soil_moisture_forecast(zone_id: str, db: Session = Depends(get_db)):
    """
    Returns soil moisture forecast for +30m and +60m for a given zone.
    Includes historical points, trend direction, confidence intervals, and uncertainty.
    """
    try:
        forecast = ai_service.get_soil_moisture_forecast(zone_id=zone_id, db=db)
        return forecast
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing soil moisture forecast for zone {zone_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to generate forecast: {str(e)}")


# =============================================================================
# FEATURE 2: FAULT AND ANOMALY DETECTION
# =============================================================================

@router.get("/anomalies", response_model=List[AIAnomalyResponse])
def list_anomalies(
    status_filter: Optional[str] = Query(None, alias="status"),
    zone_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    List anomaly events detected across the sensor, irrigation, and communication layers.
    """
    try:
        return ai_service.list_anomalies(
            db=db,
            status_filter=status_filter,
            zone_id=zone_id,
            category=category,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Error listing anomalies: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve anomalies")


@router.post("/anomalies/scan")
def trigger_anomaly_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers an immediate anomaly detection scan across all active zones, controllers, and pumps.
    """
    try:
        detected = ai_service.run_anomaly_detection_scan(db=db)
        return {
            "status": "SUCCESS",
            "scanned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "new_anomalies_count": len(detected),
            "anomalies": detected
        }
    except Exception as e:
        logger.error(f"Error running anomaly scan: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Anomaly scan failed: {str(e)}")


@router.post("/anomalies/{event_id}/acknowledge", response_model=AIAnomalyResponse)
def acknowledge_anomaly(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Operator acknowledges an active anomaly event.
    """
    try:
        updated = ai_service.update_anomaly_status(
            event_id=event_id,
            new_status="ACKNOWLEDGED",
            user_email=current_user.email,
            db=db
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error acknowledging anomaly {event_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to acknowledge anomaly")


@router.post("/anomalies/{event_id}/resolve", response_model=AIAnomalyResponse)
def resolve_anomaly(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Operator marks an anomaly event as resolved.
    """
    try:
        updated = ai_service.update_anomaly_status(
            event_id=event_id,
            new_status="RESOLVED",
            user_email=current_user.email,
            db=db
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error resolving anomaly {event_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to resolve anomaly")


# =============================================================================
# FEATURE 3: AI IRRIGATION RECOMMENDATIONS (APPROVAL-REQUIRED)
# =============================================================================

@router.get("/recommendations", response_model=List[AIRecommendationResponse])
def list_recommendations(
    zone_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Lists AI irrigation recommendations with status, explanations, confidence scores, and time-to-live.
    """
    try:
        return ai_service.list_recommendations(
            db=db,
            zone_id=zone_id,
            status_filter=status_filter,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Error listing recommendations: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list recommendations")


@router.post("/recommendations/evaluate/{zone_id}", response_model=AIRecommendationResponse)
def evaluate_zone_recommendation(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates current zone conditions and generates a new AI irrigation recommendation.
    """
    try:
        rec = ai_service.evaluate_zone_recommendation(zone_id=zone_id, db=db)
        return rec
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error evaluating recommendation for zone {zone_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Evaluation failed: {str(e)}")


@router.post("/recommendations/{recommendation_id}/approve")
def approve_recommendation(
    recommendation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Human-in-the-loop approval: Operator approves an AI irrigation recommendation.
    Generates and approves a verified ProposedAction, dispatching pump actuation.
    """
    try:
        result = ai_service.approve_recommendation(
            recommendation_id=recommendation_id,
            user_email=current_user.email,
            db=db
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error approving recommendation {recommendation_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to approve recommendation")


@router.post("/recommendations/{recommendation_id}/reject")
def reject_recommendation(
    recommendation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Operator rejects an AI recommendation. Cancels any associated proposed action.
    """
    try:
        result = ai_service.reject_recommendation(
            recommendation_id=recommendation_id,
            user_email=current_user.email,
            db=db
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error rejecting recommendation {recommendation_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reject recommendation")


# =============================================================================
# FEATURE 4: WATER-USE OPTIMIZATION & PUMPING EFFICIENCY ANALYTICS
# =============================================================================

@router.get("/water-efficiency/{zone_id}", response_model=WaterEfficiencyResponse)
def get_water_efficiency(
    zone_id: str,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """
    Returns water-use and efficiency analytics for a zone over the specified days.
    Includes volume estimate, efficiency score, moisture response delta, and actionable tips.
    """
    try:
        return ai_service.get_water_efficiency_insights(
            zone_id=zone_id,
            days=days,
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing water efficiency for zone {zone_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to compute water efficiency")


# =============================================================================
# FEATURE 5: SMARTIRRIGATE AI CHATBOT ASSISTANT
# =============================================================================

@router.post("/chat", response_model=AIChatResponse)
async def chat_with_assistant(
    request: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Context-grounded AI conversational assistant.
    Retrieves live telemetry, plant configurations, and system states.
    If the operator requests irrigation, creates a ProposedAction requiring review (never toggles relay directly).
    """
    try:
        response = await ai_service.process_chat_query(
            user_msg=request.message,
            user_email=current_user.email,
            conversation_id=request.conversation_id,
            zone_id=request.zone_id,
            db=db
        )
        return response
    except Exception as e:
        logger.error(f"Error in AI chat assistant: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"AI Assistant error: {str(e)}")

