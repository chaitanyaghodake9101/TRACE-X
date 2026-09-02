from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class ReviewPriorityScoreResponse(BaseModel):
    id: str
    evidence_id: str
    evidence_title: Optional[str] = None
    evidence_source_type: Optional[str] = None
    case_id: str
    temporal_urgency_score: float
    integrity_urgency_score: float
    volatility_score: float
    downstream_impact_score: float
    corroboration_deficit_score: float
    composite_urgency_score: float
    suggested_review_tier: str # 'P0_CRITICAL', 'P1_HIGH', 'P2_ROUTINE'
    explanation_json: Dict[str, Any]
    calculated_at: datetime

    class Config:
        from_attributes = True

class ReviewTaskCreate(BaseModel):
    evidence_id: str
    title: str
    description: Optional[str] = None
    priority: str = "P1" # 'P0', 'P1', 'P2'
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None

class ReviewActionLogCreate(BaseModel):
    action_taken: str # 'hash_reverified', 'witness_reinterviewed', 'metadata_updated', 'cleared', 'deferred'
    notes: Optional[str] = None
    new_status: Optional[str] = None # 'reverified', 'deferred', 'closed'

class ReviewActionLogResponse(BaseModel):
    id: str
    task_id: str
    action_taken: str
    notes: Optional[str] = None
    performed_by: str
    performer_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReviewTaskResponse(BaseModel):
    id: str
    case_id: str
    evidence_id: str
    evidence_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    assigned_to: Optional[str] = None
    assignee_name: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    action_logs: List[ReviewActionLogResponse] = []

    class Config:
        from_attributes = True
