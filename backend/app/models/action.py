import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class ActionType(str, enum.Enum):
    OBTAIN_CDR = "obtain_cdr"
    INTERVIEW_WITNESS = "interview_witness"
    OBTAIN_FINANCIAL_RECORDS = "obtain_financial_records"
    CCTV_REVIEW = "cctv_review"
    FORENSIC_ANALYSIS = "forensic_analysis"
    RE_VERIFY_EVIDENCE = "re_verify_evidence"
    OTHER = "other"

class ActionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class InvestigativeAction(Base):
    __tablename__ = "investigative_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    action_type = Column(SAEnum(ActionType), nullable=False, index=True)
    status = Column(SAEnum(ActionStatus), default=ActionStatus.PENDING, nullable=False, index=True)
    
    # Information gain scoring components
    base_gain = Column(Float, default=0.5, nullable=False)
    gap_multiplier = Column(Float, default=1.0, nullable=False)
    hypothesis_multiplier = Column(Float, default=1.0, nullable=False)
    feasibility_multiplier = Column(Float, default=1.0, nullable=False)
    expected_information_gain = Column(Float, default=0.5, nullable=False, index=True)
    priority_rank = Column(Integer, default=0, nullable=False, index=True)
    
    target_entity_id = Column(String(36), ForeignKey("entities.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="actions")
    assignee = relationship("User", foreign_keys=[assigned_to])
    target_entity = relationship("Entity", foreign_keys=[target_entity_id])
    outcome = relationship("ActionOutcome", back_populates="action", uselist=False, cascade="all, delete-orphan")

class ActionOutcome(Base):
    __tablename__ = "action_outcomes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    action_id = Column(String(36), ForeignKey("investigative_actions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    outcome_notes = Column(Text, nullable=True)
    produced_new_evidence = Column(Boolean, default=False, nullable=False)
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True)
    effectiveness_score = Column(Float, default=1.0, nullable=False)  # 0.0 to 1.0
    logged_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    action = relationship("InvestigativeAction", back_populates="outcome")
    logger = relationship("User", foreign_keys=[logged_by])
    resulting_evidence = relationship("Evidence", foreign_keys=[evidence_id])
