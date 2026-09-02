from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.user import User, UserRole
from app.models.simulation import SimulationBranch, SimulationEvidenceOverride, SimulationReviewRequest
from app.schemas.simulation import (
    SimulationBranchCreate,
    SimulationBranchResponse,
    SimulationEvidenceOverrideCreate,
    SimulationEvidenceOverrideResponse,
    SimulationBranchComparison,
    SimulationReviewRequestCreate,
    SimulationReviewRequestResponse
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.counterfactual_engine import (
    create_simulation_branch,
    add_evidence_override,
    evaluate_simulation_branch
)

router = APIRouter()

@router.get("/cases/{case_id}/simulations", response_model=List[SimulationBranchResponse])
def list_case_simulation_branches(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    branches = db.query(SimulationBranch).filter(SimulationBranch.case_id == case_id).order_by(SimulationBranch.created_at.desc()).all()
    return branches

@router.post("/cases/{case_id}/simulations", response_model=SimulationBranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(
    case_id: str,
    branch_in: SimulationBranchCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot create simulation branches.")

    try:
        branch = create_simulation_branch(
            db=db,
            case_id=case_id,
            name=branch_in.name,
            description=branch_in.description,
            user_id=current_user.id
        )
        # Evaluate initial baseline
        evaluate_simulation_branch(db, branch.id)

        log_audit_event(
            db=db,
            action="CREATE_SIMULATION_BRANCH",
            resource_type="simulation_branch",
            resource_id=branch.id,
            user=current_user,
            case_id=case_id,
            details={"name": branch.name},
            request=request
        )
        return branch
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/simulations/{branch_id}", response_model=SimulationBranchResponse)
def get_branch_details(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    branch = db.query(SimulationBranch).filter(SimulationBranch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Simulation branch not found")
    return branch

@router.post("/simulations/{branch_id}/override", response_model=SimulationEvidenceOverrideResponse, status_code=status.HTTP_201_CREATED)
def add_override_to_branch(
    branch_id: str,
    override_in: SimulationEvidenceOverrideCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot alter simulations.")

    try:
        override = add_evidence_override(
            db=db,
            branch_id=branch_id,
            evidence_id=override_in.evidence_id,
            is_excluded=override_in.is_excluded,
            overridden_quality_score=override_in.overridden_quality_score,
            overridden_reliability=override_in.overridden_reliability,
            is_hypothetical=override_in.is_hypothetical,
            hypothetical_title=override_in.hypothetical_title,
            hypothetical_source_type=override_in.hypothetical_source_type,
            notes=override_in.notes
        )

        branch = db.query(SimulationBranch).filter(SimulationBranch.id == branch_id).first()
        log_audit_event(
            db=db,
            action="ADD_SIMULATION_OVERRIDE",
            resource_type="simulation_override",
            resource_id=override.id,
            user=current_user,
            case_id=branch.case_id if branch else None,
            details={"is_excluded": override_in.is_excluded, "evidence_id": override_in.evidence_id},
            request=request
        )
        return override
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/simulations/override/{override_id}", status_code=status.HTTP_200_OK)
def remove_override_from_branch(
    override_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot alter simulations.")

    override = db.query(SimulationEvidenceOverride).filter(SimulationEvidenceOverride.id == override_id).first()
    if not override:
        raise HTTPException(status_code=404, detail="Override not found")

    branch_id = override.branch_id
    db.delete(override)
    db.commit()

    # Recalculate
    evaluate_simulation_branch(db, branch_id)
    return {"message": "Evidence override removed and branch re-evaluated."}

@router.get("/simulations/{branch_id}/compare", response_model=SimulationBranchComparison)
def compare_branch_vs_official(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        res = evaluate_simulation_branch(db, branch_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/simulations/{branch_id}/request-review", response_model=SimulationReviewRequestResponse, status_code=status.HTTP_201_CREATED)
def request_official_case_review(
    branch_id: str,
    review_in: SimulationReviewRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    branch = db.query(SimulationBranch).filter(SimulationBranch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Simulation branch not found")

    req = SimulationReviewRequest(
        branch_id=branch_id,
        case_id=branch.case_id,
        requested_by=current_user.id,
        status="pending",
        review_notes=review_in.review_notes
    )
    branch.status = "submitted_review"
    db.add(req)
    db.commit()
    db.refresh(req)

    log_audit_event(
        db=db,
        action="REQUEST_SIMULATION_REVIEW",
        resource_type="simulation_review_request",
        resource_id=req.id,
        user=current_user,
        case_id=branch.case_id,
        details={"branch_name": branch.name},
        request=request
    )
    return req
