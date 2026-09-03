from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.core.security import get_password_hash
from app.models.user import User, UserRole, RefreshTokenSession
from app.models.case import Case
from app.models.officer_extension import OfficerProfile, OfficerStatusHistory, OfficerRoleHistory, CaseMembership
from app.schemas.officer_extension import (
    EnhancedOfficerCreate,
    EnhancedOfficerUpdate,
    EnhancedOfficerOut,
    OfficerProfileIn,
    OfficerProfileOut,
    CaseMembershipCreate,
    CaseMembershipOut,
    OfficerHistoryOut
)
from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.endpoints.admin import require_admin, require_admin_or_auditor

router = APIRouter(prefix="/admin/officers", tags=["Officer Management"])

@router.get("", response_model=List[EnhancedOfficerOut])
@router.get("/", response_model=List[EnhancedOfficerOut])
@router.get("/extended", response_model=List[EnhancedOfficerOut])
def list_enhanced_officers(
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_auditor)
):
    query = db.query(User).outerjoin(OfficerProfile, User.id == OfficerProfile.user_id)

    if role and role != "all":
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if district and district != "all":
        query = query.filter(OfficerProfile.district == district)

    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            (func.lower(User.full_name).like(term)) |
            (func.lower(User.email).like(term)) |
            (func.lower(User.badge_number).like(term)) |
            (func.lower(User.station).like(term)) |
            (func.lower(OfficerProfile.designation).like(term)) |
            (func.lower(OfficerProfile.district).like(term))
        )

    users = query.order_by(User.created_at.desc()).all()
    results = []
    for u in users:
        created_count = db.query(Case).filter(Case.created_by == u.id).count()
        assigned_count = db.query(Case).filter(Case.assigned_to == u.id).count()
        prof_out = None
        if hasattr(u, "officer_profile") and u.officer_profile:
            prof = u.officer_profile[0] if isinstance(u.officer_profile, list) else u.officer_profile
            prof_out = OfficerProfileOut.from_orm(prof) if prof else None

        results.append(
            EnhancedOfficerOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                phone_number=u.phone_number,
                badge_number=u.badge_number,
                station=u.station,
                is_active=u.is_active,
                has_completed_tour=u.has_completed_tour,
                created_at=u.created_at,
                updated_at=u.updated_at,
                created_cases_count=created_count,
                assigned_cases_count=assigned_count,
                profile=prof_out
            )
        )
    return results

@router.post("", response_model=EnhancedOfficerOut)
@router.post("/", response_model=EnhancedOfficerOut)
@router.post("/create-extended", response_model=EnhancedOfficerOut)
def create_enhanced_officer(
    officer_in: EnhancedOfficerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = db.query(User).filter(User.email == officer_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An officer with this email already exists")

    if officer_in.badge_number:
        existing_badge = db.query(User).filter(User.badge_number == officer_in.badge_number).first()
        if existing_badge:
            raise HTTPException(status_code=400, detail="Badge number already assigned to another officer")

    user = User(
        email=officer_in.email,
        hashed_password=get_password_hash(officer_in.password),
        full_name=officer_in.full_name,
        role=officer_in.role,
        phone_number=officer_in.phone_number,
        badge_number=officer_in.badge_number,
        station=officer_in.station,
        is_active=True,
        is_verified=True,
        has_completed_tour=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create Officer Profile
    prof = OfficerProfile(
        user_id=user.id,
        designation=officer_in.designation or "Investigative Officer",
        district=officer_in.district or "Central",
        state=officer_in.state or "Delhi (NCT)",
        rank=officer_in.rank or "Inspector",
        department=officer_in.department or "Special Investigation Unit"
    )
    db.add(prof)

    # Log initial role and status history
    status_hist = OfficerStatusHistory(
        user_id=user.id,
        previous_status=False,
        new_status=True,
        reason="Initial account creation and onboarding",
        changed_by=current_user.id
    )
    role_hist = OfficerRoleHistory(
        user_id=user.id,
        previous_role="NONE",
        new_role=user.role.value,
        reason="Initial role assignment",
        changed_by=current_user.id
    )
    db.add(status_hist)
    db.add(role_hist)
    db.commit()
    db.refresh(prof)

    log_audit_event(
        db=db,
        action="CREATE_OFFICER_ACCOUNT",
        resource_type="user",
        resource_id=user.id,
        user=current_user,
        details={"email": user.email, "role": user.role.value, "badge": user.badge_number},
        request=request
    )

    try:
        from app.api.v1.endpoints.ws import broadcast_event_sync
        broadcast_event_sync({
            "type": "officer.created",
            "resource_type": "officer",
            "resource_id": user.id,
            "version": 1,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception:
        pass

    return EnhancedOfficerOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone_number=user.phone_number,
        badge_number=user.badge_number,
        station=user.station,
        is_active=user.is_active,
        has_completed_tour=user.has_completed_tour,
        created_at=user.created_at,
        updated_at=user.updated_at,
        created_cases_count=0,
        assigned_cases_count=0,
        profile=OfficerProfileOut.from_orm(prof)
    )

@router.patch("/{officer_id}/profile", response_model=EnhancedOfficerOut)
def update_enhanced_officer_profile(
    officer_id: str,
    officer_in: EnhancedOfficerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == officer_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found")

    prof = db.query(OfficerProfile).filter(OfficerProfile.user_id == officer_id).first()
    if not prof:
        prof = OfficerProfile(user_id=officer_id)
        db.add(prof)

    # Track role changes
    if officer_in.role is not None and officer_in.role != user.role:
        old_role = user.role.value
        user.role = officer_in.role
        role_hist = OfficerRoleHistory(
            user_id=user.id,
            previous_role=old_role,
            new_role=officer_in.role.value,
            reason=officer_in.reason or "Administrative role promotion/reassignment",
            changed_by=current_user.id
        )
        db.add(role_hist)

    if officer_in.full_name is not None:
        user.full_name = officer_in.full_name
    if officer_in.phone_number is not None:
        user.phone_number = officer_in.phone_number
    if officer_in.badge_number is not None:
        user.badge_number = officer_in.badge_number
    if officer_in.station is not None:
        user.station = officer_in.station

    if officer_in.designation is not None:
        prof.designation = officer_in.designation
    if officer_in.district is not None:
        prof.district = officer_in.district
    if officer_in.state is not None:
        prof.state = officer_in.state
    if officer_in.rank is not None:
        prof.rank = officer_in.rank
    if officer_in.department is not None:
        prof.department = officer_in.department

    user.updated_at = datetime.utcnow()
    prof.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    db.refresh(prof)

    log_audit_event(
        db=db,
        action="UPDATE_OFFICER_EXTENDED_PROFILE",
        resource_type="user",
        resource_id=user.id,
        user=current_user,
        details={"designation": prof.designation, "district": prof.district, "role": user.role.value},
        request=request
    )

    created_count = db.query(Case).filter(Case.created_by == user.id).count()
    assigned_count = db.query(Case).filter(Case.assigned_to == user.id).count()

    return EnhancedOfficerOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone_number=user.phone_number,
        badge_number=user.badge_number,
        station=user.station,
        is_active=user.is_active,
        has_completed_tour=user.has_completed_tour,
        created_at=user.created_at,
        updated_at=user.updated_at,
        created_cases_count=created_count,
        assigned_cases_count=assigned_count,
        profile=OfficerProfileOut.from_orm(prof)
    )

@router.get("/{officer_id}/history", response_model=OfficerHistoryOut)
def get_officer_full_history(
    officer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_auditor)
):
    user = db.query(User).filter(User.id == officer_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found")

    status_history = (
        db.query(OfficerStatusHistory)
        .filter(OfficerStatusHistory.user_id == officer_id)
        .order_by(OfficerStatusHistory.changed_at.desc())
        .all()
    )
    role_history = (
        db.query(OfficerRoleHistory)
        .filter(OfficerRoleHistory.user_id == officer_id)
        .order_by(OfficerRoleHistory.changed_at.desc())
        .all()
    )
    memberships = (
        db.query(CaseMembership)
        .filter(CaseMembership.user_id == officer_id)
        .order_by(CaseMembership.assigned_at.desc())
        .all()
    )

    memberships_out = []
    for m in memberships:
        case = db.query(Case).filter(Case.id == m.case_id).first()
        memberships_out.append(
            CaseMembershipOut(
                id=m.id,
                case_id=m.case_id,
                user_id=m.user_id,
                case_title=case.title if case else None,
                case_number=case.case_number if case else None,
                assignment_role=m.assignment_role,
                is_active=m.is_active,
                assigned_by=m.assigned_by,
                assigned_at=m.assigned_at
            )
        )

    return OfficerHistoryOut(
        status_history=[
            {
                "id": s.id,
                "previous_status": s.previous_status,
                "new_status": s.new_status,
                "reason": s.reason,
                "changed_by": s.changed_by,
                "changed_at": s.changed_at
            }
            for s in status_history
        ],
        role_history=[
            {
                "id": r.id,
                "previous_role": r.previous_role,
                "new_role": r.new_role,
                "reason": r.reason,
                "changed_by": r.changed_by,
                "changed_at": r.changed_at
            }
            for r in role_history
        ],
        case_memberships=memberships_out
    )

@router.post("/{officer_id}/case-assignments", response_model=CaseMembershipOut)
def assign_officer_to_case(
    officer_id: str,
    assign_in: CaseMembershipCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == officer_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found")

    case = db.query(Case).filter(Case.id == assign_in.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    existing = (
        db.query(CaseMembership)
        .filter(CaseMembership.case_id == assign_in.case_id, CaseMembership.user_id == officer_id)
        .first()
    )
    if existing:
        existing.is_active = True
        existing.assignment_role = assign_in.assignment_role
        existing.assigned_at = datetime.utcnow()
        existing.assigned_by = current_user.id
        membership = existing
    else:
        membership = CaseMembership(
            case_id=assign_in.case_id,
            user_id=officer_id,
            assignment_role=assign_in.assignment_role,
            is_active=True,
            assigned_by=current_user.id,
            assigned_at=datetime.utcnow()
        )
        db.add(membership)

    db.commit()
    db.refresh(membership)

    log_audit_event(
        db=db,
        action="ASSIGN_OFFICER_CASE",
        resource_type="case_membership",
        resource_id=membership.id,
        user=current_user,
        case_id=case.id,
        details={"officer_id": officer_id, "case_id": case.id, "role": assign_in.assignment_role},
        request=request
    )

    return CaseMembershipOut(
        id=membership.id,
        case_id=membership.case_id,
        user_id=membership.user_id,
        case_title=case.title,
        case_number=case.case_number,
        assignment_role=membership.assignment_role,
        is_active=membership.is_active,
        assigned_by=membership.assigned_by,
        assigned_at=membership.assigned_at
    )

@router.get("/{officer_id}", response_model=EnhancedOfficerOut)
def get_officer_details(
    officer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_auditor)
):
    u = db.query(User).filter(User.id == officer_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Officer not found")

    created_count = db.query(Case).filter(Case.created_by == u.id).count()
    assigned_count = db.query(Case).filter(Case.assigned_to == u.id).count()
    prof_out = None
    if hasattr(u, "officer_profile") and u.officer_profile:
        prof = u.officer_profile[0] if isinstance(u.officer_profile, list) else u.officer_profile
        prof_out = OfficerProfileOut.from_orm(prof) if prof else None

    return EnhancedOfficerOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        phone_number=u.phone_number,
        badge_number=u.badge_number,
        station=u.station,
        is_active=u.is_active,
        has_completed_tour=u.has_completed_tour,
        created_at=u.created_at,
        updated_at=u.updated_at,
        created_cases_count=created_count,
        assigned_cases_count=assigned_count,
        profile=prof_out
    )

@router.patch("/{officer_id}", response_model=EnhancedOfficerOut)
def patch_officer(
    officer_id: str,
    officer_in: EnhancedOfficerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return update_enhanced_officer_profile(
        officer_id=officer_id,
        officer_in=officer_in,
        request=request,
        db=db,
        current_user=current_user
    )

@router.post("/{officer_id}/deactivate")
def deactivate_officer(
    officer_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == officer_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found")

    user.is_active = False
    user.updated_at = datetime.utcnow()
    db.commit()

    log_audit_event(
        db=db,
        action="DEACTIVATE_OFFICER_ACCOUNT",
        resource_type="user",
        resource_id=user.id,
        user=current_user,
        details={"email": user.email, "badge": user.badge_number},
        request=request
    )

    return {"message": f"Officer {user.full_name} deactivated successfully."}

@router.post("/{officer_id}/reset-password")
def trigger_officer_password_reset(
    officer_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == officer_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found")

    import secrets
    temp_pass = f"TRACEX-{secrets.token_hex(4).upper()}!"
    user.hashed_password = get_password_hash(temp_pass)
    user.updated_at = datetime.utcnow()
    db.commit()

    log_audit_event(
        db=db,
        action="ADMIN_RESET_OFFICER_PASSWORD",
        resource_type="user",
        resource_id=user.id,
        user=current_user,
        details={"email": user.email},
        request=request
    )

    return {
        "message": f"Temporary password reset generated for {user.full_name}.",
        "temporary_password": temp_pass
    }

