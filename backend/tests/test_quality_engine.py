import math
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from app.models.evidence import EvidenceSourceType
from app.services.quality_engine import compute_4d_quality_score

def test_evidence_quality_mathematical_model():
    # 1. Fresh FIR with high completeness and 2 independent corroborations
    score_data = compute_4d_quality_score(
        source_type=EvidenceSourceType.FIR,
        event_timestamp=datetime.now(timezone.utc),
        extracted_text="Detailed FIR report containing full suspect statement and vehicle license plates with verified transaction numbers.",
        metadata_json={"detected_phone_numbers": ["9876543210"], "format": "plain_text"},
        corroborating_sources_count=2
    )
    # S = 0.90, T = 1.0, C = min(1.0, 0.3 + 0.2*2) = 0.70, D ~ 0.55
    # Expected overall = 0.35*0.90 + 0.20*1.0 + 0.30*0.70 + 0.15*D >= 0.75
    assert score_data["source_reliability_score"] == 0.90
    assert score_data["temporal_freshness_score"] == 1.0
    assert score_data["cross_corroboration_score"] == 0.70
    assert score_data["overall_quality_score"] >= 0.75

def test_temporal_half_life_exponential_decay():
    # 30 days decay -> T(e) should be approx exp(-0.0231 * 30) = 0.50
    t_30 = compute_4d_quality_score(
        source_type=EvidenceSourceType.CDR,
        event_timestamp=datetime.now(timezone.utc) - timedelta(days=30),
        extracted_text="CDR call log record"
    )["temporal_freshness_score"]
    assert 0.48 <= t_30 <= 0.52

    # 60 days decay -> T(e) should be approx exp(-0.0231 * 60) = 0.25
    t_60 = compute_4d_quality_score(
        source_type=EvidenceSourceType.CDR,
        event_timestamp=datetime.now(timezone.utc) - timedelta(days=60),
        extracted_text="CDR call log record"
    )["temporal_freshness_score"]
    assert 0.23 <= t_60 <= 0.27

@pytest.fixture
def quality_case_setup(client):
    unique_email = f"quality.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "QualPass123!",
            "full_name": "Inspector Quality",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "QualPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Quality Corroboration Investigation {case_num}",
            "case_number": case_num,
            "priority": "critical"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    return token, case_id

def test_cross_source_corroboration_and_propagation(client, quality_case_setup):
    token, case_id = quality_case_setup

    # 1. Ingest FIR mentioning suspect Vikram Malhotra and phone 9876543210
    fir_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "FIR Document Complaint",
            "source_type": "fir",
            "extracted_text": "Suspect Vikram Malhotra with mobile 9876543210 committed fraudulent transaction."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    fir_id = fir_res.json()["id"]

    # Check initial corroboration score (isolated item = base 0.30)
    fir_score_res = client.get(
        f"/api/v1/evidence/{fir_id}/quality",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert fir_score_res.json()["cross_corroboration_score"] == 0.30

    # 2. Ingest CDR from distinct telco source confirming communication from 9876543210
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Telco Call Detail Records",
            "source_type": "cdr",
            "extracted_text": "Tower log confirms active calls from mobile 9876543210 in Delhi zone."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # 3. Ingest CCTV confirming Vikram Malhotra
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "CCTV Footage Log",
            "source_type": "cctv",
            "extracted_text": "Surveillance camera shows Vikram Malhotra entering premises."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # 4. Trigger Recalculate Quality Scores
    recalc_res = client.post(
        f"/api/v1/cases/{case_id}/evidence-quality/recalculate",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert recalc_res.status_code == 200
    recalc_data = recalc_res.json()
    assert recalc_data["evidence_items_recalculated"] == 3

    # 5. Verify FIR cross-corroboration score boosted due to CDR and CCTV corroboration
    updated_fir_score = client.get(
        f"/api/v1/evidence/{fir_id}/quality",
        headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert updated_fir_score["cross_corroboration_score"] >= 0.50
    assert updated_fir_score["overall_quality_score"] > fir_res.json()["quality_score"]["overall_quality_score"]

    # 6. Verify case quality summary
    summary_res = client.get(
        f"/api/v1/cases/{case_id}/evidence-quality/summary",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_evidence"] == 3
    assert summary["high_quality_count"] >= 1
    assert "source_reliability" in summary["dimension_averages"]
