import pytest
from app.models.feature_flag import FeatureFlag

def test_feature_flags_discovery_and_admin_toggle(client, db_session, admin_token):
    # 1. Public discovery endpoint initializes flags if empty and returns boolean dictionary
    resp = client.get("/api/v1/config/flags")
    assert resp.status_code == 200
    flags_map = resp.json()
    assert "admin_officer_edit_enabled" in flags_map
    assert "admin_content_management_enabled" in flags_map
    assert "theme_branding_management_enabled" in flags_map

    # 2. Admin list endpoint returns detailed objects
    admin_resp = client.get(
        "/api/v1/admin/config/flags",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_resp.status_code == 200
    flag_items = admin_resp.json()
    assert len(flag_items) >= 5

    # 3. Admin toggles a flag
    toggle_resp = client.patch(
        "/api/v1/admin/config/flags/admin_content_management_enabled",
        json={"is_enabled": False, "description": "Temporarily disabled for maintenance"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert toggle_resp.status_code == 200
    toggle_data = toggle_resp.json()
    assert toggle_data["is_enabled"] is False

    # 4. Public endpoint reflects the updated toggle
    pub_after = client.get("/api/v1/config/flags")
    assert pub_after.status_code == 200
    assert pub_after.json()["admin_content_management_enabled"] is False

    # Turn back on
    client.patch(
        "/api/v1/admin/config/flags/admin_content_management_enabled",
        json={"is_enabled": True},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
