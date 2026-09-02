import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class CDRRecord(Base):
    """
    Structured Call Detail Record parsed from telecommunications CSV uploads.
    """
    __tablename__ = "cdr_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    caller_number = Column(String(20), nullable=False, index=True)
    receiver_number = Column(String(20), nullable=False, index=True)
    call_timestamp = Column(DateTime, nullable=True, index=True)
    duration_seconds = Column(Integer, default=0, nullable=False)
    tower_location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    evidence = relationship("Evidence")

class FinancialTransaction(Base):
    """
    Structured financial remittance transaction parsed from banking CSV uploads.
    """
    __tablename__ = "financial_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(255), nullable=False, index=True)
    receiver = Column(String(255), nullable=False, index=True)
    amount = Column(Float, nullable=False, default=0.0)
    txn_timestamp = Column(DateTime, nullable=True, index=True)
    bank_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    evidence = relationship("Evidence")

class SystemHealthLog(Base):
    """
    Periodic or on-demand snapshot of core infrastructure health metrics.
    """
    __tablename__ = "system_health_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    component = Column(String(50), nullable=False) # 'postgres', 'neo4j', 'storage', 'api'
    status = Column(String(20), nullable=False) # 'healthy', 'degraded', 'down'
    metric_snapshot = Column(JSON, default=dict, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

class RetentionPolicy(Base):
    """
    Data retention policy configuration per resource type.
    """
    __tablename__ = "retention_policies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    resource_type = Column(String(50), unique=True, nullable=False) # 'evidence', 'audit_logs', 'cases'
    retention_years = Column(Integer, default=7, nullable=False)
    configured_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    configurer = relationship("User", foreign_keys=[configured_by])
