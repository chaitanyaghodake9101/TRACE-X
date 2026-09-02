from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.user import User, UserRole
from app.models.review_priority import ReviewPriorityScore
from app.schemas.review_priority import ReviewPriorityScoreResponse
from app.api.v1.endpoints.auth import get_current_user
from app.services.decay_priority_engine import (
    calculate_evidence_review_urgency,
    recalculate_case_review_priorities
)

router = APIRouter()

@router.get("/cases/{case_id}/review-priorities", response_model=List[ReviewPriorityScoreResponse])
def get_case_review_priorities(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    scores = (
        db.query(ReviewPriorityScore)
        .filter(ReviewPriorityScore.case_id == case_id)
        .order_by(ReviewPriorityScore.composite_urgency_score.desc())
        .all()
    )

    if not scores:
        # Initial on-demand calculation
        recalculate_case_review_priorities(db, case_id)
        scores = (
            db.query(ReviewPriorityScore)
            .filter(ReviewPriorityScore.case_id == case_id)
            .order_by(ReviewPriorityScore.composite_urgency_score.desc())
            .all()
        )

    # Attach evidence title & source type
    res = []
    for s in scores:
        ev = db.query(Evidence).filter(Evidence.id == s.evidence_id).first()
        res.append(ReviewPriorityScoreResponse(
            id=s.id,
            evidence_id=s.evidence_id,
            evidence_title=ev.title if ev else "Unknown",
            evidence_source_type=ev.source_type.value if ev else "other",
            case_id=s.case_id,
            temporal_urgency_score=s.temporal_urgency_score,
            integrity_urgency_score=s.integrity_urgency_score,
            volatility_score=s.volatility_score,
            downstream_impact_score=s.downstream_impact_score,
            corroboration_deficit_score=s.corroboration_deficit_score,
            composite_urgency_score=s.composite_urgency_score,
            suggested_review_tier=s.suggested_review_tier,
            explanation_json=s.explanation_json,
            calculated_at=s.calculated_at
        ))
    return res

@router.post("/cases/{case_id}/review-priorities/recalculate", response_model=List[ReviewPriorityScoreResponse])
def trigger_recalculate_review_priorities(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    recalculate_case_review_priorities(db, case_id)

    log_audit_event(
        db=db,
        action="RECALCULATE_REVIEW_PRIORITIES",
        resource_type="review_priorities",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details={"case_number": case.case_number},
        request=request
    )

    return get_case_review_priorities(case_id, db, current_user)
