import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class EvidenceSourceType(str, enum.Enum):
    FIR = "fir"
    CDR = "cdr"
    FINANCIAL_RECORDS = "financial_records"
    CCTV = "cctv"
    WITNESS_STATEMENT = "witness_statement"
    ANONYMOUS_TIP = "anonymous_tip"
    OTHER = "other"

class IntegrityStatus(str, enum.Enum):
    VERIFIED = "verified"
    COMPROMISED = "compromised"
    UNVERIFIED = "unverified"

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_type = Column(SAEnum(EvidenceSourceType), nullable=False)
    file_path = Column(String(500), nullable=True)
    extracted_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, default=dict, nullable=False)
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Cryptographic Chain-of-Custody Integrity (§2.2 of SIH26189 Alignment)
    sha256_hash = Column(String(64), nullable=False, default="")
    integrity_status = Column(SAEnum(IntegrityStatus), nullable=False, default=IntegrityStatus.VERIFIED, index=True)
    
    event_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="evidence_items")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    quality_score = relationship("EvidenceQualityScore", back_populates="evidence", uselist=False, cascade="all, delete-orphan")
    hypothesis_links = relationship("EvidenceHypothesis", back_populates="evidence", cascade="all, delete-orphan")
    custody_events = relationship("CustodyEvent", back_populates="evidence", cascade="all, delete-orphan", order_by="CustodyEvent.timestamp.desc()")

class EvidenceQualityScore(Base):
    __tablename__ = "evidence_quality_scores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    source_reliability_score = Column(Float, nullable=False, default=0.5)
    temporal_freshness_score = Column(Float, nullable=False, default=0.5)
    cross_corroboration_score = Column(Float, nullable=False, default=0.3)
    data_quality_score = Column(Float, nullable=False, default=0.5)
    integrity_score = Column(Float, nullable=False, default=1.0)
    overall_quality_score = Column(Float, nullable=False, default=0.5, index=True)
    explanation_json = Column(JSON, default=dict, nullable=False)
    calculated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    evidence = relationship("Evidence", back_populates="quality_score")

class CustodyEvent(Base):
    """
    Append-only chain-of-custody log tracking cryptographic evidence provenance and state.
    """
    __tablename__ = "custody_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True) # uploaded, accessed, downloaded, verified, flagged_compromised, exported, simulated_tamper
    performed_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    hash_at_event = Column(String(64), nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    evidence = relationship("Evidence", back_populates="custody_events")
    performer = relationship("User", foreign_keys=[performed_by])

class IntegrityReport(Base):
    """
    Case-level cryptographic chain-of-custody verification report snapshot.
    """
    __tablename__ = "integrity_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    generated_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    total_evidence_items = Column(Integer, nullable=False, default=0)
    verified_count = Column(Integer, nullable=False, default=0)
    compromised_count = Column(Integer, nullable=False, default=0)
    report_pdf_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case")
    generator = relationship("User", foreign_keys=[generated_by])
