import uuid
import pytest
from app.models.entity import Entity, EntityType, Relationship, RelationshipType
from app.services.entity_resolver import compute_entity_similarity

def test_similarity_computation_scenarios():
    # 1. Phone exact normalization match
    p1 = Entity(name="+91 9876543210", entity_type=EntityType.PHONE, canonical_name="+91-9876543210")
    p2 = Entity(name="09876543210", entity_type=EntityType.PHONE, canonical_name="09876543210")
    sim, reason = compute_entity_similarity(p1, p2)
    assert sim == 1.0
    assert "9876543210" in reason

    # 2. Vehicle plate match
    v1 = Entity(name="MH-12-AB-1234", entity_type=EntityType.VEHICLE, canonical_name="MH-12-AB-1234")
    v2 = Entity(name="MH12AB1234", entity_type=EntityType.VEHICLE, canonical_name="MH12AB1234")
    sim_v, _ = compute_entity_similarity(v1, v2)
    assert sim_v == 1.0

    # 3. Person Name abbreviation match
    pers1 = Entity(name="Vikram Malhotra", entity_type=EntityType.PERSON, canonical_name="Vikram Malhotra")
    pers2 = Entity(name="V. Malhotra", entity_type=EntityType.PERSON, canonical_name="V. Malhotra")
    sim_pers, _ = compute_entity_similarity(pers1, pers2)
    assert sim_pers >= 0.85

@pytest.fixture
def test_case_setup(client):
    unique_email = f"resolution.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "ResPass123!",
            "full_name": "Inspector Joshi",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "ResPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Entity Resolution Case {case_num}",
            "case_number": case_num,
            "priority": "critical"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    return token, case_id

def test_entity_resolution_candidates_and_merge(client, test_case_setup):
    token, case_id = test_case_setup

    # Create 2 entities with slight variations
    e1_res = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={
            "name": "Vikram Malhotra",
            "entity_type": "person",
            "canonical_name": "Vikram Malhotra",
            "confidence_score": 0.95,
            "attributes_json": {"role": "Prime Suspect"}
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    e1_id = e1_res.json()["id"]

    e2_res = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={
            "name": "V. Malhotra",
            "entity_type": "person",
            "canonical_name": "V. Malhotra",
            "confidence_score": 0.80,
            "attributes_json": {"alias": "Vic"}
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    e2_id = e2_res.json()["id"]

    # Create a third unrelated entity
    e3_res = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={
            "name": "Pooja Verma",
            "entity_type": "person",
            "canonical_name": "Pooja Verma",
            "confidence_score": 0.90
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    e3_id = e3_res.json()["id"]

    # Create relationship from e2 (secondary) to e3
    create_rel_res = client.post(
        f"/api/v1/cases/{case_id}/relationships",
        json={
            "source_entity_id": e2_id,
            "target_entity_id": e3_id,
            "relationship_type": "COMMUNICATED_WITH",
            "weight": 1.0,
            "confidence_score": 0.90
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_rel_res.status_code == 201

    # 1. Fetch duplicate candidates
    cand_res = client.get(
        f"/api/v1/cases/{case_id}/entity-resolution/candidates?threshold=0.75",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cand_res.status_code == 200
    candidates = cand_res.json()
    assert len(candidates) >= 1
    assert candidates[0]["similarity_score"] >= 0.85

    # 2. Merge e2 into e1
    merge_res = client.post(
        f"/api/v1/cases/{case_id}/entity-resolution/merge",
        json={
            "primary_entity_id": e1_id,
            "secondary_entity_ids": [e2_id]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert merge_res.status_code == 200
    merged_data = merge_res.json()
    assert merged_data["id"] == e1_id
    assert "V. Malhotra" in merged_data["attributes_json"]["alias_names"]

    # 3. Verify e2 was deleted
    e2_check = client.get(
        f"/api/v1/cases/{case_id}/entities",
        headers={"Authorization": f"Bearer {token}"}
    )
    remaining_ids = [e["id"] for e in e2_check.json()]
    assert e1_id in remaining_ids
    assert e2_id not in remaining_ids

    # 4. Verify relationship was rewired to e1
    rels_res = client.get(
        f"/api/v1/cases/{case_id}/relationships",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert rels_res.status_code == 200
    rels = rels_res.json()
    assert len(rels) == 1
    assert rels[0]["source_entity_id"] == e1_id
    assert rels[0]["target_entity_id"] == e3_id

def test_auto_resolve_duplicates(client, test_case_setup):
    token, case_id = test_case_setup

    # Create two duplicate phone numbers
    p1 = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={"name": "+91 9988776655", "entity_type": "phone", "confidence_score": 0.95},
        headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    p2 = client.post(
        f"/api/v1/cases/{case_id}/entities",
        json={"name": "09988776655", "entity_type": "phone", "confidence_score": 0.85},
        headers={"Authorization": f"Bearer {token}"}
    ).json()["id"]

    # Trigger auto-resolve
    auto_res = client.post(
        f"/api/v1/cases/{case_id}/entity-resolution/auto-resolve?threshold=0.85",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert auto_res.status_code == 200
    data = auto_res.json()
    assert data["resolved_pairs_count"] >= 1
