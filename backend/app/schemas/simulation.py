from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class SimulationEvidenceOverrideCreate(BaseModel):
    evidence_id: Optional[str] = None
    is_excluded: bool = False
    overridden_quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    overridden_reliability: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_hypothetical: bool = False
    hypothetical_title: Optional[str] = None
    hypothetical_source_type: Optional[str] = None
    notes: Optional[str] = None

class SimulationEvidenceOverrideResponse(BaseModel):
    id: str
    branch_id: str
    evidence_id: Optional[str] = None
    is_excluded: bool
    overridden_quality_score: Optional[float] = None
    overridden_reliability: Optional[float] = None
    is_hypothetical: bool
    hypothetical_title: Optional[str] = None
    hypothetical_source_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SimulationHypothesisDeltaResponse(BaseModel):
    id: str
    hypothesis_id: str
    hypothesis_title: Optional[str] = None
    original_normalized_score: float
    simulated_normalized_score: float
    delta_score: float
    original_confidence_level: str
    simulated_confidence_level: str
    diagnostic_rationale: Optional[str] = None
    calculated_at: datetime

    class Config:
        from_attributes = True

class SimulationBranchCreate(BaseModel):
    name: str
    description: Optional[str] = None

class SimulationBranchResponse(BaseModel):
    id: str
    case_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    status: str
    created_at: datetime
    updated_at: datetime
    evidence_overrides: List[SimulationEvidenceOverrideResponse] = []
    hypothesis_deltas: List[SimulationHypothesisDeltaResponse] = []

    class Config:
        from_attributes = True

class SimulationBranchComparison(BaseModel):
    branch_id: str
    branch_name: str
    case_id: str
    total_overrides: int
    hypothesis_deltas: List[SimulationHypothesisDeltaResponse]
    significant_shifts: List[Dict[str, Any]]
    summary: str

class SimulationReviewRequestCreate(BaseModel):
    review_notes: Optional[str] = None

class SimulationReviewRequestResponse(BaseModel):
    id: str
    branch_id: str
    case_id: str
    requested_by: str
    status: str
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
