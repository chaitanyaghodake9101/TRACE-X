from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from app.models.evidence import EvidenceSourceType, IntegrityStatus
from app.schemas.user import UserOut

class CustodyEventOut(BaseModel):
    id: str
    evidence_id: str
    event_type: str
    performed_by: str
    hash_at_event: str
    notes: Optional[str] = None
    timestamp: datetime
    performer: Optional[UserOut] = None

    class Config:
        from_attributes = True

class EvidenceQualityScoreOut(BaseModel):
    id: str
    evidence_id: str
    source_reliability_score: float
    temporal_freshness_score: float
    cross_corroboration_score: float
    data_quality_score: float
    integrity_score: float = 1.0
    overall_quality_score: float
    explanation_json: Dict[str, Any] = {}
    calculated_at: datetime

    class Config:
        from_attributes = True

class EvidenceBase(BaseModel):
    title: str
    description: Optional[str] = None
    source_type: EvidenceSourceType
    metadata_json: Optional[Dict[str, Any]] = {}
    event_timestamp: Optional[datetime] = None

class EvidenceCreate(EvidenceBase):
    extracted_text: Optional[str] = None

class EvidenceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    source_type: Optional[EvidenceSourceType] = None
    extracted_text: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    event_timestamp: Optional[datetime] = None

class EvidenceOut(EvidenceBase):
    id: str
    case_id: str
    file_path: Optional[str] = None
    extracted_text: Optional[str] = None
    uploaded_by: str
    sha256_hash: str
    integrity_status: IntegrityStatus
    created_at: datetime
    updated_at: datetime
    quality_score: Optional[EvidenceQualityScoreOut] = None
    custody_events: Optional[List[CustodyEventOut]] = []

    class Config:
        from_attributes = True

class EvidenceIntegrityOut(BaseModel):
    id: str
    case_id: str
    title: str
    sha256_hash: str
    current_recomputed_hash: str
    integrity_status: IntegrityStatus
    is_valid: bool
    last_verified_at: Optional[datetime] = None
    custody_chain: List[CustodyEventOut] = []

class IntegrityReportOut(BaseModel):
    id: str
    case_id: str
    generated_by: str
    total_evidence_items: int
    verified_count: int
    compromised_count: int
    created_at: datetime

    class Config:
        from_attributes = True
