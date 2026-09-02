import uuid
import pytest
from app.models.entity import EntityType, RelationshipType
from app.models.evidence import EvidenceSourceType

@pytest.fixture
def graph_case_setup(client):
    unique_email = f"graph.officer.{uuid.uuid4().hex[:6]}@test.gov.in"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "GraphPass123!",
            "full_name": "Inspector Graph",
            "role": "investigator"
        }
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "GraphPass123!"}
    )
    token = login_res.json()["access_token"]

    case_num = f"FIR-2026-{uuid.uuid4().hex[:6].upper()}"
    case_res = client.post(
        "/api/v1/cases/",
        json={
            "title": f"Hawala Network Investigation {case_num}",
            "case_number": case_num,
            "priority": "critical"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    case_id = case_res.json()["id"]

    # 1. Add Evidence (FIR)
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "FIR 108/2026 Intercept",
            "source_type": "fir",
            "extracted_text": "Suspect Vikram Malhotra (+91-9876543210) transferred funds to Vikas Exports Ltd in New Delhi."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # 2. Add Evidence (Anonymous Tip with lower quality)
    client.post(
        f"/api/v1/cases/{case_id}/evidence",
        json={
            "title": "Anonymous Tip 409",
            "source_type": "anonymous_tip",
            "extracted_text": "Unverified tip regarding vehicle DL01AB1234 spotted near Connaught Place."
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    # 3. Create explicit relationship between Person (Vikram) and Organization (Vikas Exports)
    entities = client.get(f"/api/v1/cases/{case_id}/entities", headers={"Authorization": f"Bearer {token}"}).json()
    person_ent = next((e for e in entities if e["entity_type"] == "person"), None)
    org_ent = next((e for e in entities if e["entity_type"] == "organization"), None)

    if person_ent and org_ent:
        client.post(
            f"/api/v1/cases/{case_id}/relationships",
            json={
                "source_entity_id": person_ent["id"],
                "target_entity_id": org_ent["id"],
                "relationship_type": "TRANSFERRED_TO",
                "weight": 0.95,
                "confidence_score": 0.90
            },
            headers={"Authorization": f"Bearer {token}"}
        )

    return token, case_id

def test_case_graph_generation_and_mentions(client, graph_case_setup):
    token, case_id = graph_case_setup

    res = client.get(
        f"/api/v1/cases/{case_id}/graph",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    graph_data = res.json()

    nodes = graph_data["nodes"]
    edges = graph_data["edges"]

    assert len(nodes) >= 4  # Entities + Evidence nodes
    assert len(edges) >= 1  # Relationships + MENTIONED_IN edges

    node_types = {n["type"] for n in nodes}
    assert "evidence" in node_types
    assert "person" in node_types or "organization" in node_types

    edge_labels = {e["label"] for e in edges}
    assert "MENTIONED_IN" in edge_labels or "TRANSFERRED_TO" in edge_labels

def test_case_graph_filtering(client, graph_case_setup):
    token, case_id = graph_case_setup

    # 1. Filter by minimum quality score (exclude anonymous tip < 0.40)
    high_q_res = client.get(
        f"/api/v1/cases/{case_id}/graph?min_quality_score=0.60",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert high_q_res.status_code == 200
    evidence_nodes = [n for n in high_q_res.json()["nodes"] if n["type"] == "evidence"]
    for ev in evidence_nodes:
        assert ev["quality_score"] >= 0.60

def test_case_graph_statistics(client, graph_case_setup):
    token, case_id = graph_case_setup

    stats_res = client.get(
        f"/api/v1/cases/{case_id}/graph/stats",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert stats_res.status_code == 200
    stats = stats_res.json()

    assert "total_nodes" in stats
    assert "total_edges" in stats
    assert "density" in stats
    assert "node_counts_by_type" in stats
    assert stats["total_nodes"] >= 4

def test_neo4j_sync_endpoint(client, graph_case_setup):
    token, case_id = graph_case_setup

    sync_res = client.post(
        f"/api/v1/cases/{case_id}/graph/sync",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert sync_res.status_code == 200
    data = sync_res.json()
    assert data["status"] in ["synchronized", "offline_fallback"]
    assert "synced_nodes" in data
