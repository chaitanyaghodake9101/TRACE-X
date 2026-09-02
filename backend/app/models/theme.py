import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class ThemeConfiguration(Base):
    __tablename__ = "theme_configurations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False) # e.g. "Default Cyber Cyan", "High-Contrast Emerald", "Tactical Midnight"
    primary_color = Column(String(20), default="#06b6d4", nullable=False) # Hex color
    accent_color = Column(String(20), default="#3b82f6", nullable=False) # Hex color
    background_mode = Column(String(20), default="slate", nullable=False) # "slate", "midnight", "oled", "navy"
    font_family = Column(String(50), default="Inter", nullable=False)
    border_radius = Column(String(20), default="0.75rem", nullable=False)
    is_active = Column(Boolean, default=False, nullable=False, index=True)
    logo_url = Column(String(500), nullable=True)
    custom_css_vars = Column(JSON, default=dict, nullable=False) # Key-value map of valid CSS variable tokens
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    versions = relationship("ThemeVersion", back_populates="theme", cascade="all, delete-orphan", order_by="desc(ThemeVersion.version_number)")

class ThemeVersion(Base):
    __tablename__ = "theme_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    theme_id = Column(String(36), ForeignKey("theme_configurations.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    config_json = Column(JSON, nullable=False)
    change_notes = Column(String(255), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    theme = relationship("ThemeConfiguration", back_populates="versions")
    creator = relationship("User", foreign_keys=[created_by])

class UserThemePreference(Base):
    __tablename__ = "user_theme_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    theme_id = Column(String(36), ForeignKey("theme_configurations.id", ondelete="SET NULL"), nullable=True)
    mode_override = Column(String(20), nullable=True) # "dark", "oled", "system"
    custom_overrides_json = Column(JSON, default=dict, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    theme = relationship("ThemeConfiguration", foreign_keys=[theme_id])
