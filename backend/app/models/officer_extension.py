import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class OfficerProfile(Base):
    __tablename__ = "officer_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    designation = Column(String(100), nullable=True) # e.g. "Assistant Commissioner of Police"
    district = Column(String(100), nullable=True) # e.g. "Central District"
    state = Column(String(100), nullable=True) # e.g. "Delhi (NCT)"
    rank = Column(String(50), nullable=True) # e.g. "ACP", "Inspector", "SI"
    department = Column(String(100), nullable=True) # e.g. "Special Cell", "Crime Branch"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", backref="officer_profile")

class OfficerStatusHistory(Base):
    __tablename__ = "officer_status_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(Boolean, nullable=False)
    new_status = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=True)
    changed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    changer = relationship("User", foreign_keys=[changed_by])

class OfficerRoleHistory(Base):
    __tablename__ = "officer_role_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_role = Column(String(50), nullable=False)
    new_role = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    changed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    changer = relationship("User", foreign_keys=[changed_by])

class CaseMembership(Base):
    __tablename__ = "case_memberships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_role = Column(String(50), default="investigator", nullable=False) # "lead", "assisting", "supervisor"
    is_active = Column(Boolean, default=True, nullable=False)
    assigned_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    case = relationship("Case", back_populates="case_memberships")
    user = relationship("User", foreign_keys=[user_id], backref="case_memberships")
    assigner = relationship("User", foreign_keys=[assigned_by])
