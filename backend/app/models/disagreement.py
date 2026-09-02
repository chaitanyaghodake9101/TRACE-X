import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class DisagreementSignal(Base):
    """
    Cross-signal discrepancy detected between AI extraction, graph analytics,
    evidence quality, integrity verification, or investigator actions.
    """
    __tablename__ = "disagreement_signals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    dimension = Column(String(50), nullable=False, index=True) 
    # 'nlp_vs_graph', 'evidence_vs_hypothesis', 'majority_vs_minority', 'integrity_vs_reliance', 'ai_vs_human'
    
    severity = Column(String(20), default="medium", nullable=False, index=True) # 'critical', 'high', 'medium', 'low'
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    primary_entity_id = Column(String(36), nullable=True, index=True)
    primary_evidence_id = Column(String(36), nullable=True, index=True)
    primary_hypothesis_id = Column(String(36), nullable=True, index=True)
    
    signals_payload = Column(JSON, default=dict, nullable=False)
    recommended_reconciliation = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False, index=True)
    resolved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="disagreement_signals")
    resolver = relationship("User", foreign_keys=[resolved_by])
    contestations = relationship("InvestigatorContestation", back_populates="signal", cascade="all, delete-orphan")


class MinorityEvidenceItem(Base):
    """
    Outlier, dissenting, or lone contradictory evidence that challenges prevailing consensus.
    """
    __tablename__ = "minority_evidence_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    hypothesis_id = Column(String(36), ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=True, index=True)
    
    outlier_category = Column(String(50), nullable=False) # 'lone_witness', 'whistleblower_tip', 'cross_border_record'
    diagnostic_significance = Column(Float, default=1.0, nullable=False) # High weight because negative evidence is highly informative
    contradiction_target = Column(String(255), nullable=False)
    summary_rationale = Column(Text, nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="minority_evidence_items")
    evidence = relationship("Evidence")
    hypothesis = relationship("Hypothesis")


class InvestigatorContestation(Base):
    """
    Investigator contestation & audit rationale challenging an AI signal or score.
    """
    __tablename__ = "investigator_contestations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    signal_id = Column(String(36), ForeignKey("disagreement_signals.id", ondelete="CASCADE"), nullable=False, index=True)
    officer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    contest_action = Column(String(50), nullable=False) # 'override_confidence', 'dismiss_signal', 'affirm_anomaly'
    justification = Column(Text, nullable=False)
    adjusted_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    signal = relationship("DisagreementSignal", back_populates="contestations")
    officer = relationship("User", foreign_keys=[officer_id])
