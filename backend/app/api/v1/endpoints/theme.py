from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.theme import ThemeConfiguration, ThemeVersion, UserThemePreference
from app.schemas.theme import (
    ThemeConfigurationCreate,
    ThemeConfigurationUpdate,
    ThemeConfigurationOut,
    ThemeVersionOut,
    UserThemePreferenceIn,
    UserThemePreferenceOut
)
from app.api.v1.endpoints.auth import get_current_user, get_optional_current_user
from app.api.v1.endpoints.admin import require_admin

router = APIRouter(tags=["Theme & Branding"])

DEFAULT_SYSTEM_THEME = {
    "name": "Default Cyber Cyan (System Hard Fallback)",
    "primary_color": "#06b6d4",
    "accent_color": "#3b82f6",
    "background_mode": "slate",
    "font_family": "Inter",
    "border_radius": "0.75rem",
    "is_active": True,
    "logo_url": None,
    "custom_css_vars": {
        "--color-primary": "#06b6d4",
        "--color-accent": "#3b82f6",
        "--bg-canvas": "#020617"
    }
}

@router.get("/config/theme", response_model=ThemeConfigurationOut)
def get_active_system_theme(db: Session = Depends(get_db)):
    theme = db.query(ThemeConfiguration).filter(ThemeConfiguration.is_active == True).first()
    if theme:
        return theme

    # Safe Hard Fallback
    return ThemeConfigurationOut(
        id="default-fallback",
        name=DEFAULT_SYSTEM_THEME["name"],
        primary_color=DEFAULT_SYSTEM_THEME["primary_color"],
        accent_color=DEFAULT_SYSTEM_THEME["accent_color"],
        background_mode=DEFAULT_SYSTEM_THEME["background_mode"],
        font_family=DEFAULT_SYSTEM_THEME["font_family"],
        border_radius=DEFAULT_SYSTEM_THEME["border_radius"],
        is_active=True,
        logo_url=DEFAULT_SYSTEM_THEME["logo_url"],
        custom_css_vars=DEFAULT_SYSTEM_THEME["custom_css_vars"],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        versions=[]
    )

@router.get("/admin/config/theme", response_model=List[ThemeConfigurationOut])
def list_theme_configurations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    themes = db.query(ThemeConfiguration).order_by(ThemeConfiguration.updated_at.desc()).all()
    return themes

@router.post("/admin/config/theme", response_model=ThemeConfigurationOut)
def create_theme_configuration(
    theme_in: ThemeConfigurationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if theme_in.is_active:
        # Deactivate any other active theme
        db.query(ThemeConfiguration).filter(ThemeConfiguration.is_active == True).update({"is_active": False})

    theme = ThemeConfiguration(
        name=theme_in.name,
        primary_color=theme_in.primary_color,
        accent_color=theme_in.accent_color,
        background_mode=theme_in.background_mode,
        font_family=theme_in.font_family,
        border_radius=theme_in.border_radius,
        is_active=theme_in.is_active,
        logo_url=theme_in.logo_url,
        custom_css_vars=theme_in.custom_css_vars or {}
    )
    db.add(theme)
    db.commit()
    db.refresh(theme)

    # Version snapshot
    version = ThemeVersion(
        theme_id=theme.id,
        version_number=1,
        config_json={
            "name": theme.name,
            "primary_color": theme.primary_color,
            "accent_color": theme.accent_color,
            "background_mode": theme.background_mode,
            "font_family": theme.font_family,
            "border_radius": theme.border_radius,
            "custom_css_vars": theme.custom_css_vars
        },
        change_notes="Initial theme setup",
        created_by=current_user.id
    )
    db.add(version)
    db.commit()
    db.refresh(theme)

    log_audit_event(
        db=db,
        action="CREATE_THEME_CONFIGURATION",
        resource_type="theme_configuration",
        resource_id=theme.id,
        user=current_user,
        details={"name": theme.name, "is_active": theme.is_active},
        request=request
    )

    return theme

@router.put("/admin/config/theme/{theme_id}", response_model=ThemeConfigurationOut)
def update_theme_configuration(
    theme_id: str,
    theme_in: ThemeConfigurationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    theme = db.query(ThemeConfiguration).filter(ThemeConfiguration.id == theme_id).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme configuration not found")

    if theme_in.name is not None:
        theme.name = theme_in.name
    if theme_in.primary_color is not None:
        theme.primary_color = theme_in.primary_color
    if theme_in.accent_color is not None:
        theme.accent_color = theme_in.accent_color
    if theme_in.background_mode is not None:
        theme.background_mode = theme_in.background_mode
    if theme_in.font_family is not None:
        theme.font_family = theme_in.font_family
    if theme_in.border_radius is not None:
        theme.border_radius = theme_in.border_radius
    if theme_in.logo_url is not None:
        theme.logo_url = theme_in.logo_url
    if theme_in.custom_css_vars is not None:
        theme.custom_css_vars = theme_in.custom_css_vars

    if theme_in.is_active is not None and theme_in.is_active:
        db.query(ThemeConfiguration).filter(ThemeConfiguration.id != theme_id).update({"is_active": False})
        theme.is_active = True

    theme.updated_at = datetime.utcnow()

    # Determine version number
    latest_version = (
        db.query(ThemeVersion)
        .filter(ThemeVersion.theme_id == theme_id)
        .order_by(ThemeVersion.version_number.desc())
        .first()
    )
    next_ver = (latest_version.version_number + 1) if latest_version else 1

    version = ThemeVersion(
        theme_id=theme.id,
        version_number=next_ver,
        config_json={
            "name": theme.name,
            "primary_color": theme.primary_color,
            "accent_color": theme.accent_color,
            "background_mode": theme.background_mode,
            "font_family": theme.font_family,
            "border_radius": theme.border_radius,
            "custom_css_vars": theme.custom_css_vars
        },
        change_notes=theme_in.change_notes or f"Updated to version {next_ver}",
        created_by=current_user.id
    )
    db.add(version)
    db.commit()
    db.refresh(theme)

    log_audit_event(
        db=db,
        action="UPDATE_THEME_CONFIGURATION",
        resource_type="theme_configuration",
        resource_id=theme.id,
        user=current_user,
        details={"name": theme.name, "version": next_ver},
        request=request
    )

    return theme

@router.post("/admin/config/theme/apply/{theme_id}", response_model=ThemeConfigurationOut)
def apply_theme_configuration(
    theme_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    theme = db.query(ThemeConfiguration).filter(ThemeConfiguration.id == theme_id).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme configuration not found")

    db.query(ThemeConfiguration).update({"is_active": False})
    theme.is_active = True
    theme.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(theme)

    log_audit_event(
        db=db,
        action="APPLY_SYSTEM_THEME",
        resource_type="theme_configuration",
        resource_id=theme.id,
        user=current_user,
        details={"name": theme.name, "primary_color": theme.primary_color},
        request=request
    )

    return theme

@router.post("/admin/config/theme/rollback/{theme_id}/{version_number}", response_model=ThemeConfigurationOut)
def rollback_theme_configuration(
    theme_id: str,
    version_number: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    theme = db.query(ThemeConfiguration).filter(ThemeConfiguration.id == theme_id).first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme configuration not found")

    target_ver = (
        db.query(ThemeVersion)
        .filter(ThemeVersion.theme_id == theme_id, ThemeVersion.version_number == version_number)
        .first()
    )
    if not target_ver:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found for this theme")

    cfg = target_ver.config_json
    theme.name = cfg.get("name", theme.name)
    theme.primary_color = cfg.get("primary_color", theme.primary_color)
    theme.accent_color = cfg.get("accent_color", theme.accent_color)
    theme.background_mode = cfg.get("background_mode", theme.background_mode)
    theme.font_family = cfg.get("font_family", theme.font_family)
    theme.border_radius = cfg.get("border_radius", theme.border_radius)
    theme.custom_css_vars = cfg.get("custom_css_vars", theme.custom_css_vars)
    theme.updated_at = datetime.utcnow()

    latest_version = (
        db.query(ThemeVersion)
        .filter(ThemeVersion.theme_id == theme_id)
        .order_by(ThemeVersion.version_number.desc())
        .first()
    )
    next_ver = (latest_version.version_number + 1) if latest_version else 1

    new_version_record = ThemeVersion(
        theme_id=theme.id,
        version_number=next_ver,
        config_json=cfg,
        change_notes=f"Rolled back to Version {version_number}",
        created_by=current_user.id
    )
    db.add(new_version_record)
    db.commit()
    db.refresh(theme)

    log_audit_event(
        db=db,
        action="ROLLBACK_THEME_CONFIGURATION",
        resource_type="theme_configuration",
        resource_id=theme.id,
        user=current_user,
        details={"name": theme.name, "target_version": version_number, "new_version": next_ver},
        request=request
    )

    return theme

# User Theme Preference Override
@router.get("/users/me/theme", response_model=UserThemePreferenceOut)
def get_user_theme_preference(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(UserThemePreference).filter(UserThemePreference.user_id == current_user.id).first()
    active_theme = db.query(ThemeConfiguration).filter(ThemeConfiguration.is_active == True).first()

    active_out = ThemeConfigurationOut.from_orm(active_theme) if active_theme else None

    if pref:
        return UserThemePreferenceOut(
            user_id=current_user.id,
            theme_id=pref.theme_id,
            mode_override=pref.mode_override,
            custom_overrides_json=pref.custom_overrides_json or {},
            active_theme=active_out
        )

    return UserThemePreferenceOut(
        user_id=current_user.id,
        theme_id=active_theme.id if active_theme else None,
        mode_override="dark",
        custom_overrides_json={},
        active_theme=active_out
    )

@router.put("/users/me/theme", response_model=UserThemePreferenceOut)
def set_user_theme_preference(
    pref_in: UserThemePreferenceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(UserThemePreference).filter(UserThemePreference.user_id == current_user.id).first()
    if not pref:
        pref = UserThemePreference(user_id=current_user.id)
        db.add(pref)

    if pref_in.theme_id is not None:
        pref.theme_id = pref_in.theme_id
    if pref_in.mode_override is not None:
        pref.mode_override = pref_in.mode_override
    if pref_in.custom_overrides is not None:
        pref.custom_overrides_json = pref_in.custom_overrides

    pref.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pref)

    active_theme = db.query(ThemeConfiguration).filter(ThemeConfiguration.is_active == True).first()
    active_out = ThemeConfigurationOut.from_orm(active_theme) if active_theme else None

    return UserThemePreferenceOut(
        user_id=current_user.id,
        theme_id=pref.theme_id,
        mode_override=pref.mode_override,
        custom_overrides_json=pref.custom_overrides_json or {},
        active_theme=active_out
    )
