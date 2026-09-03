from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case, CaseStatus, CasePriority
from app.models.user import User, UserRole
from app.schemas.case import CaseCreate, CaseUpdate, CaseStatusUpdate, CaseAssignUpdate, CaseOut
from app.api.v1.endpoints.auth import get_current_user, require_roles

router = APIRouter()

def get_case_with_permission(case_id: str, db: Session, current_user: User) -> Case:
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    
    # Check access permission: Admins, Senior Investigators, and Auditors see all; Investigators see only their own
    if current_user.role == UserRole.INVESTIGATOR:
        if case.created_by != current_user.id and case.assigned_to != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view or manage this case."
            )
    return case

@router.get("/", response_model=List[CaseOut])
def list_cases(
    status_filter: Optional[CaseStatus] = None,
    priority_filter: Optional[CasePriority] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Case)
    
    # RBAC: Investigators only see cases they created or are assigned to
    if current_user.role == UserRole.INVESTIGATOR:
        query = query.filter(
            or_(Case.created_by == current_user.id, Case.assigned_to == current_user.id)
        )
    
    if status_filter:
        query = query.filter(Case.status == status_filter)
    if priority_filter:
        query = query.filter(Case.priority == priority_filter)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Case.title.ilike(search_pattern),
                Case.case_number.ilike(search_pattern),
                Case.description.ilike(search_pattern)
            )
        )
    
    cases = query.order_by(Case.updated_at.desc()).all()
    
    result = []
    for c in cases:
        c_out = CaseOut.model_validate(c)
        c_out.evidence_count = len(c.evidence_items)
        c_out.entity_count = len(c.entities)
        c_out.hypothesis_count = len(c.hypotheses)
        c_out.action_count = len(c.actions)
        result.append(c_out)
    return result

@router.post("/", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    case_in: CaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Auditors are read-only
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auditors have read-only permissions and cannot create cases."
        )

    existing = db.query(Case).filter(Case.case_number == case_in.case_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Case with case number '{case_in.case_number}' already exists"
        )
    
    case = Case(
        title=case_in.title,
        case_number=case_in.case_number,
        description=case_in.description,
        status=case_in.status,
        priority=case_in.priority,
        created_by=current_user.id,
        assigned_to=case_in.assigned_to or current_user.id
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    
    log_audit_event(
        db=db,
        action="CREATE_CASE",
        resource_type="case",
        resource_id=case.id,
        user=current_user,
        case_id=case.id,
        details={"case_number": case.case_number, "title": case.title, "priority": case.priority.value},
        request=request
    )
    
    c_out = CaseOut.model_validate(case)
    return c_out

@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_with_permission(case_id, db, current_user)
    c_out = CaseOut.model_validate(case)
    c_out.evidence_count = len(case.evidence_items)
    c_out.entity_count = len(case.entities)
    c_out.hypothesis_count = len(case.hypotheses)
    c_out.action_count = len(case.actions)
    return c_out

@router.put("/{case_id}", response_model=CaseOut)
def update_case(
    case_id: str,
    case_update: CaseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_with_permission(case_id, db, current_user)
    
    # Investigators can only update description and status of their cases
    if current_user.role == UserRole.INVESTIGATOR:
        if case_update.assigned_to and case_update.assigned_to != case.assigned_to:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Investigators cannot reassign cases. Contact a Senior Investigator or Admin."
            )

    if case_update.title is not None:
        case.title = case_update.title
    if case_update.description is not None:
        case.description = case_update.description
    if case_update.status is not None:
        case.status = case_update.status
    if case_update.priority is not None:
        case.priority = case_update.priority
    if case_update.assigned_to is not None:
        case.assigned_to = case_update.assigned_to

    db.commit()
    db.refresh(case)

    log_audit_event(
        db=db,
        action="UPDATE_CASE",
        resource_type="case",
        resource_id=case.id,
        user=current_user,
        case_id=case.id,
        details={"status": case.status.value, "priority": case.priority.value},
        request=request
    )

    c_out = CaseOut.model_validate(case)
    c_out.evidence_count = len(case.evidence_items)
    c_out.entity_count = len(case.entities)
    c_out.hypothesis_count = len(case.hypotheses)
    c_out.action_count = len(case.actions)
    return c_out

@router.patch("/{case_id}/status", response_model=CaseOut)
def change_case_status(
    case_id: str,
    status_in: CaseStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_with_permission(case_id, db, current_user)
    old_status = case.status
    case.status = status_in.status
    db.commit()
    db.refresh(case)

    log_audit_event(
        db=db,
        action="CHANGE_CASE_STATUS",
        resource_type="case",
        resource_id=case.id,
        user=current_user,
        case_id=case.id,
        details={"from": old_status.value, "to": case.status.value},
        request=request
    )

    c_out = CaseOut.model_validate(case)
    c_out.evidence_count = len(case.evidence_items)
    c_out.entity_count = len(case.entities)
    c_out.hypothesis_count = len(case.hypotheses)
    c_out.action_count = len(case.actions)
    return c_out

@router.patch("/{case_id}/assign", response_model=CaseOut)
def assign_case(
    case_id: str,
    assign_in: CaseAssignUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SENIOR_INVESTIGATOR]))
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    assignee = db.query(User).filter(User.id == assign_in.assigned_to).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee user not found")

    case.assigned_to = assignee.id
    db.commit()
    db.refresh(case)

    log_audit_event(
        db=db,
        action="ASSIGN_CASE",
        resource_type="case",
        resource_id=case.id,
        user=current_user,
        case_id=case.id,
        details={"assigned_to": assignee.email},
        request=request
    )

    c_out = CaseOut.model_validate(case)
    c_out.evidence_count = len(case.evidence_items)
    c_out.entity_count = len(case.entities)
    c_out.hypothesis_count = len(case.hypotheses)
    c_out.action_count = len(case.actions)
    return c_out

@router.delete("/{case_id}", status_code=status.HTTP_200_OK)
def delete_case(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SENIOR_INVESTIGATOR]))
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case_num = case.case_number
    db.delete(case)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_CASE",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        details={"case_number": case_num},
        request=request
    )
    return {"message": f"Case {case_num} successfully deleted."}

# --- Case Officer Assignments ---

@router.get("/{case_id}/officers")
def list_case_officers(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = get_case_with_permission(case_id, db, current_user)
    memberships = case.case_memberships or []
    
    officers = []
    # If primary assigned_to is set and not already in memberships, include as lead
    member_user_ids = {m.user_id for m in memberships if m.is_active}
    
    if case.assigned_to and case.assigned_to not in member_user_ids:
        lead_u = db.query(User).filter(User.id == case.assigned_to).first()
        if lead_u:
            officers.append({
                "id": f"lead_{lead_u.id}",
                "case_id": case.id,
                "user_id": lead_u.id,
                "full_name": lead_u.full_name,
                "email": lead_u.email,
                "badge_number": lead_u.badge_number,
                "role": lead_u.role.value if hasattr(lead_u.role, 'value') else str(lead_u.role),
                "station": lead_u.station,
                "assignment_role": "lead_investigator",
                "is_active": True,
                "assigned_at": case.created_at.isoformat()
            })

    for m in memberships:
        if not m.is_active:
            continue
        u = m.user
        if u:
            officers.append({
                "id": m.id,
                "case_id": case.id,
                "user_id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "badge_number": u.badge_number,
                "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
                "station": u.station,
                "assignment_role": m.assignment_role,
                "is_active": m.is_active,
                "assigned_at": m.assigned_at.isoformat() if m.assigned_at else None
            })

    return officers

@router.post("/{case_id}/officers")
def assign_officer_to_case(
    case_id: str,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SENIOR_INVESTIGATOR]))
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    user_id = payload.get("user_id") or payload.get("officer_id")
    assignment_role = payload.get("assignment_role", "investigator")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    officer_user = db.query(User).filter(User.id == user_id).first()
    if not officer_user:
        raise HTTPException(status_code=404, detail="Officer user not found")

    from app.models.officer_extension import CaseMembership
    existing = db.query(CaseMembership).filter(
        CaseMembership.case_id == case_id,
        CaseMembership.user_id == user_id
    ).first()

    if existing:
        existing.is_active = True
        existing.assignment_role = assignment_role
        existing.assigned_by = current_user.id
        db.commit()
        db.refresh(existing)
        mem = existing
    else:
        mem = CaseMembership(
            case_id=case_id,
            user_id=user_id,
            assignment_role=assignment_role,
            is_active=True,
            assigned_by=current_user.id
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)

    log_audit_event(
        db=db,
        action="ASSIGN_CASE_OFFICER",
        resource_type="case_membership",
        resource_id=mem.id,
        user=current_user,
        case_id=case_id,
        details={"officer_email": officer_user.email, "role": assignment_role},
        request=request
    )

    return {
        "id": mem.id,
        "case_id": case_id,
        "user_id": officer_user.id,
        "full_name": officer_user.full_name,
        "email": officer_user.email,
        "badge_number": officer_user.badge_number,
        "role": officer_user.role.value if hasattr(officer_user.role, 'value') else str(officer_user.role),
        "assignment_role": mem.assignment_role,
        "is_active": mem.is_active
    }

@router.delete("/{case_id}/officers/{officer_id}")
def remove_officer_from_case(
    case_id: str,
    officer_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.SENIOR_INVESTIGATOR]))
):
    from app.models.officer_extension import CaseMembership
    # Can match by membership ID or user ID
    mem = db.query(CaseMembership).filter(
        CaseMembership.case_id == case_id,
        (CaseMembership.id == officer_id) | (CaseMembership.user_id == officer_id)
    ).first()

    if not mem:
        raise HTTPException(status_code=404, detail="Case officer assignment not found")

    mem.is_active = False
    db.commit()

    log_audit_event(
        db=db,
        action="REMOVE_CASE_OFFICER",
        resource_type="case_membership",
        resource_id=mem.id,
        user=current_user,
        case_id=case_id,
        details={"removed_user_id": mem.user_id},
        request=request
    )

    return {"message": "Officer removed from case successfully."}

