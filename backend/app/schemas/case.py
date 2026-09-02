from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.case import CaseStatus, CasePriority
from app.schemas.user import UserOut

class CaseBase(BaseModel):
    title: str
    case_number: str
    description: Optional[str] = None
    status: CaseStatus = CaseStatus.OPEN
    priority: CasePriority = CasePriority.MEDIUM

class CaseCreate(CaseBase):
    assigned_to: Optional[str] = None

class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    priority: Optional[CasePriority] = None
    assigned_to: Optional[str] = None

class CaseStatusUpdate(BaseModel):
    status: CaseStatus

class CaseAssignUpdate(BaseModel):
    assigned_to: str

class CaseOut(CaseBase):
    id: str
    created_by: str
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserOut] = None
    assignee: Optional[UserOut] = None
    evidence_count: Optional[int] = 0
    entity_count: Optional[int] = 0
    hypothesis_count: Optional[int] = 0
    action_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
