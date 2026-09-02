from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key = Column(String(100), primary_key=True) # e.g. "admin_officer_edit_enabled"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, default=False, nullable=False, index=True)
    category = Column(String(50), default="admin", nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    updater = relationship("User", foreign_keys=[updated_by])
