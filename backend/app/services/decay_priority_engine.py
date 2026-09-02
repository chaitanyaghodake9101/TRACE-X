import math
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.evidence import Evidence, EvidenceQualityScore, IntegrityStatus, EvidenceSourceType
from app.models.hypothesis import EvidenceHypothesis
from app.models.review_priority import ReviewPriorityScore, ReviewTask, ReviewActionLog

# Volatility profile table (RFC 3227 & NIST SP 800-86 aligned)
VOLATILITY_WEIGHTS = {
    EvidenceSourceType.CCTV: 0.90,
    EvidenceSourceType.CDR: 0.70,
    EvidenceSourceType.FINANCIAL_RECORDS: 0.45,
    EvidenceSourceType.WITNESS_STATEMENT: 0.50,
    EvidenceSourceType.ANONYMOUS_TIP: 0.80,
    EvidenceSourceType.FIR: 0.20,
    EvidenceSourceType.OTHER: 0.50
}

# 30-day decay constant lambda
LAMBDA_DECAY = 0.0231

def calculate_evidence_review_urgency(db: Session, evidence_id: str) -> Dict[str, Any]:
    """
    Computes 5-factor Evidence Review Urgency Score U(e).
    U(e) = 0.25*T + 0.30*I + 0.15*V + 0.20*D + 0.10*C
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise ValueError(f"Evidence {evidence_id} not found")

    quality_score = db.query(EvidenceQualityScore).filter(EvidenceQualityScore.evidence_id == evidence_id).first()

    # 1. Temporal Urgency (Aging risk)
    days_old = (datetime.utcnow() - evidence.created_at).total_seconds() / 86400.0
    if evidence.event_timestamp:
        days_old = max(days_old, (datetime.utcnow() - evidence.event_timestamp).total_seconds() / 86400.0)
    temporal_urgency = round(min(1.0, 1.0 - math.exp(-LAMBDA_DECAY * days_old)), 3)

    # 2. Integrity Urgency (Critical boost if compromised or unverified)
    if evidence.integrity_status == IntegrityStatus.COMPROMISED:
        integrity_urgency = 1.0
    elif evidence.integrity_status == IntegrityStatus.UNVERIFIED:
        integrity_urgency = 0.6
    else:
        integrity_urgency = 0.0

    # 3. Volatility Score
    volatility = VOLATILITY_WEIGHTS.get(evidence.source_type, 0.50)

    # 4. Downstream Evidentiary Impact
    hyp_link_count = db.query(EvidenceHypothesis).filter(EvidenceHypothesis.evidence_id == evidence_id).count()
    downstream_impact = round(min(1.0, 0.20 + (0.25 * hyp_link_count)), 3)

    # 5. Corroboration Deficit
    corrob_score = quality_score.cross_corroboration_score if quality_score else 0.30
    corroboration_deficit = round(1.0 - corrob_score, 3)

    # Composite Urgency Calculation
    composite = round(
        (0.25 * temporal_urgency) +
        (0.30 * integrity_urgency) +
        (0.15 * volatility) +
        (0.20 * downstream_impact) +
        (0.10 * corroboration_deficit),
        3
    )

    # Suggested Review Tier (Non-legal administrative priority)
    if composite >= 0.70 or integrity_urgency == 1.0:
        tier = "P0_CRITICAL"
    elif composite >= 0.40:
        tier = "P1_HIGH"
    else:
        tier = "P2_ROUTINE"

    explanation = {
        "days_elapsed": round(days_old, 1),
        "temporal_urgency_factor": temporal_urgency,
        "integrity_status": evidence.integrity_status.value,
        "integrity_urgency_factor": integrity_urgency,
        "volatility_factor": volatility,
        "downstream_hypotheses_impacted": hyp_link_count,
        "downstream_impact_factor": downstream_impact,
        "corroboration_deficit_factor": corroboration_deficit,
        "suggested_review_wording": "Suggested review priority / Requires investigator assessment"
    }

    # Persist or update ReviewPriorityScore
    score_rec = db.query(ReviewPriorityScore).filter(ReviewPriorityScore.evidence_id == evidence_id).first()
    if score_rec:
        score_rec.temporal_urgency_score = temporal_urgency
        score_rec.integrity_urgency_score = integrity_urgency
        score_rec.volatility_score = volatility
        score_rec.downstream_impact_score = downstream_impact
        score_rec.corroboration_deficit_score = corroboration_deficit
        score_rec.composite_urgency_score = composite
        score_rec.suggested_review_tier = tier
        score_rec.explanation_json = explanation
        score_rec.calculated_at = datetime.utcnow()
    else:
        score_rec = ReviewPriorityScore(
            evidence_id=evidence_id,
            case_id=evidence.case_id,
            temporal_urgency_score=temporal_urgency,
            integrity_urgency_score=integrity_urgency,
            volatility_score=volatility,
            downstream_impact_score=downstream_impact,
            corroboration_deficit_score=corroboration_deficit,
            composite_urgency_score=composite,
            suggested_review_tier=tier,
            explanation_json=explanation,
            calculated_at=datetime.utcnow()
        )
        db.add(score_rec)
    
    db.commit()

    return {
        "evidence_id": evidence_id,
        "case_id": evidence.case_id,
        "evidence_title": evidence.title,
        "source_type": evidence.source_type.value,
        "composite_urgency_score": composite,
        "suggested_review_tier": tier,
        "temporal_urgency": temporal_urgency,
        "integrity_urgency": integrity_urgency,
        "volatility": volatility,
        "downstream_impact": downstream_impact,
        "corroboration_deficit": corroboration_deficit,
        "explanation": explanation
    }

def recalculate_case_review_priorities(db: Session, case_id: str) -> List[Dict[str, Any]]:
    """
    Recalculates review priorities for all evidence items in a case and auto-syncs review tasks.
    """
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    results = []
    
    for ev in evidence_items:
        res = calculate_evidence_review_urgency(db, ev.id)
        results.append(res)

        # Auto-create or update P0/P1 ReviewTask if none exists
        if res["suggested_review_tier"] in ["P0_CRITICAL", "P1_HIGH"]:
            existing_task = db.query(ReviewTask).filter(
                ReviewTask.evidence_id == ev.id,
                ReviewTask.status.in_(["pending", "in_review"])
            ).first()
            if not existing_task:
                task_priority = "P0" if res["suggested_review_tier"] == "P0_CRITICAL" else "P1"
                due_in_days = 2 if task_priority == "P0" else 7
                new_task = ReviewTask(
                    case_id=case_id,
                    evidence_id=ev.id,
                    title=f"Review & Re-verify: {ev.title}",
                    description=f"Automated priority task triggered by {res['suggested_review_tier']} urgency score ({res['composite_urgency_score']}).",
                    priority=task_priority,
                    status="pending",
                    due_date=datetime.utcnow() + timedelta(days=due_in_days),
                    created_at=datetime.utcnow()
                )
                db.add(new_task)
                db.commit()

    results.sort(key=lambda x: x["composite_urgency_score"], reverse=True)
    return results

def log_review_action(
    db: Session,
    task_id: str,
    action_taken: str,
    performed_by: str,
    notes: Optional[str] = None,
    new_status: Optional[str] = None
) -> ReviewActionLog:
    """
    Logs an investigative review action against a review task.
    """
    task = db.query(ReviewTask).filter(ReviewTask.id == task_id).first()
    if not task:
        raise ValueError(f"ReviewTask {task_id} not found")

    action_log = ReviewActionLog(
        task_id=task_id,
        action_taken=action_taken,
        notes=notes,
        performed_by=performed_by,
        created_at=datetime.utcnow()
    )
    db.add(action_log)

    if new_status:
        task.status = new_status
        if new_status in ["reverified", "closed"]:
            task.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(action_log)
    return action_log
