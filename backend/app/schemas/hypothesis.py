from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.models.hypothesis import HypothesisStatus, HypothesisRelationType, HypothesisConfidenceLevel
from app.schemas.evidence import EvidenceOut
from app.schemas.user import UserOut

class HypothesisScoreOut(BaseModel):
    id: str
    hypothesis_id: str
    raw_score: float
    normalized_score: float
    confidence_level: HypothesisConfidenceLevel
    supporting_count: int
    contradicting_count: int
    supporting_weight_sum: float
    contradicting_weight_sum: float
    calculated_at: datetime

    class Config:
        from_attributes = True

class EvidenceHypothesisBase(BaseModel):
    evidence_id: str
    relationship_type: HypothesisRelationType
    relationship_strength: float = 1.0
    rationale: Optional[str] = None

class EvidenceHypothesisCreate(EvidenceHypothesisBase):
    pass

class EvidenceHypothesisOut(EvidenceHypothesisBase):
    id: str
    hypothesis_id: str
    linked_by: str
    created_at: datetime
    evidence: Optional[EvidenceOut] = None

    class Config:
        from_attributes = True

class HypothesisBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: HypothesisStatus = HypothesisStatus.ACTIVE

class HypothesisCreate(HypothesisBase):
    pass

class HypothesisUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[HypothesisStatus] = None

class HypothesisOut(HypothesisBase):
    id: str
    case_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserOut] = None
    score: Optional[HypothesisScoreOut] = None
    evidence_links: List[EvidenceHypothesisOut] = []

    class Config:
        from_attributes = True

class HypothesisCompareOut(BaseModel):
    hypothesis_a: HypothesisOut
    hypothesis_b: HypothesisOut
    score_delta: float
    leading_hypothesis_id: str
