from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole

class OfficerProfileIn(BaseModel):
    designation: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None

class OfficerProfileOut(BaseModel):
    id: str
    user_id: str
    designation: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EnhancedOfficerCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = "OfficerPass123!"
    full_name: str
    role: UserRole = UserRole.INVESTIGATOR
    phone_number: Optional[str] = None
    badge_number: Optional[str] = None
    station: Optional[str] = None
    designation: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None

class EnhancedOfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    phone_number: Optional[str] = None
    badge_number: Optional[str] = None
    station: Optional[str] = None
    designation: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None
    reason: Optional[str] = None

class EnhancedOfficerOut(BaseModel):
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
    profile: Optional[OfficerProfileOut] = None

    class Config:
        from_attributes = True

class CaseMembershipCreate(BaseModel):
    case_id: str
    user_id: str
    assignment_role: str = "investigator" # "lead", "assisting", "supervisor"

class CaseMembershipOut(BaseModel):
    id: str
    case_id: str
    user_id: str
    case_title: Optional[str] = None
    case_number: Optional[str] = None
    assignment_role: str
    is_active: bool
    assigned_by: Optional[str] = None
    assigned_at: datetime

    class Config:
        from_attributes = True

class OfficerHistoryOut(BaseModel):
    status_history: List[Dict[str, Any]]
    role_history: List[Dict[str, Any]]
    case_memberships: List[CaseMembershipOut]
