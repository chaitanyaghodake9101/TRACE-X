from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.user import User, UserRole
from app.models.review_priority import ReviewTask, ReviewActionLog
from app.schemas.review_priority import (
    ReviewTaskCreate,
    ReviewTaskResponse,
    ReviewActionLogCreate,
    ReviewActionLogResponse
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.decay_priority_engine import log_review_action

router = APIRouter()

@router.get("/cases/{case_id}/review-tasks", response_model=List[ReviewTaskResponse])
def list_case_review_tasks(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    tasks = db.query(ReviewTask).filter(ReviewTask.case_id == case_id).order_by(ReviewTask.created_at.desc()).all()
    
    res = []
    for t in tasks:
        ev = db.query(Evidence).filter(Evidence.id == t.evidence_id).first()
        assignee = db.query(User).filter(User.id == t.assigned_to).first() if t.assigned_to else None
        
        logs = db.query(ReviewActionLog).filter(ReviewActionLog.task_id == t.id).order_by(ReviewActionLog.created_at.desc()).all()
        log_responses = [
            ReviewActionLogResponse(
                id=l.id,
                task_id=l.task_id,
                action_taken=l.action_taken,
                notes=l.notes,
                performed_by=l.performed_by,
                performer_name=l.performer.full_name if l.performer else "Unknown",
                created_at=l.created_at
            )
            for l in logs
        ]

        res.append(ReviewTaskResponse(
            id=t.id,
            case_id=t.case_id,
            evidence_id=t.evidence_id,
            evidence_title=ev.title if ev else "Unknown",
            title=t.title,
            description=t.description,
            priority=t.priority,
            status=t.status,
            assigned_to=t.assigned_to,
            assignee_name=assignee.full_name if assignee else None,
            due_date=t.due_date,
            created_at=t.created_at,
            resolved_at=t.resolved_at,
            action_logs=log_responses
        ))
    return res

@router.post("/cases/{case_id}/review-tasks", response_model=ReviewTaskResponse, status_code=status.HTTP_201_CREATED)
def create_review_task(
    case_id: str,
    task_in: ReviewTaskCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot create review tasks.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    ev = db.query(Evidence).filter(Evidence.id == task_in.evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    task = ReviewTask(
        case_id=case_id,
        evidence_id=task_in.evidence_id,
        title=task_in.title,
        description=task_in.description,
        priority=task_in.priority,
        status="pending",
        assigned_to=task_in.assigned_to or current_user.id,
        due_date=task_in.due_date,
        created_at=datetime.utcnow()
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    log_audit_event(
        db=db,
        action="CREATE_REVIEW_TASK",
        resource_type="review_task",
        resource_id=task.id,
        user=current_user,
        case_id=case_id,
        details={"title": task.title, "priority": task.priority},
        request=request
    )

    assignee = db.query(User).filter(User.id == task.assigned_to).first() if task.assigned_to else None
    return ReviewTaskResponse(
        id=task.id,
        case_id=task.case_id,
        evidence_id=task.evidence_id,
        evidence_title=ev.title,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        assigned_to=task.assigned_to,
        assignee_name=assignee.full_name if assignee else None,
        due_date=task.due_date,
        created_at=task.created_at,
        resolved_at=task.resolved_at,
        action_logs=[]
    )

@router.post("/review-tasks/{task_id}/actions", response_model=ReviewActionLogResponse, status_code=status.HTTP_201_CREATED)
def perform_task_action(
    task_id: str,
    action_in: ReviewActionLogCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot log review actions.")

    try:
        log_entry = log_review_action(
            db=db,
            task_id=task_id,
            action_taken=action_in.action_taken,
            performed_by=current_user.id,
            notes=action_in.notes,
            new_status=action_in.new_status
        )

        task = db.query(ReviewTask).filter(ReviewTask.id == task_id).first()
        log_audit_event(
            db=db,
            action="LOG_REVIEW_ACTION",
            resource_type="review_action_log",
            resource_id=log_entry.id,
            user=current_user,
            case_id=task.case_id if task else None,
            details={"action_taken": action_in.action_taken, "new_status": action_in.new_status},
            request=request
        )

        return ReviewActionLogResponse(
            id=log_entry.id,
            task_id=log_entry.task_id,
            action_taken=log_entry.action_taken,
            notes=log_entry.notes,
            performed_by=log_entry.performed_by,
            performer_name=current_user.full_name,
            created_at=log_entry.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
