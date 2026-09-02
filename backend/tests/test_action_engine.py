import uuid
import pytest
from app.models.action import ActionType, ActionStatus

@pytest.fixture
def action_test_setup(client):
    unique_email = f"action.lead.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "ActionPass123!",
            "full_name": "Lead Prioritizer",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "ActionPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Information Gain Prioritization Test {case_num}",
            "case_number": case_num,
            "priority": "critical"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    # 1. Create a low-confidence entity (target for high gap multiplier)
    ent_res = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={
            "name": "Unknown Hawala Operator",
            "entity_type": "person",
            "canonical_name": "Unknown Operator X",
            "confidence_score": 0.30  # Low confidence -> gap multiplier = 1.0 + 0.5*(1 - 0.3) = 1.35
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    entity_id = ent_res.json()["id"]

    # 2. Create 2 competing hypotheses with identical 50% likelihood (max uncertainty -> hypo multiplier = 2.0)
    client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={"title": "H1: Transnational Syndicate", "status": "active"},
        headers={"Authorization": f"Bearer {token}"}
    )
    client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={"title": "H2: Domestic Identity Impersonation", "status": "active"},
        headers={"Authorization": f"Bearer {token}"}
    )

    return token, case_id, entity_id

def test_information_gain_calculation_and_ranking(client, action_test_setup):
    token, case_id, entity_id = action_test_setup

    # 1. Create Action 1: Financial Records on low-confidence entity (high base gain 0.90, high gap multiplier)
    a1_res = client.post(
        f"/api/v1/cases/{case_id}/actions",
        json={
            "title": "Subpoena Bank Accounts of Operator X",
            "action_type": "obtain_financial_records",
            "target_entity_id": entity_id
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert a1_res.status_code == 201
    a1 = a1_res.json()
    assert a1["base_gain"] == 0.90
    assert a1["gap_multiplier"] >= 1.30  # Low confidence boost
    assert a1["hypothesis_multiplier"] >= 1.90  # High uncertainty boost
    assert a1["priority_rank"] == 1

    # 2. Create Action 2: Routine Witness Interview without target entity (lower base gain 0.60, base gap 1.0)
    a2_res = client.post(
        f"/api/v1/cases/{case_id}/actions",
        json={
            "title": "Interview Hotel Security Guard",
            "action_type": "interview_witness"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert a2_res.status_code == 201
    a2 = a2_res.json()
    assert a2["base_gain"] == 0.60
    assert a2["gap_multiplier"] == 1.0

    # 3. List actions and verify rank order: A1 should be Rank 1, A2 should be Rank 2
    actions = client.get(f"/api/v1/cases/{case_id}/actions", headers={"Authorization": f"Bearer {token}"}).json()
    assert len(actions) == 2
    assert actions[0]["id"] == a1["id"]
    assert actions[0]["priority_rank"] == 1
    assert actions[1]["id"] == a2["id"]
    assert actions[1]["priority_rank"] == 2
    assert actions[0]["expected_information_gain"] > actions[1]["expected_information_gain"]

def test_action_completion_and_outcome_logging(client, action_test_setup):
    token, case_id, entity_id = action_test_setup

    # Create action
    act_res = client.post(
        f"/api/v1/cases/{case_id}/actions",
        json={
            "title": "Analyze Forensic Drive Image",
            "action_type": "forensic_analysis"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    action_id = act_res.json()["id"]

    # Complete action
    complete_res = client.post(
        f"/api/v1/actions/{action_id}/complete",
        json={
            "outcome_notes": "Hard drive contained 14 encrypted transaction logs revealing shell companies.",
            "produced_new_evidence": True,
            "effectiveness_score": 0.95
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert complete_res.status_code == 200
    outcome = complete_res.json()
    assert outcome["produced_new_evidence"] is True
    assert outcome["effectiveness_score"] == 0.95

    # Check updated action status
    updated_act = client.get(f"/api/v1/actions/{action_id}", headers={"Authorization": f"Bearer {token}"}).json()
    assert updated_act["status"] == "completed"
    assert updated_act["outcome"] is not None
