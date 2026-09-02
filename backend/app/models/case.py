import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class CaseStatus(str, enum.Enum):
    OPEN = "open"
    UNDER_INVESTIGATION = "under_investigation"
    CLOSED = "closed"
    ARCHIVED = "archived"

class CasePriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Case(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(CaseStatus), default=CaseStatus.OPEN, nullable=False)
    priority = Column(SAEnum(CasePriority), default=CasePriority.MEDIUM, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_cases")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_cases")
    evidence_items = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="case", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="case", cascade="all, delete-orphan")
    hypotheses = relationship("Hypothesis", back_populates="case", cascade="all, delete-orphan")
    actions = relationship("InvestigativeAction", back_populates="case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="case", cascade="all, delete-orphan")
    case_memberships = relationship("CaseMembership", back_populates="case", cascade="all, delete-orphan")
    disagreement_signals = relationship("DisagreementSignal", back_populates="case", cascade="all, delete-orphan")
    minority_evidence_items = relationship("MinorityEvidenceItem", back_populates="case", cascade="all, delete-orphan")
    resilience_test_runs = relationship("ResilienceTestRun", back_populates="case", cascade="all, delete-orphan")
    resilience_monte_carlo_runs = relationship("ResilienceMonteCarloRun", back_populates="case", cascade="all, delete-orphan")
    review_priority_scores = relationship("ReviewPriorityScore", back_populates="case", cascade="all, delete-orphan")
    review_tasks = relationship("ReviewTask", back_populates="case", cascade="all, delete-orphan")
    simulation_branches = relationship("SimulationBranch", back_populates="case", cascade="all, delete-orphan")
    simulation_review_requests = relationship("SimulationReviewRequest", back_populates="case", cascade="all, delete-orphan")

