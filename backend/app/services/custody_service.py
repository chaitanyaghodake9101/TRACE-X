import hashlib
import io
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from app.models.evidence import Evidence, CustodyEvent, IntegrityStatus, IntegrityReport
from app.models.case import Case
from app.models.user import User

def compute_evidence_sha256(content: Optional[bytes | str]) -> str:
    """
    Computes a cryptographic SHA-256 hex digest for an evidence payload.
    """
    if content is None:
        content = b""
    if isinstance(content, str):
        content_bytes = content.encode("utf-8")
    else:
        content_bytes = content
    return hashlib.sha256(content_bytes).hexdigest()

def compute_stored_evidence_hash(evidence: Evidence) -> str:
    """
    Computes the hash from the stored file if present, or from extracted_text / metadata.
    """
    if evidence.file_path and os.path.exists(evidence.file_path):
        try:
            with open(evidence.file_path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception:
            pass

    # Fallback to extracted text + title payload
    payload = f"{evidence.title}::{evidence.extracted_text or ''}::{evidence.source_type.value}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def log_custody_event(
    db: Session,
    evidence_id: str,
    event_type: str,
    user_id: str,
    hash_at_event: str,
    notes: Optional[str] = None
) -> CustodyEvent:
    """
    Appends an immutable custody record to the custody_events audit log.
    """
    event = CustodyEvent(
        evidence_id=evidence_id,
        event_type=event_type,
        performed_by=user_id,
        hash_at_event=hash_at_event,
        notes=notes,
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def verify_evidence_integrity(db: Session, evidence_id: str, user_id: str) -> Dict[str, Any]:
    """
    Re-hashes the stored evidence payload and compares it to the original ingestion SHA-256 hash.
    Writes a 'verified' or 'flagged_compromised' custody event.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise ValueError(f"Evidence {evidence_id} not found")

    recomputed_hash = compute_stored_evidence_hash(evidence)
    original_hash = evidence.sha256_hash

    is_valid = (recomputed_hash == original_hash) and bool(original_hash)
    
    if is_valid:
        evidence.integrity_status = IntegrityStatus.VERIFIED
        event_type = "verified"
        notes = f"Cryptographic integrity verified against ingestion hash ({original_hash[:12]}...)"
    else:
        evidence.integrity_status = IntegrityStatus.COMPROMISED
        event_type = "flagged_compromised"
        notes = f"INTEGRITY VIOLATION DETECTED! Expected {original_hash[:12]}..., got {recomputed_hash[:12]}..."

    evidence.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(evidence)

    log_custody_event(
        db=db,
        evidence_id=evidence_id,
        event_type=event_type,
        user_id=user_id,
        hash_at_event=recomputed_hash,
        notes=notes
    )

    return {
        "evidence_id": evidence.id,
        "original_hash": original_hash,
        "current_hash": recomputed_hash,
        "integrity_status": evidence.integrity_status.value,
        "is_valid": is_valid,
        "message": notes
    }

def simulate_tampering(db: Session, evidence_id: str, user_id: str) -> Dict[str, Any]:
    """
    Demo-only action: Modifies stored evidence extracted_text/payload bytes to simulate unauthorized tampering.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise ValueError(f"Evidence {evidence_id} not found")

    # Inject unauthorized alteration
    evidence.extracted_text = (evidence.extracted_text or "") + "\n[UNAUTHORIZED_ALTERATION_INJECTED_FOR_DEMO]"
    evidence.integrity_status = IntegrityStatus.COMPROMISED
    evidence.updated_at = datetime.utcnow()
    db.commit()

    tampered_hash = compute_stored_evidence_hash(evidence)

    log_custody_event(
        db=db,
        evidence_id=evidence_id,
        event_type="simulated_tamper",
        user_id=user_id,
        hash_at_event=tampered_hash,
        notes="Simulated unauthorized content modification for demonstration testing."
    )

    # Immediately verify to fire alert
    return verify_evidence_integrity(db, evidence_id, user_id)

def generate_integrity_pdf_report(db: Session, case_id: str, user_id: str) -> io.BytesIO:
    """
    Generates a formal, court-ready Chain-of-Custody Integrity & Provenance Verification PDF report.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    verified_count = sum(1 for e in evidence_items if e.integrity_status == IntegrityStatus.VERIFIED)
    compromised_count = sum(1 for e in evidence_items if e.integrity_status == IntegrityStatus.COMPROMISED)

    # Record report in database
    report_record = IntegrityReport(
        case_id=case_id,
        generated_by=user_id,
        total_evidence_items=len(evidence_items),
        verified_count=verified_count,
        compromised_count=compromised_count
    )
    db.add(report_record)
    db.commit()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'], fontSize=16, leading=20,
        textColor=colors.HexColor('#0f172a'), alignment=1, spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle', parent=styles['Normal'], fontSize=9, leading=12,
        textColor=colors.HexColor('#475569'), alignment=1, spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'Heading2Custom', parent=styles['Heading2'], fontSize=12, leading=15,
        textColor=colors.HexColor('#0f766e'), spaceBefore=12, spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyCustom', parent=styles['Normal'], fontSize=8.5, leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    cell_style = ParagraphStyle(
        'CellCustom', parent=styles['Normal'], fontSize=7.5, leading=9.5,
        textColor=colors.HexColor('#1e293b')
    )
    cell_bold = ParagraphStyle(
        'CellBold', parent=cell_style, fontName='Helvetica-Bold'
    )
    hash_style = ParagraphStyle(
        'HashStyle', parent=cell_style, fontName='Courier', fontSize=6.5, leading=8
    )

    story = []

    # Title Banner
    story.append(Paragraph("TRACE-X — CRYPTOGRAPHIC CHAIN-OF-CUSTODY & INTEGRITY AUDIT REPORT", title_style))
    story.append(Paragraph(f"Official Evidentiary Audit • Case: {case.case_number} • Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", subtitle_style))
    story.append(Spacer(1, 6))

    # Summary Box
    summary_data = [
        [Paragraph("<b>Case Title:</b>", cell_bold), Paragraph(case.title, cell_style), Paragraph("<b>Total Evidence Items:</b>", cell_bold), Paragraph(str(len(evidence_items)), cell_bold)],
        [Paragraph("<b>Case Number:</b>", cell_bold), Paragraph(case.case_number, cell_style), Paragraph("<b>Verified & Intact:</b>", cell_bold), Paragraph(f"<font color='#059669'><b>{verified_count}</b></font>", cell_style)],
        [Paragraph("<b>Audit Status:</b>", cell_bold), Paragraph("<font color='#059669'><b>PASS</b></font>" if compromised_count == 0 else "<font color='#e11d48'><b>FAIL (Tampering Detected)</b></font>", cell_style), Paragraph("<b>Compromised Items:</b>", cell_bold), Paragraph(f"<font color='#e11d48'><b>{compromised_count}</b></font>", cell_style)]
    ]
    sum_table = Table(summary_data, colWidths=[110, 180, 120, 130])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 10))

    # Evidence Cryptographic Hash Ledger
    story.append(Paragraph("1. Evidence Cryptographic Hash Ledger (SHA-256)", h2_style))
    ev_rows = [
        [Paragraph("<b>Evidence Title</b>", cell_bold), Paragraph("<b>Source Type</b>", cell_bold), Paragraph("<b>SHA-256 Digest</b>", cell_bold), Paragraph("<b>Status</b>", cell_bold)]
    ]
    for ev in evidence_items:
        status_str = "<font color='#059669'><b>VERIFIED</b></font>" if ev.integrity_status == IntegrityStatus.VERIFIED else "<font color='#e11d48'><b>COMPROMISED</b></font>"
        ev_rows.append([
            Paragraph(ev.title, cell_style),
            Paragraph(ev.source_type.value.upper(), cell_style),
            Paragraph(ev.sha256_hash or "N/A", hash_style),
            Paragraph(status_str, cell_style)
        ])
    ev_table = Table(ev_rows, colWidths=[160, 80, 220, 80])
    ev_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(ev_table)
    story.append(Spacer(1, 10))

    # Recent Custody Events Log
    story.append(Paragraph("2. Immutable Custody Event Timeline", h2_style))
    all_events = (
        db.query(CustodyEvent)
        .join(Evidence, Evidence.id == CustodyEvent.evidence_id)
        .filter(Evidence.case_id == case_id)
        .order_by(CustodyEvent.timestamp.desc())
        .limit(15)
        .all()
    )
    if all_events:
        evt_rows = [
            [Paragraph("<b>Timestamp (UTC)</b>", cell_bold), Paragraph("<b>Event</b>", cell_bold), Paragraph("<b>Evidence Item</b>", cell_bold), Paragraph("<b>Officer / Performer</b>", cell_bold), Paragraph("<b>Digest at Event</b>", cell_bold)]
        ]
        for evt in all_events:
            evt_rows.append([
                Paragraph(evt.timestamp.strftime('%Y-%m-%d %H:%M'), cell_style),
                Paragraph(f"<b>{evt.event_type.upper()}</b>", cell_style),
                Paragraph(evt.evidence.title[:25] + "..." if len(evt.evidence.title) > 25 else evt.evidence.title, cell_style),
                Paragraph(evt.performer.full_name if evt.performer else "System", cell_style),
                Paragraph(evt.hash_at_event[:16] + "...", hash_style)
            ])
        evt_table = Table(evt_rows, colWidths=[85, 80, 135, 110, 130])
        evt_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(evt_table)
    else:
        story.append(Paragraph("No custody events recorded.", body_style))

    story.append(Spacer(1, 14))

    # Legal Attestation
    story.append(Paragraph("3. Court-Admissible Attestation & Digital Verification", h2_style))
    story.append(Paragraph("I hereby certify under official law enforcement protocol that the above cryptographic SHA-256 digests and append-only custody logs were recorded automatically at time of collection and access, without retroactive modification.", body_style))
    story.append(Spacer(1, 20))

    sig_data = [
        [Paragraph("<b>Forensic Custodian Officer:</b> ___________________________", cell_style), Paragraph("<b>Supervising Forensic Director:</b> ___________________________", cell_style)],
        [Paragraph("Date: ________________________", cell_style), Paragraph("Date: ________________________", cell_style)]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(KeepTogether(sig_table))

    doc.build(story)
    buffer.seek(0)
    return buffer
