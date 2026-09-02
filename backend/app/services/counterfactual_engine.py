import uuid
import math
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.hypothesis import (
    Hypothesis,
    EvidenceHypothesis,
    HypothesisScore,
    HypothesisRelationType,
    HypothesisConfidenceLevel
)
from app.models.evidence import Evidence, EvidenceQualityScore, IntegrityStatus
from app.models.simulation import (
    SimulationBranch,
    SimulationEvidenceOverride,
    SimulationHypothesisDelta,
    SimulationReviewRequest
)
from app.services.hypothesis_engine import ALPHA, CONTRADICTION_PENALTY

def evaluate_simulation_branch(db: Session, branch_id: str) -> Dict[str, Any]:
    """
    Executes a counterfactual simulation run for a branch.
    Guarantees strict isolation from official case tables.
    Re-evaluates Heuer ACH hypotheses against overridden/synthetic evidence states.
    """
    branch = db.query(SimulationBranch).filter(SimulationBranch.id == branch_id).first()
    if not branch:
        raise ValueError(f"Simulation branch {branch_id} not found")

    case_id = branch.case_id
    overrides = db.query(SimulationEvidenceOverride).filter(SimulationEvidenceOverride.branch_id == branch_id).all()
    
    # Map overrides by evidence_id
    excluded_evidence_ids = {o.evidence_id for o in overrides if o.is_excluded and o.evidence_id}
    quality_overrides = {o.evidence_id: o.overridden_quality_score for o in overrides if o.overridden_quality_score is not None and o.evidence_id}
    hypothetical_overrides = [o for o in overrides if o.is_hypothetical]

    # Fetch official hypotheses and scores
    hypotheses = db.query(Hypothesis).filter(Hypothesis.case_id == case_id).all()
    official_scores = {
        s.hypothesis_id: s
        for s in db.query(HypothesisScore).join(Hypothesis, Hypothesis.id == HypothesisScore.hypothesis_id).filter(Hypothesis.case_id == case_id).all()
    }

    # Fetch baseline evidence quality scores
    base_evidence = {e.id: e for e in db.query(Evidence).filter(Evidence.case_id == case_id).all()}
    base_qualities = {
        s.evidence_id: s.overall_quality_score
        for s in db.query(EvidenceQualityScore).join(Evidence, Evidence.id == EvidenceQualityScore.evidence_id).filter(Evidence.case_id == case_id).all()
    }

    # Fetch all evidence-hypothesis links
    links = db.query(EvidenceHypothesis).join(Hypothesis, Hypothesis.id == EvidenceHypothesis.hypothesis_id).filter(Hypothesis.case_id == case_id).all()
    links_by_hyp: Dict[str, List[EvidenceHypothesis]] = {}
    for l in links:
        if l.hypothesis_id not in links_by_hyp:
            links_by_hyp[l.hypothesis_id] = []
        links_by_hyp[l.hypothesis_id].append(l)

    # Delete prior deltas for fresh calculation
    db.query(SimulationHypothesisDelta).filter(SimulationHypothesisDelta.branch_id == branch_id).delete()

    deltas_result: List[Dict[str, Any]] = []
    significant_shifts: List[Dict[str, Any]] = []

    for hyp in hypotheses:
        hyp_links = links_by_hyp.get(hyp.id, [])
        sim_support = 0.0
        sim_contradict = 0.0

        for link in hyp_links:
            ev_id = link.evidence_id
            # 1. Check if excluded in this what-if scenario
            if ev_id in excluded_evidence_ids:
                continue

            # 2. Get quality score (overridden or baseline)
            if ev_id in quality_overrides:
                q_val = quality_overrides[ev_id]
            else:
                q_val = base_qualities.get(ev_id, 0.50)

            w_val = link.relationship_strength if link.relationship_strength is not None else 1.0
            weighted_val = q_val * w_val

            if link.relationship_type == HypothesisRelationType.SUPPORTS:
                sim_support += weighted_val
            elif link.relationship_type == HypothesisRelationType.CONTRADICTS:
                sim_contradict += weighted_val

        # Process hypothetical evidence (if any notes indicate linkage)
        for hyp_override in hypothetical_overrides:
            q_val = hyp_override.overridden_quality_score or 0.60
            if hyp_override.notes and hyp.title.lower() in hyp_override.notes.lower():
                sim_support += q_val

        # Compute simulated raw and normalized scores
        sim_raw = round(sim_support - (CONTRADICTION_PENALTY * sim_contradict), 3)
        sim_normalized = round(1.0 / (1.0 + math.exp(-ALPHA * sim_raw)), 3)

        if sim_normalized >= 0.70:
            sim_conf = "high"
        elif sim_normalized >= 0.40:
            sim_conf = "medium"
        else:
            sim_conf = "low"

        # Official score baseline
        off_score = official_scores.get(hyp.id)
        orig_norm = off_score.normalized_score if off_score else 0.50
        orig_conf = off_score.confidence_level.value if off_score else "medium"

        delta = round(sim_normalized - orig_norm, 3)

        rationale = f"Simulated likelihood changed by {round(delta * 100, 1)}% based on {len(overrides)} evidentiary what-if adjustments."
        if abs(delta) >= 0.15:
            rationale += " [CRITICAL SENSITIVITY DETECTED: Hypothesis conclusions heavily dependent on perturbed evidence]"
            significant_shifts.append({
                "hypothesis_id": hyp.id,
                "hypothesis_title": hyp.title,
                "delta": delta,
                "direction": "increased" if delta > 0 else "decreased",
                "original_score": orig_norm,
                "simulated_score": sim_normalized
            })

        delta_id = str(uuid.uuid4())
        delta_record = SimulationHypothesisDelta(
            id=delta_id,
            branch_id=branch_id,
            hypothesis_id=hyp.id,
            original_normalized_score=orig_norm,
            simulated_normalized_score=sim_normalized,
            delta_score=delta,
            original_confidence_level=orig_conf,
            simulated_confidence_level=sim_conf,
            diagnostic_rationale=rationale,
            calculated_at=datetime.utcnow()
        )
        db.add(delta_record)

        deltas_result.append({
            "id": delta_id,
            "hypothesis_id": hyp.id,
            "hypothesis_title": hyp.title,
            "original_normalized_score": orig_norm,
            "simulated_normalized_score": sim_normalized,
            "delta_score": delta,
            "original_confidence_level": orig_conf,
            "simulated_confidence_level": sim_conf,
            "diagnostic_rationale": rationale,
            "calculated_at": delta_record.calculated_at
        })

    db.commit()

    return {
        "branch_id": branch.id,
        "branch_name": branch.name,
        "case_id": case_id,
        "total_overrides": len(overrides),
        "hypothesis_deltas": deltas_result,
        "significant_shifts": significant_shifts,
        "summary": f"Evaluated {len(hypotheses)} hypotheses across {len(overrides)} what-if overrides. {len(significant_shifts)} hypotheses displayed high sensitivity."
    }

def create_simulation_branch(db: Session, case_id: str, name: str, description: Optional[str], user_id: str) -> SimulationBranch:
    """Creates a new sandboxed counterfactual branch."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    branch = SimulationBranch(
        case_id=case_id,
        name=name,
        description=description,
        created_by=user_id,
        status="active"
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch

def add_evidence_override(
    db: Session,
    branch_id: str,
    evidence_id: Optional[str],
    is_excluded: bool,
    overridden_quality_score: Optional[float],
    overridden_reliability: Optional[float],
    is_hypothetical: bool,
    hypothetical_title: Optional[str],
    hypothetical_source_type: Optional[str],
    notes: Optional[str]
) -> SimulationEvidenceOverride:
    """Adds or updates an evidence override within a simulation branch."""
    branch = db.query(SimulationBranch).filter(SimulationBranch.id == branch_id).first()
    if not branch:
        raise ValueError(f"Simulation branch {branch_id} not found")

    override = SimulationEvidenceOverride(
        branch_id=branch_id,
        evidence_id=evidence_id,
        is_excluded=is_excluded,
        overridden_quality_score=overridden_quality_score,
        overridden_reliability=overridden_reliability,
        is_hypothetical=is_hypothetical,
        hypothetical_title=hypothetical_title,
        hypothetical_source_type=hypothetical_source_type,
        notes=notes
    )
    db.add(override)
    db.commit()
    db.refresh(override)

    # Automatically re-evaluate branch
    evaluate_simulation_branch(db, branch_id)
    return override
