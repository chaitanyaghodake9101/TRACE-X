import math
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.hypothesis import (
    Hypothesis,
    EvidenceHypothesis,
    HypothesisScore,
    HypothesisRelationType,
    HypothesisConfidenceLevel
)
from app.models.evidence import Evidence, EvidenceQualityScore, IntegrityStatus

# Sigmoid scaling factor for likelihood calibration
ALPHA = 1.2
# Heuer ACH Contradiction Diagnostic Multiplier (contradictions are 1.5x more diagnostic)
CONTRADICTION_PENALTY = 1.5

def calculate_hypothesis_score(db: Session, hypothesis_id: str) -> Dict[str, Any]:
    """
    Computes the calibrated likelihood and diagnostic score for a hypothesis:
    Support(H) = sum_{e in Supports} Q(e) * w(e, H)
    Contradict(H) = sum_{e in Contradicts} Q(e) * w(e, H)
    RawScore(H) = Support(H) - 1.5 * Contradict(H)
    NormalizedScore(H) = 1 / (1 + exp(-1.2 * RawScore(H)))
    """
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise ValueError(f"Hypothesis {hypothesis_id} not found")

    links = db.query(EvidenceHypothesis).filter(EvidenceHypothesis.hypothesis_id == hypothesis_id).all()

    evidence_ids = [l.evidence_id for l in links]
    evidence_items = {
        e.id: e for e in db.query(Evidence).filter(Evidence.id.in_(evidence_ids)).all()
    }
    quality_scores = {
        s.evidence_id: s.overall_quality_score
        for s in db.query(EvidenceQualityScore).filter(EvidenceQualityScore.evidence_id.in_(evidence_ids)).all()
    }

    support_score = 0.0
    contradiction_score = 0.0
    supp_count = 0
    contra_count = 0
    integrity_warnings = []

    for link in links:
        ev = evidence_items.get(link.evidence_id)
        if ev and ev.integrity_status == IntegrityStatus.COMPROMISED:
            integrity_warnings.append({
                "evidence_id": ev.id,
                "evidence_title": ev.title,
                "warning": "Linked evidence has failed cryptographic verification (COMPROMISED)."
            })

        q = quality_scores.get(link.evidence_id, 0.50)
        w = link.relationship_strength if link.relationship_strength is not None else 1.0
        weighted_val = q * w

        if link.relationship_type == HypothesisRelationType.SUPPORTS:
            support_score += weighted_val
            supp_count += 1
        elif link.relationship_type == HypothesisRelationType.CONTRADICTS:
            contradiction_score += weighted_val
            contra_count += 1

    support_score = round(support_score, 3)
    contradiction_score = round(contradiction_score, 3)

    # Net Raw Score with 1.5x contradiction diagnostic penalty
    raw_score = round(support_score - (CONTRADICTION_PENALTY * contradiction_score), 3)

    # Sigmoid calibration: 1 / (1 + exp(-alpha * raw_score))
    normalized_score = round(1.0 / (1.0 + math.exp(-ALPHA * raw_score)), 3)

    # Confidence level assignment
    if normalized_score >= 0.70:
        conf_level = HypothesisConfidenceLevel.HIGH
    elif normalized_score >= 0.40:
        conf_level = HypothesisConfidenceLevel.MEDIUM
    else:
        conf_level = HypothesisConfidenceLevel.LOW

    # Update or insert HypothesisScore
    score_record = db.query(HypothesisScore).filter(HypothesisScore.hypothesis_id == hypothesis_id).first()
    if score_record:
        score_record.raw_score = raw_score
        score_record.normalized_score = normalized_score
        score_record.confidence_level = conf_level
        score_record.supporting_count = supp_count
        score_record.contradicting_count = contra_count
        score_record.supporting_weight_sum = support_score
        score_record.contradicting_weight_sum = contradiction_score
        score_record.calculated_at = datetime.utcnow()
    else:
        score_record = HypothesisScore(
            hypothesis_id=hypothesis_id,
            raw_score=raw_score,
            normalized_score=normalized_score,
            confidence_level=conf_level,
            supporting_count=supp_count,
            contradicting_count=contra_count,
            supporting_weight_sum=support_score,
            contradicting_weight_sum=contradiction_score,
            calculated_at=datetime.utcnow()
        )
        db.add(score_record)

    db.commit()

    return {
        "hypothesis_id": hypothesis_id,
        "raw_score": raw_score,
        "normalized_score": normalized_score,
        "confidence_level": conf_level.value,
        "supporting_count": supp_count,
        "contradicting_count": contra_count,
        "supporting_weight_sum": support_score,
        "contradicting_weight_sum": contradiction_score,
        "contradiction_penalty_factor": CONTRADICTION_PENALTY,
        "alpha_calibration": ALPHA,
        "integrity_warnings": integrity_warnings
    }

def recalculate_case_hypotheses(db: Session, case_id: str) -> List[Dict[str, Any]]:
    """
    Recalculates all hypotheses for a given case.
    """
    hypotheses = db.query(Hypothesis).filter(Hypothesis.case_id == case_id).all()
    results = []
    for h in hypotheses:
        results.append(calculate_hypothesis_score(db, h.id))
    return results

def compare_hypotheses(db: Session, h1_id: str, h2_id: str) -> Dict[str, Any]:
    """
    Conducts side-by-side Analysis of Competing Hypotheses (ACH) comparison between H1 and H2.
    Identifies high-diagnostic evidence and integrity warnings.
    """
    h1 = db.query(Hypothesis).filter(Hypothesis.id == h1_id).first()
    h2 = db.query(Hypothesis).filter(Hypothesis.id == h2_id).first()
    if not h1 or not h2:
        raise ValueError("One or both hypotheses not found")

    h1_score = calculate_hypothesis_score(db, h1_id)
    h2_score = calculate_hypothesis_score(db, h2_id)

    h1_links = {l.evidence_id: l for l in db.query(EvidenceHypothesis).filter(EvidenceHypothesis.hypothesis_id == h1_id).all()}
    h2_links = {l.evidence_id: l for l in db.query(EvidenceHypothesis).filter(EvidenceHypothesis.hypothesis_id == h2_id).all()}

    all_evidence_ids = set(h1_links.keys()) | set(h2_links.keys())
    evidence_items = {e.id: e for e in db.query(Evidence).filter(Evidence.id.in_(all_evidence_ids)).all()}
    quality_scores = {
        s.evidence_id: s.overall_quality_score
        for s in db.query(EvidenceQualityScore).filter(EvidenceQualityScore.evidence_id.in_(all_evidence_ids)).all()
    }

    comparison_matrix = []
    diagnostic_evidence = []
    integrity_warnings = []

    for ev_id in all_evidence_ids:
        ev = evidence_items.get(ev_id)
        if not ev:
            continue

        if ev.integrity_status == IntegrityStatus.COMPROMISED:
            integrity_warnings.append({
                "evidence_id": ev.id,
                "evidence_title": ev.title,
                "warning": "Compromised evidence used in hypothesis evaluation."
            })

        l1 = h1_links.get(ev_id)
        l2 = h2_links.get(ev_id)

        rel1 = l1.relationship_type.value if l1 else "unlinked"
        rel2 = l2.relationship_type.value if l2 else "unlinked"
        q_score = quality_scores.get(ev_id, 0.50)

        is_diagnostic = (
            (rel1 == "supports" and rel2 == "contradicts") or
            (rel1 == "contradicts" and rel2 == "supports") or
            (rel1 != rel2 and (rel1 in ["supports", "contradicts"] or rel2 in ["supports", "contradicts"]))
        )

        item_row = {
            "evidence_id": ev_id,
            "evidence_title": ev.title,
            "source_type": ev.source_type.value,
            "quality_score": q_score,
            "integrity_status": ev.integrity_status.value,
            "h1_relationship": rel1,
            "h2_relationship": rel2,
            "is_diagnostic": is_diagnostic
        }

        comparison_matrix.append(item_row)
        if is_diagnostic:
            diagnostic_evidence.append(item_row)

    score_delta = round(h1_score["normalized_score"] - h2_score["normalized_score"], 3)
    leading_id = h1.id if score_delta >= 0 else h2.id

    return {
        "hypothesis_1": {
            "id": h1.id,
            "title": h1.title,
            "scores": h1_score
        },
        "hypothesis_2": {
            "id": h2.id,
            "title": h2.title,
            "scores": h2_score
        },
        "score_delta": score_delta,
        "leading_hypothesis_id": leading_id,
        "diagnostic_evidence_count": len(diagnostic_evidence),
        "total_evaluated_evidence": len(comparison_matrix),
        "integrity_warnings": integrity_warnings,
        "comparison_matrix": comparison_matrix
    }
