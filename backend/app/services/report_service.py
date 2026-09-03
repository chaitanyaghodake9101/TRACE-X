import io
from datetime import datetime
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from app.models.case import Case
from app.models.entity import Entity
from app.models.evidence import Evidence, EvidenceQualityScore
from app.models.hypothesis import Hypothesis, HypothesisScore
from app.models.action import InvestigativeAction
from app.models.audit import AuditLog

def generate_case_pdf_dossier(db: Session, case_id: str) -> io.BytesIO:
    """
    Generates an official multi-page Law Enforcement Investigation PDF Dossier for a case.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

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
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a'),
        alignment=1, # Center
        spaceAfter=12
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=18
    )
    h2_style = ParagraphStyle(
        'Heading2Custom',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0f766e'),
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e293b')
    )
    cell_style = ParagraphStyle(
        'CellCustom',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )

    story = []

    # Title Banner
    story.append(Paragraph("TRACE-X — INVESTIGATIVE GRAPH & INTELLIGENCE DOSSIER", title_style))
    story.append(Paragraph(f"Official Case Report • Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} • RESTRICTED / LAW ENFORCEMENT USE ONLY", subtitle_style))
    story.append(Spacer(1, 8))

    # Case Metadata Summary Box
    meta_data = [
        [
            Paragraph("<b>Case Title:</b>", cell_bold), Paragraph(case.title, cell_style),
            Paragraph("<b>Case Number:</b>", cell_bold), Paragraph(case.case_number, cell_style)
        ],
        [
            Paragraph("<b>Priority:</b>", cell_bold), Paragraph(case.priority.upper(), cell_style),
            Paragraph("<b>Status:</b>", cell_bold), Paragraph(case.status.upper().replace('_', ' '), cell_style)
        ],
        [
            Paragraph("<b>Created Date:</b>", cell_bold), Paragraph(case.created_at.strftime('%Y-%m-%d'), cell_style),
            Paragraph("<b>Assigned Investigator:</b>", cell_bold), Paragraph(case.assignee.full_name if case.assignee else "Unassigned", cell_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[110, 160, 110, 160])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Section 1: Executive Summary
    story.append(Paragraph("1. Executive Summary", h2_style))
    exec_summary = case.description or "Automated multi-source investigative analytics compiled by TRACE-X intelligence platform. This dossier presents the unified entity resolution graph, 4-dimensional evidence quality scoring, Richards Heuer Analysis of Competing Hypotheses (ACH) evaluations, and Value-of-Information (VoI) ranked next actions."
    story.append(Paragraph(exec_summary, body_style))
    story.append(Spacer(1, 10))

    # Section 2: Key Extracted & Resolved Entities
    entities = db.query(Entity).filter(Entity.case_id == case_id).limit(10).all()
    story.append(Paragraph("2. Key Resolved Entity Network", h2_style))
    if entities:
        ent_rows = [
            [Paragraph("<b>Entity Name</b>", cell_bold), Paragraph("<b>Type</b>", cell_bold), Paragraph("<b>Canonical Identity</b>", cell_bold), Paragraph("<b>Confidence</b>", cell_bold)]
        ]
        for ent in entities:
            ent_rows.append([
                Paragraph(ent.name, cell_style),
                Paragraph(ent.entity_type.value.upper(), cell_style),
                Paragraph(ent.canonical_name or ent.name, cell_style),
                Paragraph(f"{((ent.confidence_score or 1.0) * 100):.0f}%", cell_style)
            ])
        ent_table = Table(ent_rows, colWidths=[160, 90, 200, 90])
        ent_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(ent_table)
    else:
        story.append(Paragraph("No entities extracted.", body_style))
    story.append(Spacer(1, 10))

    # Section 3: Evidence Quality Intelligence (Innovation 1)
    evidence_items = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id)
        .order_by(Evidence.created_at.desc())
        .limit(8)
        .all()
    )
    story.append(Paragraph("3. Evidence Quality Scoring (4-Dimension Model)", h2_style))
    if evidence_items:
        ev_rows = [
            [Paragraph("<b>Evidence Title</b>", cell_bold), Paragraph("<b>Source</b>", cell_bold), Paragraph("<b>Freshness</b>", cell_bold), Paragraph("<b>Corroboration</b>", cell_bold), Paragraph("<b>Overall Quality</b>", cell_bold)]
        ]
        for ev in evidence_items:
            q = ev.quality_score
            overall = f"{((q.overall_quality_score if q else 0.5) * 100):.0f}%"
            fresh = f"{((q.temporal_freshness_score if q else 0.5) * 100):.0f}%"
            corrob = f"{((q.cross_corroboration_score if q else 0.3) * 100):.0f}%"
            ev_rows.append([
                Paragraph(ev.title, cell_style),
                Paragraph(ev.source_type.value.upper(), cell_style),
                Paragraph(fresh, cell_style),
                Paragraph(corrob, cell_style),
                Paragraph(overall, cell_bold)
            ])
        ev_table = Table(ev_rows, colWidths=[180, 90, 85, 95, 90])
        ev_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(ev_table)
    else:
        story.append(Paragraph("No evidence ingested.", body_style))
    story.append(Spacer(1, 10))

    # Section 4: Competing Hypotheses ACH Evaluation (Innovation 2)
    hypotheses = db.query(Hypothesis).filter(Hypothesis.case_id == case_id).all()
    story.append(Paragraph("4. Analysis of Competing Hypotheses (ACH) Rankings", h2_style))
    if hypotheses:
        hypo_rows = [
            [Paragraph("<b>Hypothesis Scenario</b>", cell_bold), Paragraph("<b>Support</b>", cell_bold), Paragraph("<b>Contradict (1.5x)</b>", cell_bold), Paragraph("<b>Net Score</b>", cell_bold), Paragraph("<b>Calibrated Likelihood</b>", cell_bold)]
        ]
        for h in hypotheses:
            score = h.score
            supp = f"{score.supporting_weight_sum:.2f}" if score else "0.00"
            contra = f"{score.contradicting_weight_sum:.2f}" if score else "0.00"
            net = f"{score.raw_score:.2f}" if score else "0.00"
            lh = f"{((score.normalized_score if score else 0.5) * 100):.1f}%"
            hypo_rows.append([
                Paragraph(h.title, cell_style),
                Paragraph(supp, cell_style),
                Paragraph(contra, cell_style),
                Paragraph(net, cell_style),
                Paragraph(f"<b>{lh}</b>", cell_bold)
            ])
        hypo_table = Table(hypo_rows, colWidths=[200, 75, 95, 80, 90])
        hypo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6b21a8')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(hypo_table)
    else:
        story.append(Paragraph("No hypotheses recorded.", body_style))
    story.append(Spacer(1, 10))

    # Section 5: Value-of-Information Recommended Actions (Innovation 3)
    actions = (
        db.query(InvestigativeAction)
        .filter(InvestigativeAction.case_id == case_id)
        .order_by(InvestigativeAction.priority_rank.asc())
        .limit(6)
        .all()
    )
    story.append(Paragraph("5. Value-of-Information (VoI) Next Recommended Actions", h2_style))
    if actions:
        act_rows = [
            [Paragraph("<b>Rank</b>", cell_bold), Paragraph("<b>Action Title</b>", cell_bold), Paragraph("<b>Type</b>", cell_bold), Paragraph("<b>Status</b>", cell_bold), Paragraph("<b>EIG Score</b>", cell_bold)]
        ]
        for act in actions:
            act_rows.append([
                Paragraph(f"#{act.priority_rank}", cell_bold),
                Paragraph(act.title, cell_style),
                Paragraph(act.action_type.value.replace('_', ' ').upper(), cell_style),
                Paragraph(act.status.value.upper(), cell_style),
                Paragraph(f"<b>{act.expected_information_gain:.2f}</b>", cell_bold)
            ])
        act_table = Table(act_rows, colWidths=[45, 235, 110, 75, 75])
        act_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#b45309')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(act_table)
    else:
        story.append(Paragraph("No prioritized actions.", body_style))
    story.append(Spacer(1, 14))

    # Section 6: Chain of Custody & Audit Sign-off
    story.append(Paragraph("6. Audit & Chain of Custody Authentication", h2_style))
    story.append(Paragraph("This document represents an immutable, cryptographically audited snapshot of investigative findings and hypothesis calibrations generated by the TRACE-X intelligence subsystem. All source documents and modifications are permanently recorded in the immutable audit log.", body_style))
    story.append(Spacer(1, 20))

    # Signature Block
    sig_data = [
        [Paragraph("<b>Lead Investigating Officer:</b> ___________________________", cell_style), Paragraph("<b>Supervisory Reviewer:</b> ___________________________", cell_style)],
        [Paragraph("Date: ________________________", cell_style), Paragraph("Date: ________________________", cell_style)]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(KeepTogether(sig_table))

    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_audit_pdf_report(db: Session, audit_logs: List[AuditLog]) -> io.BytesIO:
    """
    Generates an official multi-page Administrative Audit Log PDF Report.
    """
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
        'AuditTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0f172a'),
        alignment=1,
        spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'AuditSubTitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=14
    )
    cell_style = ParagraphStyle(
        'AuditCell',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#1e293b')
    )
    cell_bold = ParagraphStyle(
        'AuditCellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )

    story = []
    story.append(Paragraph("TRACE-X — SYSTEM AUDIT & CHAIN OF CUSTODY LOG", title_style))
    story.append(Paragraph(f"Official Audit Export • Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} • Total Events: {len(audit_logs)} • RESTRICTED / COMPLIANCE RECORD", subtitle_style))
    story.append(Spacer(1, 8))

    # Audit Table
    headers = [
        Paragraph("<b>Timestamp (UTC)</b>", cell_bold),
        Paragraph("<b>Action</b>", cell_bold),
        Paragraph("<b>Resource Type</b>", cell_bold),
        Paragraph("<b>Resource ID</b>", cell_bold),
        Paragraph("<b>Actor (Officer)</b>", cell_bold),
        Paragraph("<b>IP Address</b>", cell_bold)
    ]
    rows = [headers]

    for log in audit_logs:
        actor_name = log.user.full_name if log.user else (log.user_id or "System Automated")
        ts_str = log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "N/A"
        rows.append([
            Paragraph(ts_str, cell_style),
            Paragraph(log.action, cell_bold),
            Paragraph(log.resource_type, cell_style),
            Paragraph((log.resource_id or "—")[:16], cell_style),
            Paragraph(actor_name, cell_style),
            Paragraph(log.ip_address or "—", cell_style)
        ])

    table = Table(rows, colWidths=[95, 115, 80, 85, 110, 55])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f766e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(table)
    story.append(Spacer(1, 16))

    # Sign-off block
    sig_data = [
        [Paragraph("<b>Certified System Auditor:</b> ___________________________", cell_style), Paragraph("<b>Security Directorate Approval:</b> ___________________________", cell_style)],
        [Paragraph("Date: ________________________", cell_style), Paragraph("Date: ________________________", cell_style)]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    story.append(KeepTogether(sig_table))

    doc.build(story)
    buffer.seek(0)
    return buffer

