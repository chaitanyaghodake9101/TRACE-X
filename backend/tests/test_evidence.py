import io
import uuid
import pytest
from app.models.evidence import EvidenceSourceType

@pytest.fixture
def test_case_setup(client):
    # Register and login investigator
    unique_email = f"officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "EvidencePass123!",
            "full_name": "Inspector Mehra",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "EvidencePass123!"}
    )
    token = login_res.json()["access_token"]

    # Create Case with unique case number
    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Evidence Ingestion Case {case_num}",
            "case_number": case_num,
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    return token, case_id

def test_ingest_json_evidence(client, test_case_setup):
    token, case_id = test_case_setup

    res = client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Synthetic FIR Witness Statement",
            "description": "Eyewitness accounts of suspect meeting at Connaught Place",
            "source_type": "witness_statement",
            "extracted_text": "Witness confirms seeing Vikram Malhotra driving vehicle DL01AB1234 on 2026-08-15 near Delhi Metro station.",
            "metadata_json": {"location": "Connaught Place"}
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Synthetic FIR Witness Statement"
    assert data["source_type"] == "witness_statement"
    assert data["quality_score"] is not None
    assert data["quality_score"]["source_reliability_score"] == 0.50
    assert "DL01AB1234" in data["metadata_json"].get("detected_vehicle_numbers", [])

def test_upload_synthetic_fir_text_file(client, test_case_setup):
    token, case_id = test_case_setup

    fir_content = """FIRST INFORMATION REPORT (FIR) - CRIME NO: 104/2026
Station: Cyber Crime Police Station, New Delhi
Date: 2026-08-20
Complainant states that accused Vikas Patel (+919876543210) transferred Rs. 45,00,000 to shell account 9988776655 without authorization.
Suspect was seen departing in vehicle MH12DE9876."""

    file_obj = io.BytesIO(fir_content.encode("utf-8"))

    res = client.post(
        f"/api/v1/cases/{case_id}/evidence/upload",
        data={
            "title": "Official FIR Document Scan 104/2026",
            "source_type": "fir",
            "description": "Initial complaint registered under Section 420 IPC"
        },
        files={"file": ("fir_report_104.txt", file_obj, "text/plain")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["source_type"] == "fir"
    assert "9876543210" in str(data["metadata_json"].get("detected_phone_numbers", []))
    assert data["quality_score"]["source_reliability_score"] == 0.90
    assert data["quality_score"]["overall_quality_score"] >= 0.70

def test_upload_synthetic_cdr_csv_file(client, test_case_setup):
    token, case_id = test_case_setup

    cdr_csv = """timestamp,caller_number,receiver_number,duration_sec,cell_tower_id
2026-08-25 10:14:00,9876543210,9123456780,184,TOWER_DEL_44
2026-08-25 11:20:15,9876543210,9988776655,45,TOWER_DEL_44
2026-08-25 14:05:30,9123456780,9876543210,320,TOWER_DEL_12"""

    file_obj = io.BytesIO(cdr_csv.encode("utf-8"))

    res = client.post(
        f"/api/v1/cases/{case_id}/evidence/upload",
        data={
            "title": "Telco Call Detail Records - Primary IMEI",
            "source_type": "cdr",
            "description": "Call records obtained via lawful interception warrant"
        },
        files={"file": ("cdr_dump_aug2026.csv", file_obj, "text/csv")},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["source_type"] == "cdr"
    assert data["metadata_json"]["format"] == "csv"
    assert data["metadata_json"]["row_count"] == 3
    assert data["quality_score"]["source_reliability_score"] == 0.85

def test_list_and_delete_evidence(client, test_case_setup):
    token, case_id = test_case_setup

    # Create 2 evidence items
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={"title": "Item 1", "source_type": "fir", "extracted_text": "Sample text for FIR"},
        headers={"Authorization": f"Bearer {token}"}
    )
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={"title": "Item 2", "source_type": "cctv", "extracted_text": "CCTV Footage description"},
        headers={"Authorization": f"Bearer {token}"}
    )

    # List evidence
    list_res = client.get(
        f"/api/v1/cases/{case_id}/evidence",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert list_res.status_code == 200
    evidence_items = list_res.json()
    assert len(evidence_items) == 2

    # Delete first evidence
    ev_id = evidence_items[0]["id"]
    del_res = client.delete(
        f"/api/v1/evidence/{ev_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert del_res.status_code == 200

    # Verify 404 after deletion
    get_res = client.get(
        f"/api/v1/evidence/{ev_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_res.status_code == 404
