import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class SimulationBranch(Base):
    """
    Sandboxed counterfactual investigation branch.
    Guarantees strict isolation from official case data.
    """
    __tablename__ = "simulation_branches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="active", nullable=False) # 'active', 'archived', 'submitted_review'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="simulation_branches")
    creator = relationship("User", foreign_keys=[created_by])
    evidence_overrides = relationship("SimulationEvidenceOverride", back_populates="branch", cascade="all, delete-orphan")
    hypothesis_deltas = relationship("SimulationHypothesisDelta", back_populates="branch", cascade="all, delete-orphan")
    review_requests = relationship("SimulationReviewRequest", back_populates="branch", cascade="all, delete-orphan")


class SimulationEvidenceOverride(Base):
    """
    Overridden evidence parameters within a sandboxed simulation branch.
    """
    __tablename__ = "simulation_evidence_overrides"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("simulation_branches.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # What-If Modifications
    is_excluded = Column(Boolean, default=False, nullable=False) # True = evidence removed from what-if scenario
    overridden_quality_score = Column(Float, nullable=True) # Overridden 0-1 quality score
    overridden_reliability = Column(Float, nullable=True)
    is_hypothetical = Column(Boolean, default=False, nullable=False) # True = newly introduced synthetic evidence
    hypothetical_title = Column(String(255), nullable=True)
    hypothetical_source_type = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    branch = relationship("SimulationBranch", back_populates="evidence_overrides")
    evidence = relationship("Evidence")


class SimulationHypothesisDelta(Base):
    """
    Calculated Heuer ACH hypothesis likelihood shift for a simulation branch vs official reality.
    """
    __tablename__ = "simulation_hypothesis_deltas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("simulation_branches.id", ondelete="CASCADE"), nullable=False, index=True)
    hypothesis_id = Column(String(36), ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False, index=True)
    
    original_normalized_score = Column(Float, nullable=False, default=0.5)
    simulated_normalized_score = Column(Float, nullable=False, default=0.5)
    delta_score = Column(Float, nullable=False, default=0.0) # simulated - original
    original_confidence_level = Column(String(50), nullable=False, default="medium")
    simulated_confidence_level = Column(String(50), nullable=False, default="medium")
    diagnostic_rationale = Column(Text, nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    branch = relationship("SimulationBranch", back_populates="hypothesis_deltas")
    hypothesis = relationship("Hypothesis")


class SimulationReviewRequest(Base):
    """
    Formal request submitted by an investigator to propose applying simulation insights to the official case.
    Requires Senior Investigator approval.
    """
    __tablename__ = "simulation_review_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch_id = Column(String(36), ForeignKey("simulation_branches.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="pending", nullable=False, index=True) # 'pending', 'approved', 'rejected'
    review_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    branch = relationship("SimulationBranch", back_populates="review_requests")
    case = relationship("Case", back_populates="simulation_review_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
