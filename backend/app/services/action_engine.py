from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.action import InvestigativeAction, ActionOutcome, ActionType, ActionStatus
from app.models.entity import Entity
from app.models.hypothesis import Hypothesis, HypothesisScore

# Base information gain potential by investigative action type (§2.3 of BLUEPRINT.md)
BASE_GAIN_MAP: Dict[ActionType, float] = {
    ActionType.RE_VERIFY_EVIDENCE: 0.95,
    ActionType.OBTAIN_FINANCIAL_RECORDS: 0.90,
    ActionType.OBTAIN_CDR: 0.85,
    ActionType.FORENSIC_ANALYSIS: 0.80,
    ActionType.CCTV_REVIEW: 0.75,
    ActionType.INTERVIEW_WITNESS: 0.60,
    ActionType.OTHER: 0.40,
}

def compute_action_eig(db: Session, action: InvestigativeAction) -> Dict[str, float]:
    """
    Computes the Expected Information Gain (EIG) for an investigative action:
    EIG(a) = BaseGain(a) * mu_gap(a) * mu_hyp(a) * phi_feasibility(a)
    """
    # 1. Base Gain
    base_gain = BASE_GAIN_MAP.get(action.action_type, 0.40)

    # 2. Knowledge Gap Multiplier: higher gain for poorly understood entities
    gap_multiplier = 1.0
    if action.target_entity_id:
        target_entity = db.query(Entity).filter(Entity.id == action.target_entity_id).first()
        if target_entity:
            conf = target_entity.confidence_score if target_entity.confidence_score is not None else 0.50
            gap_multiplier = round(1.0 + 0.5 * (1.0 - conf), 3)

    # 3. Hypothesis Discriminatory Multiplier: higher gain when competing hypotheses are closely tied
    hypothesis_multiplier = 1.0
    scores = (
        db.query(HypothesisScore)
        .join(Hypothesis, Hypothesis.id == HypothesisScore.hypothesis_id)
        .filter(Hypothesis.case_id == action.case_id)
        .all()
    )

    if len(scores) >= 2:
        sorted_scores = sorted(scores, key=lambda s: s.normalized_score, reverse=True)
        top_diff = abs(sorted_scores[0].normalized_score - sorted_scores[1].normalized_score)
        hypothesis_multiplier = round(1.0 + 1.0 * (1.0 - top_diff), 3)

    # 4. Feasibility Multiplier (ease of execution / legal authorization)
    feasibility = action.feasibility_multiplier if action.feasibility_multiplier is not None else 0.85

    # Overall EIG
    eig = round(base_gain * gap_multiplier * hypothesis_multiplier * feasibility, 3)

    return {
        "base_gain": base_gain,
        "gap_multiplier": gap_multiplier,
        "hypothesis_multiplier": hypothesis_multiplier,
        "feasibility_multiplier": feasibility,
        "expected_information_gain": eig
    }

def prioritize_case_actions(db: Session, case_id: str) -> List[InvestigativeAction]:
    """
    Recalculates EIG for all actions in a case and assigns integer priority ranks (1, 2, 3...).
    """
    actions = db.query(InvestigativeAction).filter(InvestigativeAction.case_id == case_id).all()

    active_actions: List[InvestigativeAction] = []
    inactive_actions: List[InvestigativeAction] = []

    for act in actions:
        metrics = compute_action_eig(db, act)
        act.base_gain = metrics["base_gain"]
        act.gap_multiplier = metrics["gap_multiplier"]
        act.hypothesis_multiplier = metrics["hypothesis_multiplier"]
        act.feasibility_multiplier = metrics["feasibility_multiplier"]
        act.expected_information_gain = metrics["expected_information_gain"]

        if act.status in [ActionStatus.PENDING, ActionStatus.IN_PROGRESS]:
            active_actions.append(act)
        else:
            inactive_actions.append(act)

    # Sort active actions descending by EIG
    active_actions.sort(key=lambda a: a.expected_information_gain, reverse=True)

    # Assign ranks
    for idx, act in enumerate(active_actions):
        act.priority_rank = idx + 1

    for act in inactive_actions:
        act.priority_rank = 999

    db.commit()
    for act in actions:
        db.refresh(act)

    return sorted(actions, key=lambda a: a.priority_rank)

def complete_action_and_log_outcome(
    db: Session,
    action_id: str,
    outcome_notes: Optional[str],
    produced_new_evidence: bool,
    evidence_id: Optional[str],
    effectiveness_score: float,
    user_id: str
) -> ActionOutcome:
    """
    Marks an action completed, logs outcome feedback, and triggers priority re-ranking.
    """
    action = db.query(InvestigativeAction).filter(InvestigativeAction.id == action_id).first()
    if not action:
        raise ValueError(f"Action {action_id} not found")

    action.status = ActionStatus.COMPLETED
    action.updated_at = datetime.utcnow()

    existing_outcome = db.query(ActionOutcome).filter(ActionOutcome.action_id == action_id).first()
    if existing_outcome:
        existing_outcome.outcome_notes = outcome_notes
        existing_outcome.produced_new_evidence = produced_new_evidence
        existing_outcome.evidence_id = evidence_id
        existing_outcome.effectiveness_score = effectiveness_score
        existing_outcome.logged_by = user_id
        outcome = existing_outcome
    else:
        outcome = ActionOutcome(
            action_id=action_id,
            outcome_notes=outcome_notes,
            produced_new_evidence=produced_new_evidence,
            evidence_id=evidence_id,
            effectiveness_score=effectiveness_score,
            logged_by=user_id
        )
        db.add(outcome)

    db.commit()

    # Re-prioritize remaining active actions
    prioritize_case_actions(db, action.case_id)
    db.refresh(outcome)
    return outcome
