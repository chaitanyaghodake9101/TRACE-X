import pytest
from app.models.user import User, UserRole
from app.models.case import Case, CaseStatus, CasePriority
from app.models.officer_extension import OfficerProfile, OfficerStatusHistory, OfficerRoleHistory, CaseMembership
from app.core.security import get_password_hash

def test_enhanced_officer_creation_and_profile_extension(client, db_session, admin_token):
    # Create an officer with enhanced profile metadata
    payload = {
        "email": "acp.sharma@delhipolice.gov.in",
        "password": "SecurePassword123!",
        "full_name": "ACP Vikrant Sharma",
        "role": "senior_investigator",
        "phone_number": "+91-9811122233",
        "badge_number": "DL-POL-1001",
        "station": "Crime Branch Headquarters",
        "designation": "Assistant Commissioner of Police",
        "district": "New Delhi",
        "state": "Delhi (NCT)",
        "rank": "ACP",
        "department": "Special Operations Cell"
    }

    resp = client.post(
        "/api/v1/admin/officers/create-extended",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == payload["email"]
    assert data["badge_number"] == payload["badge_number"]
    assert data["profile"] is not None
    assert data["profile"]["designation"] == "Assistant Commissioner of Police"
    assert data["profile"]["district"] == "New Delhi"
    officer_id = data["id"]

    # Verify history tracking
    hist_resp = client.get(
        f"/api/v1/admin/officers/{officer_id}/history",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert len(hist_data["status_history"]) >= 1
    assert len(hist_data["role_history"]) >= 1

    # Update profile & role with reason
    update_payload = {
        "designation": "Deputy Commissioner of Police (Addl.)",
        "rank": "DCP",
        "role": "admin",
        "reason": "Annual department promotion"
    }
    patch_resp = client.patch(
        f"/api/v1/admin/officers/{officer_id}/profile",
        json=update_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["role"] == "admin"
    assert updated_data["profile"]["designation"] == "Deputy Commissioner of Police (Addl.)"

def test_officer_case_memberships(client, db_session, admin_token, auth_user):
    # Create a test case
    case = Case(
        title="Hawala Interception 2026",
        case_number="FIR-2026-HQ-9901",
        status=CaseStatus.OPEN,
        priority=CasePriority.HIGH,
        created_by=auth_user.id
    )
    db_session.add(case)
    db_session.commit()
    db_session.refresh(case)

    # Assign officer to case
    assign_payload = {
        "case_id": case.id,
        "user_id": auth_user.id,
        "assignment_role": "lead"
    }
    assign_resp = client.post(
        f"/api/v1/admin/officers/{auth_user.id}/case-assignments",
        json=assign_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert assign_resp.status_code == 200
    assign_data = assign_resp.json()
    assert assign_data["case_id"] == case.id
    assert assign_data["assignment_role"] == "lead"
    assert assign_data["is_active"] is True
