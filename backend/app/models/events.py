import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON, Text
from app.core.database import Base

class DomainOutboxEvent(Base):
    __tablename__ = "domain_outbox_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String(100), nullable=False, index=True) # e.g. 'evidence.uploaded.v1', 'evidence.integrity_mismatch_detected.v1'
    aggregate_id = Column(String(36), nullable=False, index=True)
    aggregate_type = Column(String(50), nullable=False, index=True) # 'evidence', 'case', 'officer', 'hypothesis'
    payload_json = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), default="pending", nullable=False, index=True) # 'pending', 'processing', 'published', 'failed'
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    published_at = Column(DateTime, nullable=True)

class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), nullable=False, index=True)
    consumer_name = Column(String(100), nullable=False, index=True)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class DeadLetterEvent(Base):
    __tablename__ = "dead_letter_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String(36), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    payload_json = Column(JSON, nullable=False)
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
