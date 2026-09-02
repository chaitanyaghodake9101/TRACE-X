import pytest
from app.models.user import User, UserRole
from app.models.case import Case
from app.models.entity import Entity, EntityType, Relationship, RelationshipType
from app.models.evidence import Evidence, EvidenceSourceType, EvidenceQualityScore, IntegrityStatus
from app.models.hypothesis import Hypothesis, EvidenceHypothesis, HypothesisRelationType, HypothesisScore
from app.models.disagreement import DisagreementSignal, MinorityEvidenceItem, InvestigatorContestation
from app.services.hypothesis_engine import calculate_hypothesis_score
from app.services.disagreement_engine import scan_case_disagreements, record_investigator_contestation

def test_disagreement_engine_five_dimensions_and_contestation(db_session):
    # Setup
    user = User(email="disagreement.officer@delhipolice.gov.in", hashed_password="pw", full_name="Officer Rao", role=UserRole.INVESTIGATOR)
    db_session.add(user)
    db_session.commit()

    case = Case(case_number="FIR-2026-DIS-004", title="Conflict & Minority Signals Case", created_by=user.id)
    db_session.add(case)
    db_session.commit()

    # Dim 1: Ambiguous Entity (NER confidence 0.40, degree 3)
    e1 = Entity(case_id=case.id, name="Ambiguous Contact X", entity_type=EntityType.PERSON, confidence_score=0.40)
    e2 = Entity(case_id=case.id, name="Entity Y", entity_type=EntityType.ORGANIZATION)
    e3 = Entity(case_id=case.id, name="Entity Z", entity_type=EntityType.PHONE)
    e4 = Entity(case_id=case.id, name="Entity W", entity_type=EntityType.LOCATION)
    db_session.add_all([e1, e2, e3, e4])
    db_session.commit()

    db_session.add_all([
        Relationship(case_id=case.id, source_entity_id=e1.id, target_entity_id=e2.id, relationship_type=RelationshipType.CONNECTED_TO),
        Relationship(case_id=case.id, source_entity_id=e1.id, target_entity_id=e3.id, relationship_type=RelationshipType.CALLS),
        Relationship(case_id=case.id, source_entity_id=e1.id, target_entity_id=e4.id, relationship_type=RelationshipType.VISITED)
    ])
    db_session.commit()

    # Dim 2 & 3: High-quality testimonial contradictory evidence (Lone witness)
    ev_witness = Evidence(case_id=case.id, title="Whistleblower Eyewitness Testimony", source_type=EvidenceSourceType.WITNESS_STATEMENT, uploaded_by=user.id)
    db_session.add(ev_witness)
    db_session.commit()

    q_wit = EvidenceQualityScore(evidence_id=ev_witness.id, overall_quality_score=0.80, source_reliability_score=0.8, temporal_freshness_score=0.8, cross_corroboration_score=0.4, data_quality_score=0.8, explanation_json={})
    db_session.add(q_wit)
    db_session.commit()

    hyp = Hypothesis(case_id=case.id, title="Official Insider Fraud", created_by=user.id)
    db_session.add(hyp)
    db_session.commit()

    link_contra = EvidenceHypothesis(hypothesis_id=hyp.id, evidence_id=ev_witness.id, relationship_type=HypothesisRelationType.CONTRADICTS, linked_by=user.id)
    db_session.add(link_contra)
    db_session.commit()

    # Compute hypothesis score
    calculate_hypothesis_score(db_session, hyp.id)

    # Dim 4: Compromised supporting evidence
    ev_comp = Evidence(case_id=case.id, title="Tampered Log File", source_type=EvidenceSourceType.OTHER, integrity_status=IntegrityStatus.COMPROMISED, uploaded_by=user.id)
    db_session.add(ev_comp)
    db_session.commit()

    link_supp = EvidenceHypothesis(hypothesis_id=hyp.id, evidence_id=ev_comp.id, relationship_type=HypothesisRelationType.SUPPORTS, linked_by=user.id)
    db_session.add(link_supp)
    db_session.commit()

    # Execute Disagreement Scan
    scan_res = scan_case_disagreements(db_session, case.id)
    assert scan_res["total_signals"] >= 3
    assert scan_res["minority_evidence_count"] >= 1

    # Verify NLP vs Graph signal detected
    nlp_sig = next((s for s in scan_res["signals"] if s.dimension == "nlp_vs_graph"), None)
    assert nlp_sig is not None
    assert nlp_sig.primary_entity_id == e1.id

    # Verify Minority Evidence Item
    minority = scan_res["minority_evidence"][0]
    assert minority.evidence_id == ev_witness.id
    assert minority.outlier_category == "lone_witness"

    # Test Investigator Contestation
    contestation = record_investigator_contestation(
        db=db_session,
        signal_id=nlp_sig.id,
        officer_id=user.id,
        contest_action="override_confidence",
        justification="Officer personally verified phone subscriber registration in person.",
        adjusted_confidence=0.95
    )
    assert contestation.id is not None
    assert nlp_sig.is_resolved is True
    assert nlp_sig.resolved_by == user.id
