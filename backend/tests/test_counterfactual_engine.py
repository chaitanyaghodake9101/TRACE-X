import pytest
from app.models.user import User, UserRole
from app.models.case import Case
from app.models.evidence import Evidence, EvidenceSourceType, EvidenceQualityScore, IntegrityStatus
from app.models.hypothesis import Hypothesis, EvidenceHypothesis, HypothesisRelationType, HypothesisScore
from app.models.simulation import SimulationBranch, SimulationEvidenceOverride, SimulationHypothesisDelta
from app.services.hypothesis_engine import calculate_hypothesis_score
from app.services.counterfactual_engine import (
    create_simulation_branch,
    add_evidence_override,
    evaluate_simulation_branch
)

def test_counterfactual_sandbox_isolation_and_delta(db_session):
    # 1. Setup User and Case
    user = User(email="investigator.cf@delhipolice.gov.in", hashed_password="pw", full_name="Officer Sharma", role=UserRole.SENIOR_INVESTIGATOR)
    db_session.add(user)
    db_session.commit()

    case = Case(case_number="FIR-2026-SIM-001", title="Simulated Smuggling Case", created_by=user.id)
    db_session.add(case)
    db_session.commit()

    # 2. Setup Evidence
    ev1 = Evidence(case_id=case.id, title="CDR Intercept Logs", source_type=EvidenceSourceType.CDR, uploaded_by=user.id)
    ev2 = Evidence(case_id=case.id, title="CCTV Footage Entry", source_type=EvidenceSourceType.CCTV, uploaded_by=user.id)
    db_session.add_all([ev1, ev2])
    db_session.commit()

    q1 = EvidenceQualityScore(evidence_id=ev1.id, overall_quality_score=0.85, source_reliability_score=0.85, temporal_freshness_score=0.9, cross_corroboration_score=0.8, data_quality_score=0.9, explanation_json={})
    q2 = EvidenceQualityScore(evidence_id=ev2.id, overall_quality_score=0.75, source_reliability_score=0.75, temporal_freshness_score=0.8, cross_corroboration_score=0.7, data_quality_score=0.8, explanation_json={})
    db_session.add_all([q1, q2])
    db_session.commit()

    # 3. Setup Hypothesis with evidence links
    hyp = Hypothesis(case_id=case.id, title="Suspect Organized Hawala Channel", created_by=user.id)
    db_session.add(hyp)
    db_session.commit()

    link1 = EvidenceHypothesis(hypothesis_id=hyp.id, evidence_id=ev1.id, relationship_type=HypothesisRelationType.SUPPORTS, relationship_strength=1.0, linked_by=user.id)
    link2 = EvidenceHypothesis(hypothesis_id=hyp.id, evidence_id=ev2.id, relationship_type=HypothesisRelationType.CONTRADICTS, relationship_strength=0.8, linked_by=user.id)
    db_session.add_all([link1, link2])
    db_session.commit()

    # Compute official baseline score
    official_score = calculate_hypothesis_score(db_session, hyp.id)
    baseline_norm = official_score["normalized_score"]

    # 4. Create Sandboxed Simulation Branch
    branch = create_simulation_branch(db_session, case.id, "What-If CDR Is Inadmissible", "Testing theory without CDR", user.id)
    assert branch.id is not None
    assert branch.status == "active"

    # 5. Add override: Exclude ev1 (CDR logs)
    override = add_evidence_override(
        db=db_session,
        branch_id=branch.id,
        evidence_id=ev1.id,
        is_excluded=True,
        overridden_quality_score=None,
        overridden_reliability=None,
        is_hypothetical=False,
        hypothetical_title=None,
        hypothetical_source_type=None,
        notes="Exclude CDR from scenario"
    )
    assert override.id is not None

    # 6. Evaluate branch
    eval_result = evaluate_simulation_branch(db_session, branch.id)
    assert eval_result["total_overrides"] == 1
    assert len(eval_result["hypothesis_deltas"]) == 1

    sim_delta = eval_result["hypothesis_deltas"][0]
    assert sim_delta["hypothesis_id"] == hyp.id
    # Without supporting CDR, the contradiction CCTV causes simulated likelihood to drop significantly
    assert sim_delta["simulated_normalized_score"] < baseline_norm
    assert sim_delta["delta_score"] < 0.0

    # 7. CRITICAL ISOLATION ASSERTION: Official case hypothesis score MUST remain unaltered!
    db_session.refresh(hyp)
    official_rec = db_session.query(HypothesisScore).filter(HypothesisScore.hypothesis_id == hyp.id).first()
    assert official_rec.normalized_score == baseline_norm, "Strict isolation violated! Official case hypothesis mutated."
