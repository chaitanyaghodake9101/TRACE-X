from typing import Optional, Dict, Any
from fastapi import Request
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.user import User

def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user: Optional[User] = None,
    case_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None
) -> AuditLog:
    ip_address = None
    if request and request.client:
        ip_address = request.client.host

    audit_entry = AuditLog(
        user_id=user.id if user else None,
        case_id=case_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        details_json=details or {},
        ip_address=ip_address
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
