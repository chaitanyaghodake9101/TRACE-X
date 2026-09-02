import uuid
import pytest

@pytest.fixture
def intelligence_fixture(client):
    unique_email = f"intel.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "IntelPass123!",
            "full_name": "Senior Investigator Roy",
            "role": "senior_investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "IntelPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-INTEL-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Investigation Intelligence Case {case_num}",
            "case_number": case_num,
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    # Ingest Evidence
    ev_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Subpoenaed Bank Statement",
            "source_type": "financial_records",
            "extracted_text": "INR 2 Crore remitted to offshore entity."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    ev_id = ev_res.json()["id"]

    # Ingest Entity 1
    ent_res1 = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={
            "name": "Arjun Singhania",
            "entity_type": "person",
            "confidence_score": 0.50
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    ent_id = ent_res1.json()["id"]

    # Ingest Entity 2
    ent_res2 = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={
            "name": "Singhania Holdings Ltd",
            "entity_type": "organization",
            "confidence_score": 0.85
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    ent_id2 = ent_res2.json()["id"]

    # Add Relationship between entities
    client.post(
        f"/api/v1/cases/{case_id}/relationships",
        json={
            "source_entity_id": ent_id,
            "target_entity_id": ent_id2,
            "relationship_type": "owns",
            "weight": 1.0,
            "confidence_score": 0.9
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # Ingest Hypothesis
    hyp_res = client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={
            "title": "Offshore Capital Flight",
            "status": "active"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    hyp_id = hyp_res.json()["id"]

    return token, case_id, ev_id, ent_id, hyp_id

def test_simulation_endpoints_flow(client, intelligence_fixture):
    token, case_id, ev_id, ent_id, hyp_id = intelligence_fixture

    # 1. Create Simulation Branch
    branch_res = client.post(
        f"/api/v1/cases/{case_id}/simulations",
        json={
            "name": "Branch: Exclude Offshore Records",
            "description": "Evaluating theory if banking subpoena is suppressed."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert branch_res.status_code == 201
    branch = branch_res.json()
    branch_id = branch["id"]

    # 2. Add Override
    override_res = client.post(
        f"/api/v1/simulations/{branch_id}/override",
        json={
            "evidence_id": ev_id,
            "is_excluded": True,
            "notes": "Bank record suppressed"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert override_res.status_code == 201

    # 3. Compare Branch
    compare_res = client.get(
        f"/api/v1/simulations/{branch_id}/compare",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert compare_res.status_code == 200
    comp = compare_res.json()
    assert comp["total_overrides"] == 1
    assert len(comp["hypothesis_deltas"]) >= 1

    # 4. Request Review
    rev_res = client.post(
        f"/api/v1/simulations/{branch_id}/request-review",
        json={"review_notes": "Recommend formal investigative subpoena review."},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert rev_res.status_code == 201
    assert rev_res.json()["status"] == "pending"

def test_resilience_endpoints_flow(client, intelligence_fixture):
    token, case_id, ev_id, ent_id, hyp_id = intelligence_fixture

    # 1. Trigger Resilience Run
    run_res = client.post(
        f"/api/v1/cases/{case_id}/resilience/run",
        json={
            "test_type": "node_removal",
            "target_entity_ids": [ent_id],
            "removal_fraction": 0.2
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert run_res.status_code == 201
    run_data = run_res.json()
    assert "fragmentation_index" in run_data

    # 2. Get Latest
    latest_res = client.get(
        f"/api/v1/cases/{case_id}/resilience/latest",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert latest_res.status_code == 200

    # 3. Trigger Monte Carlo
    mc_res = client.post(
        f"/api/v1/cases/{case_id}/resilience/monte-carlo",
        json={"seed": 99, "iterations": 15, "perturbation_rate": 0.15},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert mc_res.status_code == 201
    assert mc_res.json()["seed"] == 99

def test_review_priority_and_tasks_flow(client, intelligence_fixture):
    token, case_id, ev_id, ent_id, hyp_id = intelligence_fixture

    # 1. Fetch Review Priorities
    prio_res = client.get(
        f"/api/v1/cases/{case_id}/review-priorities",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert prio_res.status_code == 200
    prios = prio_res.json()
    assert len(prios) >= 1
    assert "suggested_review_tier" in prios[0]

    # 2. Fetch Review Tasks
    tasks_res = client.get(
        f"/api/v1/cases/{case_id}/review-tasks",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert tasks_res.status_code == 200

    # 3. Create Manual Review Task
    create_task_res = client.post(
        f"/api/v1/cases/{case_id}/review-tasks",
        json={
            "evidence_id": ev_id,
            "title": "Verify Offshore Wire Transfer Voucher",
            "priority": "P0"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_task_res.status_code == 201
    task_id = create_task_res.json()["id"]

    # 4. Perform Action on Task
    action_res = client.post(
        f"/api/v1/review-tasks/{task_id}/actions",
        json={
            "action_taken": "hash_reverified",
            "notes": "Wire voucher matched bank official ledger.",
            "new_status": "reverified"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert action_res.status_code == 201

def test_disagreements_endpoints_flow(client, intelligence_fixture):
    token, case_id, ev_id, ent_id, hyp_id = intelligence_fixture

    # 1. Scan Disagreements
    scan_res = client.post(
        f"/api/v1/cases/{case_id}/disagreements/scan",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert scan_res.status_code == 200
    data = scan_res.json()
    assert "total_signals" in data

    # 2. If signals exist, contest one
    if data["signals"]:
        sig_id = data["signals"][0]["id"]
        contest_res = client.post(
            f"/api/v1/disagreements/{sig_id}/contest",
            json={
                "contest_action": "override_confidence",
                "justification": "Direct bank officer witness confirms validity.",
                "adjusted_confidence": 0.90
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert contest_res.status_code == 201
        assert contest_res.json()["contest_action"] == "override_confidence"
