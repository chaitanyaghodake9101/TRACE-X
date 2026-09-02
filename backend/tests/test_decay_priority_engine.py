import pytest
from datetime import datetime, timedelta
from app.models.user import User, UserRole
from app.models.case import Case
from app.models.evidence import Evidence, EvidenceSourceType, EvidenceQualityScore, IntegrityStatus
from app.models.hypothesis import Hypothesis, EvidenceHypothesis, HypothesisRelationType
from app.models.review_priority import ReviewTask, ReviewActionLog
from app.services.decay_priority_engine import (
    calculate_evidence_review_urgency,
    recalculate_case_review_priorities,
    log_review_action
)

def test_decay_priority_engine_urgency_and_tasks(db_session):
    # Setup
    user = User(email="decay.officer@delhipolice.gov.in", hashed_password="pw", full_name="Officer Patel", role=UserRole.SENIOR_INVESTIGATOR)
    db_session.add(user)
    db_session.commit()

    case = Case(case_number="FIR-2026-DEC-003", title="Aged Financial Fraud", created_by=user.id)
    db_session.add(case)
    db_session.commit()

    # Evidence 1: Fresh CCTV (volatile, high urgency)
    ev_cctv = Evidence(
        case_id=case.id,
        title="Mall CCTV Recording",
        source_type=EvidenceSourceType.CCTV,
        uploaded_by=user.id,
        created_at=datetime.utcnow() - timedelta(days=50) # 50 days aged
    )
    # Evidence 2: Compromised CDR (compromised integrity -> P0 Critical)
    ev_cdr = Evidence(
        case_id=case.id,
        title="Suspect Phone CDR",
        source_type=EvidenceSourceType.CDR,
        integrity_status=IntegrityStatus.COMPROMISED,
        uploaded_by=user.id,
        created_at=datetime.utcnow() - timedelta(days=10)
    )
    db_session.add_all([ev_cctv, ev_cdr])
    db_session.commit()

    # Calculate urgency for compromised CDR
    cdr_res = calculate_evidence_review_urgency(db_session, ev_cdr.id)
    assert cdr_res["integrity_urgency"] == 1.0
    assert cdr_res["suggested_review_tier"] == "P0_CRITICAL"

    # Recalculate case review priorities and verify task auto-generation
    case_priorities = recalculate_case_review_priorities(db_session, case.id)
    assert len(case_priorities) == 2
    assert case_priorities[0]["evidence_id"] == ev_cdr.id # P0 should rank top

    # Verify auto-generated ReviewTasks
    tasks = db_session.query(ReviewTask).filter(ReviewTask.case_id == case.id).all()
    assert len(tasks) >= 1
    p0_task = next((t for t in tasks if t.evidence_id == ev_cdr.id), None)
    assert p0_task is not None
    assert p0_task.priority == "P0"

    # Log review action against task
    action_log = log_review_action(
        db=db_session,
        task_id=p0_task.id,
        action_taken="hash_reverified",
        performed_by=user.id,
        notes="Cryptographic hash recomputed from cold storage backup.",
        new_status="reverified"
    )
    assert action_log.id is not None
    assert p0_task.status == "reverified"
    assert p0_task.resolved_at is not None
