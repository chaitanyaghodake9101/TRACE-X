import pytest
from app.models.tutorial import Tutorial, TutorialProgress

def test_tutorial_crud_and_progress_tracking(client, db_session, admin_token, auth_token):
    # 1. Admin creates a tutorial with steps and YouTube video URL
    tut_payload = {
        "title": "Mastering Heuer Competing Hypotheses",
        "description": "Learn how the 1.5x contradiction diagnostic penalty operates in TRACE-X.",
        "category": "ACH Hypotheses",
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 8,
        "order_index": 1,
        "is_published": True,
        "steps": [
            {
                "step_number": 1,
                "title": "Formulate mutually exclusive scenarios",
                "detail": "Define H1 (Prime Suspect), H2 (Unwitting Mule), H3 (Alibi)."
            },
            {
                "step_number": 2,
                "title": "Link evidence items",
                "detail": "Label evidence as consistent, neutral, or inconsistent with 1.5x weight."
            }
        ]
    }
    create_resp = client.post(
        "/api/v1/admin/tutorials",
        json=tut_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_resp.status_code == 200
    tut_data = create_resp.json()
    tut_id = tut_data["id"]
    assert tut_data["youtube_id"] == "dQw4w9WgXcQ"
    assert len(tut_data["steps_json"]) == 2

    # 2. Public / authenticated user views tutorial list
    list_resp = client.get(
        "/api/v1/tutorials",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert list_resp.status_code == 200
    tutorials = list_resp.json()
    assert any(t["id"] == tut_id for t in tutorials)

    # 3. User updates progress
    prog_resp = client.post(
        f"/api/v1/tutorials/{tut_id}/progress",
        json={"last_step_index": 1, "completed": False},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert prog_resp.status_code == 200
    prog_data = prog_resp.json()
    assert prog_data["last_step_index"] == 1
    assert prog_data["completed"] is False

    # Mark as completed
    prog_done = client.post(
        f"/api/v1/tutorials/{tut_id}/progress",
        json={"last_step_index": 2, "completed": True},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert prog_done.status_code == 200
    assert prog_done.json()["completed"] is True
