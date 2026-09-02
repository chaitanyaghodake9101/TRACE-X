from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.hypothesis import Hypothesis, EvidenceHypothesis, HypothesisScore
from app.models.evidence import Evidence
from app.models.user import User, UserRole
from app.schemas.hypothesis import (
    HypothesisCreate,
    HypothesisOut,
    EvidenceHypothesisCreate,
    EvidenceHypothesisOut,
    HypothesisScoreOut
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.hypothesis_engine import (
    calculate_hypothesis_score,
    recalculate_case_hypotheses,
    compare_hypotheses
)

router = APIRouter()

@router.get("/cases/{case_id}/hypotheses", response_model=List[HypothesisOut])
def list_case_hypotheses(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return db.query(Hypothesis).filter(Hypothesis.case_id == case_id).order_by(Hypothesis.created_at.asc()).all()

@router.post("/cases/{case_id}/hypotheses", response_model=HypothesisOut, status_code=status.HTTP_201_CREATED)
def create_hypothesis(
    case_id: str,
    hypo_in: HypothesisCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot create hypotheses.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    hypothesis = Hypothesis(
        case_id=case_id,
        title=hypo_in.title,
        description=hypo_in.description,
        status=hypo_in.status,
        created_by=current_user.id
    )
    db.add(hypothesis)
    db.commit()
    db.refresh(hypothesis)

    # Initialize baseline score
    calculate_hypothesis_score(db, hypothesis.id)
    db.refresh(hypothesis)

    log_audit_event(
        db=db,
        action="CREATE_HYPOTHESIS",
        resource_type="hypothesis",
        resource_id=hypothesis.id,
        user=current_user,
        case_id=case_id,
        details={"title": hypothesis.title},
        request=request
    )
    return hypothesis

@router.get("/hypotheses/{hypothesis_id}", response_model=HypothesisOut)
def get_hypothesis_detail(
    hypothesis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    return hypothesis

@router.delete("/hypotheses/{hypothesis_id}", status_code=status.HTTP_200_OK)
def delete_hypothesis(
    hypothesis_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot delete hypotheses.")

    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    case_id = hypothesis.case_id
    title = hypothesis.title

    db.delete(hypothesis)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_HYPOTHESIS",
        resource_type="hypothesis",
        resource_id=hypothesis_id,
        user=current_user,
        case_id=case_id,
        details={"title": title},
        request=request
    )
    return {"message": f"Hypothesis '{title}' successfully deleted."}

@router.post("/hypotheses/{hypothesis_id}/evidence", response_model=EvidenceHypothesisOut, status_code=status.HTTP_201_CREATED)
def link_evidence_to_hypothesis(
    hypothesis_id: str,
    link_in: EvidenceHypothesisCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot link evidence.")

    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    evidence = db.query(Evidence).filter(Evidence.id == link_in.evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    existing = db.query(EvidenceHypothesis).filter(
        EvidenceHypothesis.hypothesis_id == hypothesis_id,
        EvidenceHypothesis.evidence_id == link_in.evidence_id
    ).first()

    if existing:
        existing.relationship_type = link_in.relationship_type
        existing.relationship_strength = link_in.relationship_strength
        existing.rationale = link_in.rationale
        db.commit()
        db.refresh(existing)
        link = existing
    else:
        link = EvidenceHypothesis(
            hypothesis_id=hypothesis_id,
            evidence_id=link_in.evidence_id,
            relationship_type=link_in.relationship_type,
            relationship_strength=link_in.relationship_strength,
            rationale=link_in.rationale,
            linked_by=current_user.id
        )
        db.add(link)
        db.commit()
        db.refresh(link)

    # Recalculate hypothesis likelihood score
    calculate_hypothesis_score(db, hypothesis_id)

    log_audit_event(
        db=db,
        action="LINK_EVIDENCE_HYPOTHESIS",
        resource_type="hypothesis",
        resource_id=hypothesis_id,
        user=current_user,
        case_id=hypothesis.case_id,
        details={
            "evidence_id": link_in.evidence_id,
            "relationship_type": link_in.relationship_type.value,
            "relationship_strength": link_in.relationship_strength
        },
        request=request
    )
    return link

@router.delete("/hypotheses/{hypothesis_id}/evidence/{evidence_id}", status_code=status.HTTP_200_OK)
def unlink_evidence_from_hypothesis(
    hypothesis_id: str,
    evidence_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot modify evidence links.")

    link = db.query(EvidenceHypothesis).filter(
        EvidenceHypothesis.hypothesis_id == hypothesis_id,
        EvidenceHypothesis.evidence_id == evidence_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Evidence-Hypothesis link not found")

    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    db.delete(link)
    db.commit()

    # Recalculate score
    calculate_hypothesis_score(db, hypothesis_id)

    log_audit_event(
        db=db,
        action="UNLINK_EVIDENCE_HYPOTHESIS",
        resource_type="hypothesis",
        resource_id=hypothesis_id,
        user=current_user,
        case_id=hypothesis.case_id if hypothesis else None,
        details={"evidence_id": evidence_id},
        request=request
    )
    return {"message": "Evidence link successfully removed."}

@router.post("/hypotheses/{hypothesis_id}/recalculate")
def trigger_recalculate_hypothesis(
    hypothesis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    return calculate_hypothesis_score(db, hypothesis_id)

@router.get("/hypotheses/{hypothesis_id}/compare")
def compare_competing_hypotheses(
    hypothesis_id: str,
    target_id: str = Query(..., description="ID of the competing hypothesis to contrast against"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return compare_hypotheses(db, hypothesis_id, target_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
