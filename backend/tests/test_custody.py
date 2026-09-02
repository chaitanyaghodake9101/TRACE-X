import uuid
import pytest

@pytest.fixture
def custody_test_case(client):
    unique_email = f"custody.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "CustodyPass123!",
            "full_name": "Custody Inspector",
            "role": "senior_investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "CustodyPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Chain of Custody Test Case {case_num}",
            "case_number": case_num,
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    return token, case_id

def test_evidence_hashing_and_custody_event(client, custody_test_case):
    token, case_id = custody_test_case

    ev_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Digital Ledger Dump",
            "source_type": "financial_records",
            "extracted_text": "Suspect account INR 5,00,000 disbursement record."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert ev_res.status_code == 201
    evidence = ev_res.json()
    assert evidence["sha256_hash"] != ""
    assert len(evidence["sha256_hash"]) == 64
    assert evidence["integrity_status"] == "verified"

    # Check custody chain
    chain_res = client.get(
        f"/api/v1/evidence/{evidence['id']}/custody-chain",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert chain_res.status_code == 200
    chain = chain_res.json()
    assert len(chain) >= 1
    assert chain[0]["event_type"] == "uploaded"
    assert chain[0]["hash_at_event"] == evidence["sha256_hash"]

def test_verify_evidence_integrity(client, custody_test_case):
    token, case_id = custody_test_case

    ev_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "CCTV Log Entry",
            "source_type": "cctv",
            "extracted_text": "Camera 04 captured vehicle DL01AB1234."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    evidence_id = ev_res.json()["id"]

    # Verify integrity
    verify_res = client.post(
        f"/api/v1/evidence/{evidence_id}/verify",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["is_valid"] is True
    assert verify_data["integrity_status"] == "verified"

    # Query integrity detail endpoint
    integrity_detail = client.get(
        f"/api/v1/evidence/{evidence_id}/integrity",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert integrity_detail.status_code == 200
    assert integrity_detail.json()["is_valid"] is True

def test_simulate_tamper_detection(client, custody_test_case):
    token, case_id = custody_test_case

    ev_res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Telco Call Transcript",
            "source_type": "cdr",
            "extracted_text": "Original call transcript from suspect mobile."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    evidence_id = ev_res.json()["id"]

    # Simulate unauthorized tamper
    tamper_res = client.post(
        f"/api/v1/evidence/{evidence_id}/simulate-tamper",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert tamper_res.status_code == 200
    tamper_data = tamper_res.json()
    assert tamper_data["is_valid"] is False
    assert tamper_data["integrity_status"] == "compromised"

    # Verify evidence item is now compromised and quality score penalized
    ev_detail = client.get(
        f"/api/v1/evidence/{evidence_id}",
        headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert ev_detail["integrity_status"] == "compromised"

    # Quality score check
    q_res = client.get(f"/api/v1/evidence/{evidence_id}/quality", headers={"Authorization": f"Bearer {token}"}).json()
    assert q_res["overall_quality_score"] <= 0.15

def test_integrity_pdf_report_export(client, custody_test_case):
    token, case_id = custody_test_case

    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={"title": "FIR Document", "source_type": "fir", "extracted_text": "Sample FIR report."},
        headers={"Authorization": f"Bearer {token}"}
    )

    res = client.post(
        f"/api/v1/cases/{case_id}/integrity-report",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")
