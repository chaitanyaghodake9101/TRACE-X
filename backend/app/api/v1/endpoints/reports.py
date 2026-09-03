from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogOut
from app.api.v1.endpoints.auth import get_current_user
from app.services.report_service import generate_case_pdf_dossier
from app.services.custody_service import generate_integrity_pdf_report

router = APIRouter()

@router.get("/cases/{case_id}/report/pdf")
@router.get("/cases/{case_id}/reports")
@router.post("/cases/{case_id}/reports")
def export_case_pdf_dossier(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        pdf_buffer = generate_case_pdf_dossier(db, case_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF dossier: {str(e)}")

    filename = f"TRACE_X_Dossier_{case.case_number.replace('/', '_')}.pdf"

    log_audit_event(
        db=db,
        action="EXPORT_PDF_REPORT",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details={"filename": filename},
        request=request
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.post("/cases/{case_id}/integrity-report")
def export_case_integrity_report(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        pdf_buffer = generate_integrity_pdf_report(db, case_id, current_user.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Integrity Report: {str(e)}")

    filename = f"TRACE_X_Integrity_Report_{case.case_number.replace('/', '_')}.pdf"

    log_audit_event(
        db=db,
        action="EXPORT_INTEGRITY_REPORT",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details={"filename": filename},
        request=request
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/cases/{case_id}/audit-logs", response_model=List[AuditLogOut])
def get_case_audit_logs(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return (
        db.query(AuditLog)
        .filter(AuditLog.case_id == case_id)
        .order_by(AuditLog.timestamp.desc())
        .all()
    )
