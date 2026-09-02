import uuid
import pytest

@pytest.fixture
def report_test_case(client):
    unique_email = f"report.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "ReportPass123!",
            "full_name": "Auditor Report",
            "role": "senior_investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "ReportPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Dossier Export Investigation {case_num}",
            "case_number": case_num,
            "priority": "high",
            "description": "Formal investigation for comprehensive PDF dossier generation."
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    # Ingest Evidence
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "FIR Bank Intercept",
            "source_type": "fir",
            "extracted_text": "Suspect Vikram transferred funds."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # Ingest Hypothesis
    client.post(
        f"/api/v1/cases/{case_id}/hypotheses",
        json={"title": "H1: Syndicate Primary Lead", "status": "active"},
        headers={"Authorization": f"Bearer {token}"}
    )

    # Ingest Action
    client.post(
        f"/api/v1/cases/{case_id}/actions",
        json={"title": "Subpoena Bank Ledger", "action_type": "obtain_financial_records"},
        headers={"Authorization": f"Bearer {token}"}
    )

    return token, case_id

def test_export_case_pdf_dossier(client, report_test_case):
    token, case_id = report_test_case

    res = client.post(
        f"/api/v1/cases/{case_id}/reports",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in res.headers.get("content-disposition", "")
    assert len(res.content) > 500
    # PDF magic byte signature
    assert res.content.startswith(b"%PDF-")

def test_get_case_audit_logs(client, report_test_case):
    token, case_id = report_test_case

    res = client.get(
        f"/api/v1/cases/{case_id}/audit-logs",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) >= 3  # Case creation, evidence upload, hypothesis creation, action creation
    actions_logged = {l["action"] for l in logs}
    assert "CREATE_CASE" in actions_logged or "INGEST_EVIDENCE" in actions_logged
