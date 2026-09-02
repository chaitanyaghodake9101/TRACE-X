from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.action import ActionType, ActionStatus
from app.schemas.entity import EntityOut
from app.schemas.user import UserOut

class ActionOutcomeCreate(BaseModel):
    outcome_notes: Optional[str] = None
    produced_new_evidence: bool = False
    evidence_id: Optional[str] = None
    effectiveness_score: float = 1.0

class ActionOutcomeOut(ActionOutcomeCreate):
    id: str
    action_id: str
    logged_by: str
    created_at: datetime

    class Config:
        from_attributes = True

class ActionBase(BaseModel):
    title: str
    description: Optional[str] = None
    action_type: ActionType
    target_entity_id: Optional[str] = None
    assigned_to: Optional[str] = None

class ActionCreate(ActionBase):
    pass

class ActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    action_type: Optional[ActionType] = None
    status: Optional[ActionStatus] = None
    target_entity_id: Optional[str] = None
    assigned_to: Optional[str] = None

class ActionOut(ActionBase):
    id: str
    case_id: str
    status: ActionStatus
    base_gain: float
    gap_multiplier: float
    hypothesis_multiplier: float
    feasibility_multiplier: float
    expected_information_gain: float
    priority_rank: int
    created_at: datetime
    updated_at: datetime
    target_entity: Optional[EntityOut] = None
    assignee: Optional[UserOut] = None
    outcome: Optional[ActionOutcomeOut] = None

    class Config:
        from_attributes = True
