import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator

def validate_color_hex_or_hsl(color: str) -> str:
    hex_pattern = r"^#(?:[0-9a-fA-F]{3}){1,2}$"
    hsl_pattern = r"^hsl\(\s*\d+\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?\s*\)$"
    if not (re.match(hex_pattern, color) or re.match(hsl_pattern, color)):
        raise ValueError(f"Invalid color token format: '{color}'. Must be valid HEX (#06b6d4) or HSL.")
    return color

class ThemeConfigurationCreate(BaseModel):
    name: str
    primary_color: str = "#06b6d4"
    accent_color: str = "#3b82f6"
    background_mode: str = "slate" # "slate", "midnight", "oled", "navy"
    font_family: str = "Inter"
    border_radius: str = "0.75rem"
    is_active: bool = False
    logo_url: Optional[str] = None
    custom_css_vars: Dict[str, str] = {}

    @field_validator("primary_color", "accent_color")
    def validate_colors(cls, v):
        return validate_color_hex_or_hsl(v)

class ThemeConfigurationUpdate(BaseModel):
    name: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    background_mode: Optional[str] = None
    font_family: Optional[str] = None
    border_radius: Optional[str] = None
    is_active: Optional[bool] = None
    logo_url: Optional[str] = None
    custom_css_vars: Optional[Dict[str, str]] = None
    change_notes: Optional[str] = None

    @field_validator("primary_color", "accent_color")
    def validate_colors(cls, v):
        if v is not None:
            return validate_color_hex_or_hsl(v)
        return v

class ThemeVersionOut(BaseModel):
    id: str
    theme_id: str
    version_number: int
    config_json: Dict[str, Any]
    change_notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ThemeConfigurationOut(BaseModel):
    id: str
    name: str
    primary_color: str
    accent_color: str
    background_mode: str
    font_family: str
    border_radius: str
    is_active: bool
    logo_url: Optional[str] = None
    custom_css_vars: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    versions: Optional[List[ThemeVersionOut]] = None

    class Config:
        from_attributes = True

class UserThemePreferenceIn(BaseModel):
    theme_id: Optional[str] = None
    mode_override: Optional[str] = None # "dark", "oled", "system"
    custom_overrides: Optional[Dict[str, Any]] = None

class UserThemePreferenceOut(BaseModel):
    user_id: str
    theme_id: Optional[str] = None
    mode_override: Optional[str] = None
    custom_overrides_json: Dict[str, Any]
    active_theme: Optional[ThemeConfigurationOut] = None

    class Config:
        from_attributes = True
