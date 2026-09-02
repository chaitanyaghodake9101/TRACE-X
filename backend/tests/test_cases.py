import pytest
from app.models.user import UserRole

@pytest.fixture
def auth_tokens(client):
    users_data = [
        ("admin@test.gov.in", "AdminPass123!", "Admin User", "admin", "admin"),
        ("senior@test.gov.in", "SeniorPass123!", "Senior User", "senior_investigator", "senior"),
        ("inva@test.gov.in", "InvAPass123!", "Investigator Alpha", "investigator", "inva"),
        ("invb@test.gov.in", "InvBPass123!", "Investigator Beta", "investigator", "invb"),
        ("auditor@test.gov.in", "AuditorPass123!", "Auditor User", "auditor", "auditor"),
    ]
    tokens = {}
    user_ids = {}
    for email, pwd, name, role, key in users_data:
        reg_res = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": pwd, "full_name": name, "role": role}
        )
        if reg_res.status_code == 201:
            user_ids[key] = reg_res.json()["id"]
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": pwd}
        )
        tokens[key] = login_res.json()["access_token"]
        if key not in user_ids and "user" in login_res.json():
            user_ids[key] = login_res.json()["user"]["id"]

    return tokens, user_ids

def test_create_case_and_duplicate_handling(client, auth_tokens):
    tokens, user_ids = auth_tokens
    inv_token = tokens["inva"]

    # 1. Successful case creation
    res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Money Laundering Hawala Hub",
            "case_number": "FIR-2026-DEL-101",
            "description": "Suspect network laundering funds through front companies",
            "priority": "high",
            "status": "open"
        },
        headers={"Authorization": f"Bearer {inv_token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["case_number"] == "FIR-2026-DEL-101"
    assert data["priority"] == "high"

    # 2. Duplicate case number rejection
    dup_res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Duplicate Case",
            "case_number": "FIR-2026-DEL-101",
            "priority": "low"
        },
        headers={"Authorization": f"Bearer {inv_token}"}
    )
    assert dup_res.status_code == 400

    # 3. Auditor cannot create case (Read-only)
    auditor_token = tokens["auditor"]
    audit_create_res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Auditor Attempt Case",
            "case_number": "FIR-2026-DEL-999",
            "priority": "low"
        },
        headers={"Authorization": f"Bearer {auditor_token}"}
    )
    assert audit_create_res.status_code == 403

def test_case_visibility_rbac_scoping(client, auth_tokens):
    tokens, user_ids = auth_tokens
    
    # Investigator A creates Case Alpha
    res_a = client.post(
        "/api/v1/cases/",
        json={
            "title": "Case Alpha Secret Operation",
            "case_number": "FIR-2026-OP-ALPHA",
            "priority": "critical"
        },
        headers={"Authorization": f"Bearer {tokens['inva']}"}
    )
    case_a_id = res_a.json()["id"]

    # Investigator B creates Case Beta
    res_b = client.post(
        "/api/v1/cases/",
        json={
            "title": "Case Beta Narcotics Ring",
            "case_number": "FIR-2026-OP-BETA",
            "priority": "medium"
        },
        headers={"Authorization": f"Bearer {tokens['invb']}"}
    )
    case_b_id = res_b.json()["id"]

    # Investigator A lists cases -> sees Case Alpha, NOT Case Beta
    inv_list = client.get(
        "/api/v1/cases/",
        headers={"Authorization": f"Bearer {tokens['inva']}"}
    )
    assert inv_list.status_code == 200
    inv_case_ids = [c["id"] for c in inv_list.json()]
    assert case_a_id in inv_case_ids
    assert case_b_id not in inv_case_ids

    # Senior Investigator lists cases -> sees all
    senior_list = client.get(
        "/api/v1/cases/",
        headers={"Authorization": f"Bearer {tokens['senior']}"}
    )
    assert senior_list.status_code == 200
    senior_case_ids = [c["id"] for c in senior_list.json()]
    assert case_a_id in senior_case_ids
    assert case_b_id in senior_case_ids

    # Investigator A tries to get Case Beta directly -> 403 Forbidden
    direct_res = client.get(
        f"/api/v1/cases/{case_b_id}",
        headers={"Authorization": f"Bearer {tokens['inva']}"}
    )
    assert direct_res.status_code == 403

def test_case_update_and_reassignment(client, auth_tokens):
    tokens, user_ids = auth_tokens

    # Senior Investigator creates case
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Cyber Extortion Syndicate",
            "case_number": "FIR-2026-CYBER-001",
            "priority": "medium",
            "status": "open"
        },
        headers={"Authorization": f"Bearer {tokens['senior']}"}
    )
    case_id = case_res.json()["id"]

    # 1. Update status to under_investigation
    status_res = client.patch(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "under_investigation"},
        headers={"Authorization": f"Bearer {tokens['senior']}"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "under_investigation"

    # 2. Reassign case to investigator A
    assign_res = client.patch(
        f"/api/v1/cases/{case_id}/assign",
        json={"assigned_to": user_ids["inva"]},
        headers={"Authorization": f"Bearer {tokens['senior']}"}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["assigned_to"] == user_ids["inva"]

    # 3. Now investigator A can access the case
    inv_access_res = client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {tokens['inva']}"}
    )
    assert inv_access_res.status_code == 200

def test_case_deletion_rbac(client, auth_tokens):
    tokens, user_ids = auth_tokens

    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Temporary Case for Deletion Test",
            "case_number": "FIR-2026-DEL-TEMP",
            "priority": "low"
        },
        headers={"Authorization": f"Bearer {tokens['senior']}"}
    )
    case_id = case_res.json()["id"]

    # 1. Investigator cannot delete case (403)
    inv_del = client.delete(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {tokens['inva']}"}
    )
    assert inv_del.status_code == 403

    # 2. Admin can delete case (200)
    admin_del = client.delete(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {tokens['admin']}"}
    )
    assert admin_del.status_code == 200

    # 3. Verify case is gone (404)
    get_res = client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {tokens['admin']}"}
    )
    assert get_res.status_code == 404
