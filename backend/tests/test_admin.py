import uuid
import pytest

@pytest.fixture
def admin_auth(client):
    unique_email = f"admin.test.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "AdminPassword123!",
            "full_name": "Chief Administrator",
            "role": "admin"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "AdminPassword123!"}
    )
    token = login_res.json()["access_token"]
    return token

@pytest.fixture
def sample_officer(client, admin_auth):
    officer_email = f"officer.{uuid.uuid4().hex[:6]}@delhipolice.gov.in"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": officer_email,
            "password": "OfficerPass123!",
            "full_name": "Inspector Rahul Sharma",
            "role": "investigator"
        }
    )
    return reg_res.json()

def test_list_officers(client, admin_auth, sample_officer):
    res = client.get(
        "/api/v1/admin/officers",
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res.status_code == 200
    officers = res.json()
    assert len(officers) >= 1
    assert any(o["email"] == sample_officer["email"] for o in officers)

def test_update_officer_details(client, admin_auth, sample_officer):
    officer_id = sample_officer["id"]
    badge_no = f"DL-POL-{uuid.uuid4().hex[:4].upper()}"

    res = client.put(
        f"/api/v1/admin/officers/{officer_id}",
        json={
            "full_name": "Senior Inspector Rahul Sharma",
            "badge_number": badge_no,
            "phone_number": "+91-9876500000",
            "station": "Connaught Place Police Station",
            "role": "senior_investigator"
        },
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["full_name"] == "Senior Inspector Rahul Sharma"
    assert updated["badge_number"] == badge_no
    assert updated["station"] == "Connaught Place Police Station"
    assert updated["role"] == "senior_investigator"

def test_toggle_officer_status(client, admin_auth, sample_officer):
    officer_id = sample_officer["id"]

    res = client.patch(
        f"/api/v1/admin/officers/{officer_id}/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res.status_code == 200
    assert res.json()["is_active"] is False

    # Reactivate
    res2 = client.patch(
        f"/api/v1/admin/officers/{officer_id}/status",
        json={"is_active": True},
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res2.status_code == 200
    assert res2.json()["is_active"] is True

def test_force_password_reset(client, admin_auth, sample_officer):
    officer_id = sample_officer["id"]

    res = client.post(
        f"/api/v1/admin/officers/{officer_id}/reset-password",
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "reset_token" in data
    assert "reset_url" in data
    assert data["email"] == sample_officer["email"]

def test_officer_activity_timeline(client, admin_auth, sample_officer):
    officer_id = sample_officer["id"]

    res = client.get(
        f"/api/v1/admin/officers/{officer_id}/activity",
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_bulk_officer_action(client, admin_auth, sample_officer):
    officer_id = sample_officer["id"]

    res = client.post(
        "/api/v1/admin/officers/bulk-action",
        json={"officer_ids": [officer_id], "action": "deactivate"},
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert res.status_code == 200
    assert res.json()["affected_count"] == 1

def test_system_health_and_tampering_analytics(client, admin_auth):
    health_res = client.get(
        "/api/v1/admin/system-health",
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert health_data["status"] in ["healthy", "degraded"]
    assert len(health_data["components"]) >= 3

    tamper_res = client.get(
        "/api/v1/admin/tampering-reports",
        headers={"Authorization": f"Bearer {admin_auth}"}
    )
    assert tamper_res.status_code == 200
    tamper_data = tamper_res.json()
    assert "total_evidence_count" in tamper_data
    assert "tamper_rate_percentage" in tamper_data
