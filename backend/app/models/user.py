import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SENIOR_INVESTIGATOR = "senior_investigator"
    INVESTIGATOR = "investigator"
    AUDITOR = "auditor"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.INVESTIGATOR, nullable=False)
    
    # Extended Officer Profile (§2.2 & §4 of Production PRD)
    phone_number = Column(String(20), nullable=True)
    badge_number = Column(String(50), unique=True, nullable=True, index=True)
    station = Column(String(255), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False) # True by default for existing backward compatibility
    has_completed_tour = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    created_cases = relationship("Case", back_populates="creator", foreign_keys="Case.created_by")
    assigned_cases = relationship("Case", back_populates="assignee", foreign_keys="Case.assigned_to")
    audit_logs = relationship("AuditLog", back_populates="user")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan", foreign_keys="PasswordResetToken.user_id")
    verification_tokens = relationship("EmailVerificationToken", back_populates="user", cascade="all, delete-orphan")
    refresh_sessions = relationship("RefreshTokenSession", back_populates="user", cascade="all, delete-orphan")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), nullable=True, index=True) # Kept for backward compatibility
    token_hash = Column(String(64), nullable=True, index=True) # SHA-256 hash of token at rest
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="reset_tokens")
    creator = relationship("User", foreign_keys=[created_by])

class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True) # SHA-256 hash of token at rest
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="verification_tokens")

class RefreshTokenSession(Base):
    __tablename__ = "refresh_token_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True)
    device_info = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="refresh_sessions")

class AuthRateLimitEvent(Base):
    __tablename__ = "auth_rate_limit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key_identifier = Column(String(255), nullable=False, index=True) # IP or hashed email
    attempt_count = Column(Integer, default=1, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_attempt_at = Column(DateTime, default=datetime.utcnow, nullable=False)
