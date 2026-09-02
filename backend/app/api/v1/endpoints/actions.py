from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.action import InvestigativeAction, ActionOutcome, ActionStatus
from app.models.user import User, UserRole
from app.schemas.action import (
    ActionCreate,
    ActionUpdate,
    ActionOut,
    ActionOutcomeCreate,
    ActionOutcomeOut
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.action_engine import (
    compute_action_eig,
    prioritize_case_actions,
    complete_action_and_log_outcome
)

router = APIRouter()

@router.get("/cases/{case_id}/actions", response_model=List[ActionOut])
def list_case_actions(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return db.query(InvestigativeAction).filter(InvestigativeAction.case_id == case_id).order_by(InvestigativeAction.priority_rank.asc()).all()

@router.post("/cases/{case_id}/actions", response_model=ActionOut, status_code=status.HTTP_201_CREATED)
def create_investigative_action(
    case_id: str,
    action_in: ActionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot create investigative actions.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    action = InvestigativeAction(
        case_id=case_id,
        title=action_in.title,
        description=action_in.description,
        action_type=action_in.action_type,
        target_entity_id=action_in.target_entity_id,
        assigned_to=action_in.assigned_to or current_user.id
    )
    db.add(action)
    db.commit()
    db.refresh(action)

    # Calculate EIG and prioritize case actions
    prioritize_case_actions(db, case_id)
    db.refresh(action)

    log_audit_event(
        db=db,
        action="CREATE_INVESTIGATIVE_ACTION",
        resource_type="action",
        resource_id=action.id,
        user=current_user,
        case_id=case_id,
        details={
            "title": action.title,
            "action_type": action.action_type.value,
            "expected_information_gain": action.expected_information_gain,
            "priority_rank": action.priority_rank
        },
        request=request
    )
    return action

@router.get("/actions/{action_id}", response_model=ActionOut)
def get_action_detail(
    action_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    action = db.query(InvestigativeAction).filter(InvestigativeAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Investigative action not found")
    return action

@router.patch("/actions/{action_id}", response_model=ActionOut)
def update_action(
    action_id: str,
    action_in: ActionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot update actions.")

    action = db.query(InvestigativeAction).filter(InvestigativeAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Investigative action not found")

    update_data = action_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)

    db.commit()
    prioritize_case_actions(db, action.case_id)
    db.refresh(action)

    log_audit_event(
        db=db,
        action="UPDATE_INVESTIGATIVE_ACTION",
        resource_type="action",
        resource_id=action.id,
        user=current_user,
        case_id=action.case_id,
        details={"updated_fields": list(update_data.keys())},
        request=request
    )
    return action

@router.delete("/actions/{action_id}", status_code=status.HTTP_200_OK)
def delete_action(
    action_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot delete actions.")

    action = db.query(InvestigativeAction).filter(InvestigativeAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Investigative action not found")

    case_id = action.case_id
    title = action.title

    db.delete(action)
    db.commit()

    prioritize_case_actions(db, case_id)

    log_audit_event(
        db=db,
        action="DELETE_INVESTIGATIVE_ACTION",
        resource_type="action",
        resource_id=action_id,
        user=current_user,
        case_id=case_id,
        details={"title": title},
        request=request
    )
    return {"message": f"Action '{title}' deleted."}

@router.post("/cases/{case_id}/actions/prioritize", response_model=List[ActionOut])
def trigger_prioritize_actions(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    ranked_actions = prioritize_case_actions(db, case_id)

    log_audit_event(
        db=db,
        action="PRIORITIZE_ACTIONS",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details={"ranked_actions_count": len(ranked_actions)},
        request=request
    )
    return ranked_actions

@router.post("/actions/{action_id}/complete", response_model=ActionOutcomeOut)
def complete_action(
    action_id: str,
    outcome_in: ActionOutcomeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot complete actions.")

    action = db.query(InvestigativeAction).filter(InvestigativeAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Investigative action not found")

    outcome = complete_action_and_log_outcome(
        db=db,
        action_id=action_id,
        outcome_notes=outcome_in.outcome_notes,
        produced_new_evidence=outcome_in.produced_new_evidence,
        evidence_id=outcome_in.evidence_id,
        effectiveness_score=outcome_in.effectiveness_score,
        user_id=current_user.id
    )

    log_audit_event(
        db=db,
        action="COMPLETE_INVESTIGATIVE_ACTION",
        resource_type="action",
        resource_id=action_id,
        user=current_user,
        case_id=action.case_id,
        details={
            "effectiveness_score": outcome.effectiveness_score,
            "produced_new_evidence": outcome.produced_new_evidence
        },
        request=request
    )
    return outcome
