import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class HypothesisStatus(str, enum.Enum):
    ACTIVE = "active"
    SUPPORTED = "supported"
    REFUTED = "refuted"
    ARCHIVED = "archived"

class HypothesisRelationType(str, enum.Enum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"

class HypothesisConfidenceLevel(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(HypothesisStatus), default=HypothesisStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="hypotheses")
    creator = relationship("User", foreign_keys=[created_by])
    evidence_links = relationship("EvidenceHypothesis", back_populates="hypothesis", cascade="all, delete-orphan")
    score = relationship("HypothesisScore", back_populates="hypothesis", uselist=False, cascade="all, delete-orphan")

class EvidenceHypothesis(Base):
    __tablename__ = "evidence_hypothesis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hypothesis_id = Column(String(36), ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = Column(SAEnum(HypothesisRelationType), nullable=False)
    relationship_strength = Column(Float, default=1.0, nullable=False)  # 0.0 to 1.0
    rationale = Column(Text, nullable=True)
    linked_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    hypothesis = relationship("Hypothesis", back_populates="evidence_links")
    evidence = relationship("Evidence", back_populates="hypothesis_links")
    linker = relationship("User", foreign_keys=[linked_by])

class HypothesisScore(Base):
    __tablename__ = "hypothesis_scores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hypothesis_id = Column(String(36), ForeignKey("hypotheses.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    raw_score = Column(Float, default=0.0, nullable=False)
    normalized_score = Column(Float, default=0.5, nullable=False, index=True)
    confidence_level = Column(SAEnum(HypothesisConfidenceLevel), default=HypothesisConfidenceLevel.MEDIUM, nullable=False)
    supporting_count = Column(Integer, default=0, nullable=False)
    contradicting_count = Column(Integer, default=0, nullable=False)
    supporting_weight_sum = Column(Float, default=0.0, nullable=False)
    contradicting_weight_sum = Column(Float, default=0.0, nullable=False)
    calculated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    hypothesis = relationship("Hypothesis", back_populates="score")
