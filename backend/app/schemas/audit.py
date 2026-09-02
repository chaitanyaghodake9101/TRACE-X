from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.schemas.user import UserOut

class AuditLogCreate(BaseModel):
    user_id: Optional[str] = None
    case_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details_json: Dict[str, Any] = {}
    ip_address: Optional[str] = None

class AuditLogOut(AuditLogCreate):
    id: str
    timestamp: datetime
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True
