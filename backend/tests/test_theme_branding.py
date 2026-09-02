import pytest
from app.models.theme import ThemeConfiguration, ThemeVersion, UserThemePreference

def test_theme_fallback_and_crud_management(client, db_session, admin_token, auth_token):
    # 1. Fallback when no active theme in DB
    fallback_resp = client.get("/api/v1/config/theme")
    assert fallback_resp.status_code == 200
    fb_data = fallback_resp.json()
    assert fb_data["primary_color"] == "#06b6d4"
    assert fb_data["is_active"] is True

    # 2. Admin creates a custom high-contrast emerald theme
    theme_payload = {
        "name": "High-Contrast Tactical Emerald",
        "primary_color": "#10b981",
        "accent_color": "#06b6d4",
        "background_mode": "oled",
        "font_family": "Inter",
        "border_radius": "0.5rem",
        "is_active": True,
        "custom_css_vars": {
            "--color-primary": "#10b981",
            "--color-accent": "#06b6d4",
            "--bg-canvas": "#000000"
        }
    }
    create_resp = client.post(
        "/api/v1/admin/config/theme",
        json=theme_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_resp.status_code == 200
    theme_data = create_resp.json()
    theme_id = theme_data["id"]
    assert theme_data["primary_color"] == "#10b981"
    assert theme_data["is_active"] is True

    # 3. Active system theme now returns the created theme
    active_resp = client.get("/api/v1/config/theme")
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == theme_id

    # 4. User sets their personal theme preference
    pref_resp = client.put(
        "/api/v1/users/me/theme",
        json={"theme_id": theme_id, "mode_override": "oled"},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert pref_resp.status_code == 200
    pref_data = pref_resp.json()
    assert pref_data["theme_id"] == theme_id
    assert pref_data["mode_override"] == "oled"
