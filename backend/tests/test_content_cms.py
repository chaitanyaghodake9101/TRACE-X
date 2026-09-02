import pytest
from app.models.content_cms import ContentPage, ContentPageVersion, ContentPageStatus

def test_cms_public_fallback(client):
    # Public request for 'about-us' without database row must safely return built-in fallback copy
    resp = client.get("/api/v1/content/public/about-us")
    assert resp.status_code == 200
    data = resp.json()
    assert "TRACE-X" in data["title"]
    assert data["is_fallback"] is True
    assert "Evidence Quality Scoring" in data["body_markdown"]

def test_cms_crud_publish_and_version_rollback(client, db_session, admin_token):
    # 1. Create a draft page
    page_payload = {
        "slug": "guidelines-2026",
        "title": "Investigative Standard Operating Procedures",
        "summary": "Standard operating procedures for digital forensics",
        "body_markdown": "# SOP 2026\n\n1. Maintain SHA-256 evidence integrity.\n2. Cross-corroborate CDR entries.",
        "status": "draft"
    }
    resp = client.post(
        "/api/v1/admin/content/pages",
        json=page_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    page_data = resp.json()
    page_id = page_data["id"]
    assert page_data["current_version"] == 1
    assert page_data["status"] == "draft"

    # Public request before publish returns 404
    pub_check = client.get("/api/v1/content/public/guidelines-2026")
    assert pub_check.status_code == 404

    # 2. Publish the page
    pub_resp = client.post(
        f"/api/v1/admin/content/pages/{page_id}/publish",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert pub_resp.status_code == 200
    assert pub_resp.json()["status"] == "published"

    # Now public request succeeds
    pub_ok = client.get("/api/v1/content/public/guidelines-2026")
    assert pub_ok.status_code == 200
    assert pub_ok.json()["is_fallback"] is False

    # 3. Update to version 2
    update_payload = {
        "title": "Investigative Standard Operating Procedures (Revised)",
        "body_markdown": "# SOP 2026 Revised\n\n1. Check blockchain custody timestamps.",
        "change_summary": "Added blockchain custody guidance"
    }
    upd_resp = client.put(
        f"/api/v1/admin/content/pages/{page_id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["current_version"] == 2

    # 4. Rollback to version 1
    roll_resp = client.post(
        f"/api/v1/admin/content/pages/{page_id}/rollback/1",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert roll_resp.status_code == 200
    roll_data = roll_resp.json()
    assert roll_data["title"] == "Investigative Standard Operating Procedures"
    assert "Cross-corroborate CDR" in roll_data["body_markdown"]
