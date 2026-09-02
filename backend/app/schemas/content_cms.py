from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.content_cms import ContentPageStatus

class ContentPageCreate(BaseModel):
    slug: str
    title: str
    summary: Optional[str] = None
    body_markdown: str
    status: ContentPageStatus = ContentPageStatus.DRAFT

class ContentPageUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    body_markdown: Optional[str] = None
    status: Optional[ContentPageStatus] = None
    change_summary: Optional[str] = None

class ContentPageVersionOut(BaseModel):
    id: str
    page_id: str
    version_number: int
    title: str
    summary: Optional[str] = None
    body_markdown: str
    status: ContentPageStatus
    created_by: Optional[str] = None
    created_at: datetime
    change_summary: Optional[str] = None

    class Config:
        from_attributes = True

class ContentPageOut(BaseModel):
    id: str
    slug: str
    title: str
    summary: Optional[str] = None
    body_markdown: str
    status: ContentPageStatus
    current_version: int
    author_id: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    versions: Optional[List[ContentPageVersionOut]] = None

    class Config:
        from_attributes = True

class PublicContentPageOut(BaseModel):
    slug: str
    title: str
    summary: Optional[str] = None
    body_markdown: str
    version: int
    published_at: Optional[datetime] = None
    is_fallback: bool = False
