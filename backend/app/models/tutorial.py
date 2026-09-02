import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class Tutorial(Base):
    __tablename__ = "tutorials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True) # e.g. "Graph Analysis", "ACH Hypotheses", "Evidence Custody", "VoI Prioritization"
    video_url = Column(String(500), nullable=True)
    youtube_id = Column(String(50), nullable=True) # Validated YouTube ID (e.g. dQw4w9WgXcQ)
    duration_minutes = Column(Integer, default=5, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False, index=True)
    steps_json = Column(JSON, default=list, nullable=False) # List of step items { step_number, title, detail, hint }
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    progress_records = relationship("TutorialProgress", back_populates="tutorial", cascade="all, delete-orphan")

class TutorialProgress(Base):
    __tablename__ = "tutorial_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tutorial_id = Column(String(36), ForeignKey("tutorials.id", ondelete="CASCADE"), nullable=False, index=True)
    completed = Column(Boolean, default=False, nullable=False)
    last_step_index = Column(Integer, default=0, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tutorial = relationship("Tutorial", back_populates="progress_records")
    user = relationship("User", foreign_keys=[user_id])
