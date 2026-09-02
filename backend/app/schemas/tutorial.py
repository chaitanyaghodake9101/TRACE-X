import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator

class TutorialStepItem(BaseModel):
    step_number: int
    title: str
    detail: str
    hint: Optional[str] = None

class TutorialCreate(BaseModel):
    title: str
    description: str
    category: str
    video_url: Optional[str] = None
    duration_minutes: int = 5
    order_index: int = 0
    is_published: bool = True
    steps: List[TutorialStepItem] = []

    @field_validator("video_url")
    def validate_youtube_url(cls, v):
        if not v:
            return v
        # Allow standard youtube.com, youtu.be, or raw youtube id
        youtube_regex = r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"
        match = re.search(youtube_regex, v)
        if not match and len(v) != 11:
            raise ValueError("Video URL must be a valid YouTube URL or 11-character video ID")
        return v

class TutorialUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    video_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    order_index: Optional[int] = None
    is_published: Optional[bool] = None
    steps: Optional[List[TutorialStepItem]] = None

class TutorialProgressUpdate(BaseModel):
    completed: Optional[bool] = None
    last_step_index: Optional[int] = None

class TutorialProgressOut(BaseModel):
    id: str
    tutorial_id: str
    user_id: str
    completed: bool
    last_step_index: int
    completed_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True

class TutorialOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    video_url: Optional[str] = None
    youtube_id: Optional[str] = None
    duration_minutes: int
    order_index: int
    is_published: bool
    steps_json: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    user_progress: Optional[TutorialProgressOut] = None

    class Config:
        from_attributes = True
