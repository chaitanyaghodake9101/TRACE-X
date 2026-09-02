from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class InvestigatorContestationCreate(BaseModel):
    contest_action: str # 'override_confidence', 'dismiss_signal', 'affirm_anomaly'
    justification: str
    adjusted_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)

class InvestigatorContestationResponse(BaseModel):
    id: str
    signal_id: str
    officer_id: str
    officer_name: Optional[str] = None
    contest_action: str
    justification: str
    adjusted_confidence: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DisagreementSignalResponse(BaseModel):
    id: str
    case_id: str
    dimension: str
    severity: str
    title: str
    description: str
    primary_entity_id: Optional[str] = None
    primary_evidence_id: Optional[str] = None
    primary_hypothesis_id: Optional[str] = None
    signals_payload: Dict[str, Any]
    recommended_reconciliation: Optional[str] = None
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    contestations: List[InvestigatorContestationResponse] = []

    class Config:
        from_attributes = True

class MinorityEvidenceItemResponse(BaseModel):
    id: str
    case_id: str
    evidence_id: str
    evidence_title: Optional[str] = None
    hypothesis_id: Optional[str] = None
    hypothesis_title: Optional[str] = None
    outlier_category: str
    diagnostic_significance: float
    contradiction_target: str
    summary_rationale: str
    detected_at: datetime

    class Config:
        from_attributes = True

class DisagreementScanSummary(BaseModel):
    case_id: str
    total_signals: int
    critical_signals: int
    high_signals: int
    minority_evidence_count: int
    signals: List[DisagreementSignalResponse]
    minority_evidence: List[MinorityEvidenceItemResponse]
