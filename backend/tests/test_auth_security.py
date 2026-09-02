import uuid
import pytest
from app.core.security import hash_token

@pytest.fixture
def registered_user(client):
    email = f"sec.officer.{uuid.uuid4().hex[:6]}@delhipolice.gov.in"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "full_name": "Inspector Security",
            "role": "investigator"
        }
    )
    return {"email": email, "password": "StrongPassword123!", "data": res.json()}

def test_signup_anti_enumeration(client, registered_user):
    # Attempt duplicate registration with same email
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": registered_user["email"],
            "password": "AnotherPassword456!",
            "full_name": "Imposter Officer",
            "role": "investigator"
        }
    )
    # Must succeed with standard 201/200 shape and NOT leak an explicit 400 "already exists" error
    assert res.status_code in [200, 201]
    assert "already exists" not in str(res.content).lower()

def test_login_anti_enumeration_and_timing(client, registered_user):
    # 1. Non-existent account
    res_nonexistent = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent.user.xyz@delhipolice.gov.in", "password": "RandomPass123!"}
    )
    assert res_nonexistent.status_code == 401
    assert res_nonexistent.json()["detail"] == "Invalid email or password"

    # 2. Existing account with wrong password
    res_wrongpass = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "WrongPassword999!"}
    )
    assert res_wrongpass.status_code == 401
    assert res_wrongpass.json()["detail"] == "Invalid email or password"

    # Exact same error message to eliminate user enumeration
    assert res_nonexistent.json()["detail"] == res_wrongpass.json()["detail"]

def test_forgot_password_anti_enumeration(client, registered_user):
    # 1. Request reset for existing user
    res_exist = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": registered_user["email"]}
    )
    assert res_exist.status_code == 200
    msg_exist = res_exist.json()["message"]

    # 2. Request reset for unknown address
    res_unknown = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "completely.unknown.target@mha.gov.in"}
    )
    assert res_unknown.status_code == 200
    msg_unknown = res_unknown.json()["message"]

    # Must be identical generic messaging
    assert msg_exist == msg_unknown
    assert "If an eligible account exists" in msg_exist

def test_reset_password_token_hashing_and_single_use(client, registered_user, db_session):
    from app.models.user import User, PasswordResetToken
    from app.core.security import generate_secure_token

    user = db_session.query(User).filter(User.email == registered_user["email"]).first()
    assert user is not None

    raw_token, t_hash = generate_secure_token()
    token_entry = PasswordResetToken(
        user_id=user.id,
        token_hash=t_hash,
        expires_at=user.created_at.replace(year=2030) # Future expiration
    )
    db_session.add(token_entry)
    db_session.commit()

    # 1. Successfully reset password with raw token
    res_reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "NewSecurePassword456!"}
    )
    assert res_reset.status_code == 200
    assert res_reset.json()["status"] == "success"

    # 2. Re-attempting with same token must fail (Single-use enforcement)
    res_reuse = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "new_password": "AnotherNewPassword789!"}
    )
    assert res_reuse.status_code == 400
    assert "invalid or has expired" in res_reuse.json()["detail"].lower()

    # 3. Verify login works with new password
    login_new = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "NewSecurePassword456!"}
    )
    assert login_new.status_code == 200
    assert "access_token" in login_new.json()

def test_email_verification_flow(client, db_session):
    from app.models.user import User, EmailVerificationToken
    from app.core.security import generate_secure_token

    test_email = f"unverified.{uuid.uuid4().hex[:6]}@mha.gov.in"
    user = User(
        email=test_email,
        hashed_password="dummy_hash_value",
        full_name="Unverified Agent",
        is_verified=False
    )
    db_session.add(user)
    db_session.commit()

    raw_vtoken, vtoken_hash = generate_secure_token()
    v_entry = EmailVerificationToken(
        user_id=user.id,
        token_hash=vtoken_hash,
        expires_at=user.created_at.replace(year=2030)
    )
    db_session.add(v_entry)
    db_session.commit()

    # Verify email
    res = client.post(
        "/api/v1/auth/verify-email",
        json={"token": raw_vtoken}
    )
    assert res.status_code == 200
    assert "successfully verified" in res.json()["message"].lower()

    db_session.refresh(user)
    assert user.is_verified is True

def test_security_headers_present(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "Content-Security-Policy" in res.headers
    assert "Referrer-Policy" in res.headers

def test_idor_case_evidence_protection(client, registered_user):
    # Register second officer
    other_email = f"other.officer.{uuid.uuid4().hex[:6]}@delhipolice.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": other_email,
            "password": "Password123!",
            "full_name": "Officer Two",
            "role": "investigator"
        }
    )
    login_other = client.post(
        "/api/v1/auth/login",
        json={"email": other_email, "password": "Password123!"}
    )
    token_other = login_other.json()["access_token"]

    # Login first officer and create case
    login_user1 = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "StrongPassword123!"}
    )
    token_user1 = login_user1.json()["access_token"]

    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Restricted Secret Case",
            "case_number": f"FIR-SEC-{uuid.uuid4().hex[:4].upper()}",
            "priority": "critical"
        },
        headers={"Authorization": f"Bearer {token_user1}"}
    )
    case_id = case_res.json()["id"]

    # User 1 creates evidence
    ev_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Confidential Intelligence File",
            "source_type": "fir",
            "extracted_text": "Sensitive operational payload"
        },
        headers={"Authorization": f"Bearer {token_user1}"}
    )
    ev_id = ev_res.json()["id"]

    # User 2 (Unassigned investigator) attempts to read User 1's evidence via IDOR
    unauthorized_res = client.get(
        f"/api/v1/evidence/{ev_id}",
        headers={"Authorization": f"Bearer {token_other}"}
    )
    assert unauthorized_res.status_code == 403
    assert "Access denied" in unauthorized_res.json()["detail"]
