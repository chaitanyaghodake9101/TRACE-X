import uuid
import pytest

@pytest.fixture
def user_auth(client):
    unique_email = f"help.user.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "HelpUserPass123!",
            "full_name": "Help Reader",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "HelpUserPass123!"}
    )
    token = login_res.json()["access_token"]
    return token

def test_get_faq_list_and_search(client):
    # Public / authenticated FAQ list
    res = client.get("/api/v1/help/faq")
    assert res.status_code == 200
    faqs = res.json()
    assert len(faqs) >= 10

    # Search filter
    search_res = client.get("/api/v1/help/faq?search=sha256")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data) >= 1
    assert "sha-256" in search_data[0]["answer"].lower() or "sha256" in search_data[0]["tags"]

def test_get_knowledge_articles(client):
    res = client.get("/api/v1/help/articles")
    assert res.status_code == 200
    articles = res.json()
    assert len(articles) >= 4

def test_get_video_tutorials(client):
    res = client.get("/api/v1/help/videos")
    assert res.status_code == 200
    videos = res.json()
    assert len(videos) == 5

def test_mark_tour_complete(client, user_auth):
    res = client.post(
        "/api/v1/help/tour-complete",
        headers={"Authorization": f"Bearer {user_auth}"}
    )
    assert res.status_code == 200
    assert res.json()["has_completed_tour"] is True
