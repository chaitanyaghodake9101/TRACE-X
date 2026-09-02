import pytest
from app.models.user import User, UserRole
from app.models.case import Case
from app.models.entity import Entity, EntityType, Relationship, RelationshipType
from app.services.resilience_engine import run_resilience_test, run_monte_carlo_resilience

def test_resilience_analyzer_stability_classification(db_session):
    # Setup Case
    user = User(email="resilience.officer@delhipolice.gov.in", hashed_password="pw", full_name="Officer Verma", role=UserRole.INVESTIGATOR)
    db_session.add(user)
    db_session.commit()

    case = Case(case_number="FIR-2026-NET-002", title="Hawala Ring Graph", created_by=user.id)
    db_session.add(case)
    db_session.commit()

    # Create network topology: Key Hub (Kingpin) connected to 4 subordinates
    hub = Entity(case_id=case.id, name="Vikram (Hawala Boss)", entity_type=EntityType.PERSON)
    sub1 = Entity(case_id=case.id, name="Courier A", entity_type=EntityType.PERSON)
    sub2 = Entity(case_id=case.id, name="Accountant B", entity_type=EntityType.PERSON)
    sub3 = Entity(case_id=case.id, name="Shell Company C", entity_type=EntityType.ORGANIZATION)
    sub4 = Entity(case_id=case.id, name="Trader D", entity_type=EntityType.PERSON)
    db_session.add_all([hub, sub1, sub2, sub3, sub4])
    db_session.commit()

    # Edges: Hub connects all 4 subordinates (Star topology where Hub is SPOF)
    r1 = Relationship(case_id=case.id, source_entity_id=hub.id, target_entity_id=sub1.id, relationship_type=RelationshipType.COMMUNICATED_WITH)
    r2 = Relationship(case_id=case.id, source_entity_id=hub.id, target_entity_id=sub2.id, relationship_type=RelationshipType.CONNECTED_TO)
    r3 = Relationship(case_id=case.id, source_entity_id=hub.id, target_entity_id=sub3.id, relationship_type=RelationshipType.OWNS)
    r4 = Relationship(case_id=case.id, source_entity_id=hub.id, target_entity_id=sub4.id, relationship_type=RelationshipType.TRANSFERRED_TO)
    db_session.add_all([r1, r2, r3, r4])
    db_session.commit()

    # Execute targeted resilience test removing the Hub
    result = run_resilience_test(
        db=db_session,
        case_id=case.id,
        user_id=user.id,
        test_type="node_removal",
        target_entity_ids=[hub.id]
    )

    assert result["run_id"] is not None
    assert result["fragile_count"] >= 1
    assert result["fragmentation_index"] > 0.5 # Entire network fragmented upon Hub removal

    # Check that Vikram is classified as FRAGILE & SPOF
    hub_metric = next((m for m in result["node_metrics"] if m["entity_id"] == hub.id), None)
    assert hub_metric is not None
    assert hub_metric["stability_classification"] == "FRAGILE"

    # Execute Monte Carlo test with seed
    mc_res = run_monte_carlo_resilience(
        db=db_session,
        case_id=case.id,
        seed=12345,
        iterations=30,
        perturbation_rate=0.20
    )
    assert mc_res["id"] is not None
    assert mc_res["seed"] == 12345
    assert len(mc_res["critical_bridges_json"]) >= 1
    assert mc_res["critical_bridges_json"][0]["entity_id"] == hub.id
