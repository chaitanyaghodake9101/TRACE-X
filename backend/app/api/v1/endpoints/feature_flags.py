from datetime import datetime
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.feature_flag import FeatureFlag
from app.schemas.feature_flag import FeatureFlagUpdate, FeatureFlagOut
from app.services.event_publisher import publish_domain_event
from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.endpoints.admin import require_admin

router = APIRouter(tags=["Feature Flags"])

DEFAULT_FLAGS = [
    {
        "key": "admin_officer_edit_enabled",
        "name": "Enhanced Officer Profiles & Case Assignments",
        "description": "Enables extended officer profile metadata (designation, district, rank), status history timeline, and multi-case assignment tracking.",
        "is_enabled": True,
        "category": "admin"
    },
    {
        "key": "admin_content_management_enabled",
        "name": "About Us & Content CMS Engine",
        "description": "Enables markdown-based content management, live preview, version snapshots, and point-in-time rollback for institutional pages.",
        "is_enabled": True,
        "category": "cms"
    },
    {
        "key": "admin_tutorial_management_enabled",
        "name": "Interactive Tutorials & Video Knowledge Base",
        "description": "Enables creation of step-by-step interactive onboarding tutorials with embedded privacy-enhanced video player.",
        "is_enabled": True,
        "category": "training"
    },
    {
        "key": "theme_branding_management_enabled",
        "name": "Dynamic Theme & Branding Customization",
        "description": "Allows live customization of primary and accent palettes, typography, background modes, and custom CSS token layers.",
        "is_enabled": True,
        "category": "theme"
    },
    {
        "key": "realtime_config_sync_enabled",
        "name": "Real-time Transactional Outbox & WebSocket Sync",
        "description": "Broadcasts instant configuration and case update signals over WebSocket outbox channels to connected investigator sessions.",
        "is_enabled": True,
        "category": "realtime"
    }
]

def ensure_default_flags(db: Session):
    for df in DEFAULT_FLAGS:
        existing = db.query(FeatureFlag).filter(FeatureFlag.key == df["key"]).first()
        if not existing:
            flag = FeatureFlag(
                key=df["key"],
                name=df["name"],
                description=df["description"],
                is_enabled=df["is_enabled"],
                category=df["category"]
            )
            db.add(flag)
    db.commit()

@router.get("/config/flags", response_model=Dict[str, bool])
def get_public_feature_flags(db: Session = Depends(get_db)):
    ensure_default_flags(db)
    flags = db.query(FeatureFlag).all()
    return {f.key: f.is_enabled for f in flags}

@router.get("/admin/config/flags", response_model=List[FeatureFlagOut])
def list_admin_feature_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    ensure_default_flags(db)
    flags = db.query(FeatureFlag).order_by(FeatureFlag.category.asc(), FeatureFlag.key.asc()).all()
    return flags

@router.patch("/admin/config/flags/{flag_key}", response_model=FeatureFlagOut)
def toggle_feature_flag(
    flag_key: str,
    flag_in: FeatureFlagUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    ensure_default_flags(db)
    flag = db.query(FeatureFlag).filter(FeatureFlag.key == flag_key).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    old_state = flag.is_enabled
    flag.is_enabled = flag_in.is_enabled
    if flag_in.description is not None:
        flag.description = flag_in.description
    flag.updated_at = datetime.utcnow()
    flag.updated_by = current_user.id
    db.commit()
    db.refresh(flag)

    log_audit_event(
        db=db,
        action="TOGGLE_FEATURE_FLAG",
        resource_type="feature_flag",
        resource_id=flag.key,
        user=current_user,
        details={"flag_key": flag.key, "old_state": old_state, "new_state": flag.is_enabled},
        request=request
    )

    # Publish real-time outbox event for live frontend cache invalidation
    try:
        publish_domain_event(
            db=db,
            event_type="config.feature_flag_updated.v1",
            aggregate_id=flag.key,
            aggregate_type="feature_flag",
            payload={
                "flag_key": flag.key,
                "is_enabled": flag.is_enabled,
                "updated_at": flag.updated_at.isoformat(),
                "updated_by": current_user.email
            }
        )
    except Exception as e:
        print(f"Warning: Outbox publication failed: {e}")

    return flag

@router.post("/admin/config/flags/initialize")
def initialize_feature_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    ensure_default_flags(db)
    return {"message": "Feature flags successfully initialized", "count": len(DEFAULT_FLAGS)}
