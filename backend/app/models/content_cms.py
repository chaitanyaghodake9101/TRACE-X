import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class ContentPageStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class ContentPage(Base):
    __tablename__ = "content_pages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(100), unique=True, nullable=False, index=True) # e.g. "about-us", "privacy-policy", "operational-guidelines"
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    body_markdown = Column(Text, nullable=False)
    status = Column(SAEnum(ContentPageStatus), default=ContentPageStatus.DRAFT, nullable=False, index=True)
    current_version = Column(Integer, default=1, nullable=False)
    author_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    author = relationship("User", foreign_keys=[author_id])
    versions = relationship("ContentPageVersion", back_populates="page", cascade="all, delete-orphan", order_by="desc(ContentPageVersion.version_number)")

class ContentPageVersion(Base):
    __tablename__ = "content_page_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    page_id = Column(String(36), ForeignKey("content_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    body_markdown = Column(Text, nullable=False)
    status = Column(SAEnum(ContentPageStatus), default=ContentPageStatus.DRAFT, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    change_summary = Column(String(255), nullable=True)

    page = relationship("ContentPage", back_populates="versions")
    creator = relationship("User", foreign_keys=[created_by])
