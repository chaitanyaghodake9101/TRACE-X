from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.user import User, UserRole
from app.models.disagreement import DisagreementSignal, MinorityEvidenceItem, InvestigatorContestation
from app.schemas.disagreement import (
    DisagreementSignalResponse,
    MinorityEvidenceItemResponse,
    DisagreementScanSummary,
    InvestigatorContestationCreate,
    InvestigatorContestationResponse
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.disagreement_engine import (
    scan_case_disagreements,
    record_investigator_contestation
)

router = APIRouter()

@router.get("/cases/{case_id}/disagreements", response_model=DisagreementScanSummary)
def get_case_disagreements(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    signals = db.query(DisagreementSignal).filter(DisagreementSignal.case_id == case_id).order_by(DisagreementSignal.created_at.desc()).all()
    minority_items = db.query(MinorityEvidenceItem).filter(MinorityEvidenceItem.case_id == case_id).order_by(MinorityEvidenceItem.detected_at.desc()).all()

    if not signals and not minority_items:
        # Run initial scan
        scan_res = scan_case_disagreements(db, case_id)
        signals = scan_res["signals"]
        minority_items = scan_res["minority_evidence"]

    crit_count = sum(1 for s in signals if s.severity == "critical")
    high_count = sum(1 for s in signals if s.severity == "high")

    return DisagreementScanSummary(
        case_id=case_id,
        total_signals=len(signals),
        critical_signals=crit_count,
        high_signals=high_count,
        minority_evidence_count=len(minority_items),
        signals=signals,
        minority_evidence=minority_items
    )

@router.post("/cases/{case_id}/disagreements/scan", response_model=DisagreementScanSummary)
def trigger_disagreement_scan(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    scan_res = scan_case_disagreements(db, case_id)

    log_audit_event(
        db=db,
        action="SCAN_DISAGREEMENTS",
        resource_type="disagreement_scan",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details={"total_signals": scan_res["total_signals"], "critical_signals": scan_res["critical_signals"]},
        request=request
    )

    return DisagreementScanSummary(
        case_id=case_id,
        total_signals=scan_res["total_signals"],
        critical_signals=scan_res["critical_signals"],
        high_signals=scan_res["high_signals"],
        minority_evidence_count=scan_res["minority_evidence_count"],
        signals=scan_res["signals"],
        minority_evidence=scan_res["minority_evidence"]
    )

@router.post("/disagreements/{signal_id}/contest", response_model=InvestigatorContestationResponse, status_code=status.HTTP_201_CREATED)
def contest_disagreement_signal(
    signal_id: str,
    contest_in: InvestigatorContestationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot submit contestations.")

    try:
        contestation = record_investigator_contestation(
            db=db,
            signal_id=signal_id,
            officer_id=current_user.id,
            contest_action=contest_in.contest_action,
            justification=contest_in.justification,
            adjusted_confidence=contest_in.adjusted_confidence
        )

        signal = db.query(DisagreementSignal).filter(DisagreementSignal.id == signal_id).first()
        log_audit_event(
            db=db,
            action="CONTEST_DISAGREEMENT_SIGNAL",
            resource_type="investigator_contestation",
            resource_id=contestation.id,
            user=current_user,
            case_id=signal.case_id if signal else None,
            details={"contest_action": contest_in.contest_action, "signal_title": signal.title if signal else ""},
            request=request
        )

        return InvestigatorContestationResponse(
            id=contestation.id,
            signal_id=contestation.signal_id,
            officer_id=contestation.officer_id,
            officer_name=current_user.full_name,
            contest_action=contestation.contest_action,
            justification=contestation.justification,
            adjusted_confidence=contestation.adjusted_confidence,
            created_at=contestation.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
