from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class FeatureFlagUpdate(BaseModel):
    is_enabled: bool
    description: Optional[str] = None

class FeatureFlagOut(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    is_enabled: bool
    category: str
    updated_at: datetime
    updated_by: Optional[str] = None

    class Config:
        from_attributes = True
