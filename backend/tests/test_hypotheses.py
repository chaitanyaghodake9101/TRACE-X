import uuid
import pytest
from app.models.hypothesis import HypothesisStatus, HypothesisRelationType

@pytest.fixture
def hypothesis_test_case(client):
    unique_email = f"hypo.analyst.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "HypoPass123!",
            "full_name": "Analyst Heuer",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "HypoPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Competing Hypotheses ACH Evaluation {case_num}",
            "case_number": case_num,
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    # 1. Ingest Evidence 1 (FIR - High Quality)
    ev1_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "FIR Intercept Bank Log",
            "source_type": "fir",
            "extracted_text": "Suspect transferred INR 50 Lakhs to shell entity Vikas Exports."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    ev1_id = ev1_res.json()["id"]

    # 2. Ingest Evidence 2 (Alibi Witness - Medium Quality)
    ev2_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Alibi Witness Statement",
            "source_type": "witness_statement",
            "extracted_text": "Accountant testifies suspect was hospitalized abroad during transactions."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    ev2_id = ev2_res.json()["id"]

    return token, case_id, ev1_id, ev2_id

def test_hypothesis_creation_and_baseline_score(client, hypothesis_test_case):
    token, case_id, ev1_id, ev2_id = hypothesis_test_case

    # Create H1: Primary Syndicate
    h1_res = client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={
            "title": "H1: Orchestrated Hawala Syndicate",
            "description": "The transactions are part of a coordinated money laundering ring.",
            "status": "active"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert h1_res.status_code == 201
    h1_data = h1_res.json()
    assert h1_data["title"] == "H1: Orchestrated Hawala Syndicate"
    assert h1_data["score"] is not None
    # Baseline with 0 linked evidence -> raw_score = 0, normalized_score = 0.50 (sigmoid(0))
    assert h1_data["score"]["normalized_score"] == 0.50

def test_evidence_linking_and_contradiction_penalty(client, hypothesis_test_case):
    token, case_id, ev1_id, ev2_id = hypothesis_test_case

    # Create H1
    h1_id = client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={
            "title": "H1: Hawala Ring",
            "status": "active"
        },
        headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    # 1. Link Evidence 1 as SUPPORTS H1
    link1_res = client.post(
        f"/api/v1/hypotheses/{h1_id}/evidence",
        json={
            "evidence_id": ev1_id,
            "relationship_type": "supports",
            "relationship_strength": 1.0,
            "rationale": "Direct money trail confirmed in FIR"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert link1_res.status_code == 201

    h1_detail = client.get(f"/api/v1/hypotheses/{h1_id}", headers={"Authorization": f"Bearer {token}"}).json()
    assert h1_detail["score"]["supporting_weight_sum"] > 0
    assert h1_detail["score"]["raw_score"] > 0
    assert h1_detail["score"]["normalized_score"] > 0.50  # Likelihood increases with support

    # 2. Link Evidence 2 as CONTRADICTS H1 (Alibi contradicts primary actor presence)
    link2_res = client.post(
        f"/api/v1/hypotheses/{h1_id}/evidence",
        json={
            "evidence_id": ev2_id,
            "relationship_type": "contradicts",
            "relationship_strength": 1.0,
            "rationale": "Alibi contradicts direct physical presence"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert link2_res.status_code == 201

    h1_updated = client.get(f"/api/v1/hypotheses/{h1_id}", headers={"Authorization": f"Bearer {token}"}).json()
    # RawScore should reflect 1.5x contradiction penalty: Support - 1.5 * Contradict
    supp = h1_updated["score"]["supporting_weight_sum"]
    contra = h1_updated["score"]["contradicting_weight_sum"]
    expected_raw = round(supp - 1.5 * contra, 3)
    assert h1_updated["score"]["raw_score"] == expected_raw

def test_side_by_side_ach_comparison(client, hypothesis_test_case):
    token, case_id, ev1_id, ev2_id = hypothesis_test_case

    # H1: Working Hypothesis
    h1_id = client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={"title": "H1: Coordinated Syndicate", "status": "active"},
        headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    # H2: Alternative Hypothesis (Identity Impersonation)
    h2_id = client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={"title": "H2: Identity Impersonation", "status": "active"},
        headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    # EV1 supports H1, contradicts H2
    client.post(
        f"/api/v1/hypotheses/{h1_id}/evidence",
        json={"evidence_id": ev1_id, "relationship_type": "supports", "relationship_strength": 1.0},
        headers={"Authorization": f"Bearer {token}"}
    )
    client.post(
        f"/api/v1/hypotheses/{h2_id}/evidence",
        json={"evidence_id": ev1_id, "relationship_type": "contradicts", "relationship_strength": 1.0},
        headers={"Authorization": f"Bearer {token}"}
    )

    # EV2 contradicts H1, supports H2
    client.post(
        f"/api/v1/hypotheses/{h1_id}/evidence",
        json={"evidence_id": ev2_id, "relationship_type": "contradicts", "relationship_strength": 1.0},
        headers={"Authorization": f"Bearer {token}"}
    )
    client.post(
        f"/api/v1/hypotheses/{h2_id}/evidence",
        json={"evidence_id": ev2_id, "relationship_type": "supports", "relationship_strength": 1.0},
        headers={"Authorization": f"Bearer {token}"}
    )

    # Trigger ACH Comparison
    compare_res = client.get(
        f"/api/v1/hypotheses/{h1_id}/compare?target_id={h2_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert compare_res.status_code == 200
    comp_data = compare_res.json()

    assert comp_data["diagnostic_evidence_count"] >= 2
    assert "comparison_matrix" in comp_data
    for item in comp_data["comparison_matrix"]:
        assert item["is_diagnostic"] is True
