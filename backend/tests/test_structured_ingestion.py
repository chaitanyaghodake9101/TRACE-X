import io
import uuid
import pytest

@pytest.fixture
def test_case_auth(client):
    unique_email = f"ingest.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "IngestPass123!",
            "full_name": "Ingestion Specialist",
            "role": "senior_investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "IngestPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-INGEST-{uuid.uuid4().hex[:4].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": "Structured Ingestion Test Case",
            "case_number": case_num,
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    return token, case_id

def test_upload_structured_cdr_csv(client, test_case_auth):
    token, case_id = test_case_auth

    cdr_csv_content = """caller_number,receiver_number,duration_seconds,tower_location
+91-9876500001,+91-9876500002,120,Tower A1
+91-9876500001,+91-9876500003,45,Tower B2
+91-9876500002,+91-9876500003,300,Tower A1
"""
    file_tuple = ("cdr_dump.csv", io.BytesIO(cdr_csv_content.encode("utf-8")), "text/csv")

    res = client.post(
        f"/api/v1/cases/{case_id}/evidence/cdr",
        data={"title": "Test CDR Telecom Batch"},
        files={"file": file_tuple},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    ev_data = res.json()
    assert ev_data["source_type"] == "cdr"
    assert ev_data["sha256_hash"] != ""
    assert ev_data["integrity_status"] == "verified"

    # Verify key influencers endpoint
    influencers_res = client.get(
        f"/api/v1/cases/{case_id}/graph/key-influencers",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert influencers_res.status_code == 200
    assert len(influencers_res.json()["influencers"]) >= 2

def test_upload_structured_financial_csv(client, test_case_auth):
    token, case_id = test_case_auth

    fin_csv_content = """sender,receiver,amount,bank_name
Vikram Malhotra,Vikas Exports Ltd,14500000,State Bank of India
Vikas Exports Ltd,Dubai Remittance Hub,14500000,Emirates NBD
"""
    file_tuple = ("financial_ledger.csv", io.BytesIO(fin_csv_content.encode("utf-8")), "text/csv")

    res = client.post(
        f"/api/v1/cases/{case_id}/evidence/financial",
        data={"title": "Test Banking RTGS Remittance"},
        files={"file": file_tuple},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    ev_data = res.json()
    assert ev_data["source_type"] == "financial_records"
    assert ev_data["sha256_hash"] != ""

    # Verify pattern detection endpoint
    patterns_res = client.get(
        f"/api/v1/cases/{case_id}/patterns",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patterns_res.status_code == 200
    assert "patterns" in patterns_res.json()
