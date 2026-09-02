import pytest
from app.models.user import UserRole

def test_register_user_success(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "investigator.raj@tracex.gov.in",
            "password": "SecurePassword123!",
            "full_name": "Rajesh Kumar",
            "role": "investigator"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "investigator.raj@tracex.gov.in"
    assert data["full_name"] == "Rajesh Kumar"
    assert data["role"] == "investigator"
    assert "id" in data

def test_register_duplicate_email_anti_enumeration(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "investigator.raj@tracex.gov.in",
            "password": "AnotherPassword456!",
            "full_name": "Duplicate Raj",
            "role": "investigator"
        }
    )
    # Anti-enumeration response: does not leak explicit 400 error
    assert response.status_code in [200, 201]
    assert "already exists" not in str(response.content).lower()

def test_login_success(client):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "investigator.raj@tracex.gov.in",
            "password": "SecurePassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "investigator.raj@tracex.gov.in"

def test_login_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "investigator.raj@tracex.gov.in",
            "password": "WrongPassword!"
        }
    )
    assert response.status_code == 401

def test_refresh_token_flow(client):
    # 1. Login to obtain refresh token
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "investigator.raj@tracex.gov.in",
            "password": "SecurePassword123!"
        }
    )
    refresh_token = login_res.json()["refresh_token"]

    # 2. Call refresh endpoint
    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert refresh_res.status_code == 200
    data = refresh_res.json()
    assert "access_token" in data
    new_access_token = data["access_token"]

    # 3. Verify new access token works on protected route
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_access_token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "investigator.raj@tracex.gov.in"

def test_refresh_token_invalid(client):
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid.jwt.token"}
    )
    assert response.status_code == 401

def test_rbac_user_management(client):
    # 1. Create Admin user
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin.super@tracex.gov.in",
            "password": "AdminPassword123!",
            "full_name": "Super Admin",
            "role": "admin"
        }
    )
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin.super@tracex.gov.in", "password": "AdminPassword123!"}
    )
    admin_token = admin_login.json()["access_token"]

    # 2. Create Auditor user
    auditor_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auditor.verma@tracex.gov.in",
            "password": "AuditorPass123!",
            "full_name": "Auditor Verma",
            "role": "auditor"
        }
    )
    auditor_id = auditor_res.json()["id"]
    auditor_login = client.post(
        "/api/v1/auth/login",
        json={"email": "auditor.verma@tracex.gov.in", "password": "AuditorPass123!"}
    )
    auditor_token = auditor_login.json()["access_token"]

    # 3. Investigator token from earlier test
    inv_login = client.post(
        "/api/v1/auth/login",
        json={"email": "investigator.raj@tracex.gov.in", "password": "SecurePassword123!"}
    )
    inv_token = inv_login.json()["access_token"]

    # 4. Check Investigator cannot list users (Forbidden)
    inv_users_res = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {inv_token}"}
    )
    assert inv_users_res.status_code == 403

    # 5. Check Admin can list users
    admin_users_res = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_users_res.status_code == 200
    assert len(admin_users_res.json()) >= 3

    # 6. Check Auditor cannot update role (Forbidden)
    auditor_update_res = client.patch(
        f"/api/v1/auth/users/{auditor_id}/role",
        json={"role": "senior_investigator"},
        headers={"Authorization": f"Bearer {auditor_token}"}
    )
    assert auditor_update_res.status_code == 403

    # 7. Check Admin can update role
    admin_update_res = client.patch(
        f"/api/v1/auth/users/{auditor_id}/role",
        json={"role": "senior_investigator"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_update_res.status_code == 200
    assert admin_update_res.json()["role"] == "senior_investigator"

def test_google_oauth_demo_login(client):
    response = client.post(
        "/api/v1/auth/google",
        json={"id_token": "mock-google-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["role"] == "senior_investigator"
