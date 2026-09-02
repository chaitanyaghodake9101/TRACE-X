import uuid
import pytest
from app.services.ner_service import extract_entities_from_text
from app.models.entity import EntityType

def test_ner_service_entity_types():
    sample_text = """
    FIR No. 201/2026 registered at Connaught Place Police Station, New Delhi.
    Complainant states that suspect Vikram Malhotra (+91-9876543210) met with accused Rajesh Sharma
    outside HDFC Bank near IGI Airport.
    Suspect transferred Rs. 50,00,000 to Vikas Exports Ltd.
    They fled in vehicle MH-12-DE-9876 towards Mumbai.
    """

    entities = extract_entities_from_text(sample_text)
    entity_types = {e["entity_type"] for e in entities}
    names = {e["name"] for e in entities}
    canonicals = {e["canonical_name"] for e in entities}

    # Verify all 6 entity types are detected
    assert EntityType.PHONE in entity_types
    assert EntityType.VEHICLE in entity_types
    assert EntityType.LOCATION in entity_types
    assert EntityType.ORGANIZATION in entity_types
    assert EntityType.PERSON in entity_types
    assert EntityType.EVENT in entity_types

    # Specific checks
    assert "+91-9876543210" in canonicals
    assert "MH-12-DE-9876" in canonicals or "MH12DE9876" in canonicals
    assert "Connaught Place" in names
    assert "HDFC Bank" in names
    assert "Vikram Malhotra" in names

@pytest.fixture
def test_case_setup(client):
    unique_email = f"ner.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "NerPass123!",
            "full_name": "Inspector Deshmukh",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "NerPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"NER Investigation Case {case_num}",
            "case_number": case_num,
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    return token, case_id

def test_evidence_auto_populates_entities(client, test_case_setup):
    token, case_id = test_case_setup

    # Ingest evidence with rich entities
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Intercept Log Transcript",
            "source_type": "fir",
            "extracted_text": "Suspect Vikas Patel using mobile 9123456780 contacted Pooja Verma in Pune regarding State Bank of India transfer."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # Check that entities table was auto-populated
    entities_res = client.get(
        f"/api/v1/cases/{case_id}/entities",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert entities_res.status_code == 200
    entities = entities_res.json()
    assert len(entities) >= 3

    canonicals = [e["canonical_name"] for e in entities]
    assert "+91-9123456780" in canonicals
    assert "Pune" in canonicals
    assert "State Bank of India" in canonicals

def test_batch_ner_extraction_and_entity_deletion(client, test_case_setup):
    token, case_id = test_case_setup

    # Add evidence
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Field Surveillance Report",
            "source_type": "witness_statement",
            "extracted_text": "Sighted vehicle DL01AB1234 parked near Bandra station in Mumbai."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # Batch extraction trigger
    batch_res = client.post(
        f"/api/v1/cases/{case_id}/extract-entities",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert batch_res.status_code == 200
    entities = batch_res.json()
    assert len(entities) >= 2

    # Delete an entity
    ent_id = entities[0]["id"]
    del_res = client.delete(
        f"/api/v1/entities/{ent_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert del_res.status_code == 200

    # Filter by entity type
    loc_res = client.get(
        f"/api/v1/cases/{case_id}/entities?entity_type=location",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert loc_res.status_code == 200
    for e in loc_res.json():
        assert e["entity_type"] == "location"
