from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole

class OfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    phone_number: Optional[str] = None
    badge_number: Optional[str] = None
    station: Optional[str] = None

class OfficerStatusUpdate(BaseModel):
    is_active: bool

class OfficerOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: UserRole
    phone_number: Optional[str] = None
    badge_number: Optional[str] = None
    station: Optional[str] = None
    is_active: bool
    has_completed_tour: bool
    created_at: datetime
    updated_at: datetime
    created_cases_count: Optional[int] = 0
    assigned_cases_count: Optional[int] = 0

    class Config:
        from_attributes = True

class PasswordResetOut(BaseModel):
    user_id: str
    email: str
    reset_token: str
    reset_url: str
    expires_at: datetime
    message: str

class OfficerActivityItem(BaseModel):
    id: str
    timestamp: datetime
    source: str # 'audit_log' | 'custody_event'
    action_type: str
    resource_type: str
    resource_id: Optional[str] = None
    case_id: Optional[str] = None
    case_title: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class BulkActionIn(BaseModel):
    officer_ids: List[str]
    action: str # 'activate' | 'deactivate' | 'reassign'
    target_case_id: Optional[str] = None

class BulkActionOut(BaseModel):
    action: str
    affected_count: int
    success: bool
    message: str

class ComponentHealth(BaseModel):
    name: str
    status: str # 'healthy' | 'degraded' | 'down'
    latency_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None

class SystemHealthOut(BaseModel):
    status: str # 'healthy' | 'degraded' | 'down'
    timestamp: datetime
    components: List[ComponentHealth]
    uptime_seconds: float
    total_users: int
    total_cases: int
    total_evidence: int

class TamperingAnalyticsOut(BaseModel):
    total_evidence_count: int
    verified_count: int
    compromised_count: int
    unverified_count: int
    tamper_rate_percentage: float
    recent_compromised_items: List[Dict[str, Any]]

class ConfigUpdateIn(BaseModel):
    retention_years: Optional[int] = 7
    alert_on_tamper: Optional[bool] = True
    max_evidence_upload_mb: Optional[int] = 50
