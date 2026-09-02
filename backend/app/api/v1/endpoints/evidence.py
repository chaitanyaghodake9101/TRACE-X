import os
import io
import csv
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.evidence import Evidence, EvidenceSourceType, EvidenceQualityScore, IntegrityStatus, CustodyEvent
from app.models.entity import Entity, EntityType, Relationship, RelationshipType
from app.models.user import User, UserRole
from app.models.structured import CDRRecord, FinancialTransaction
from app.schemas.evidence import (
    EvidenceCreate,
    EvidenceOut,
    EvidenceQualityScoreOut,
    CustodyEventOut,
    EvidenceIntegrityOut
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.document_parser import extract_text_from_file, extract_metadata_heuristics
from app.services.ner_service import extract_entities_from_text
from app.services.event_publisher import publish_domain_event
from app.services.quality_engine import (
    compute_4d_quality_score,
    recalculate_case_evidence_quality,
    get_case_quality_summary
)
from app.services.custody_service import (
    compute_evidence_sha256,
    compute_stored_evidence_hash,
    log_custody_event,
    verify_evidence_integrity,
    simulate_tampering
)

router = APIRouter()

# Alias for backwards compatibility
calculate_evidence_quality = compute_4d_quality_score

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

def auto_extract_and_persist_entities(case_id: str, text: str, db: Session):
    if not text:
        return
    extracted = extract_entities_from_text(text)
    if not extracted:
        return

    existing_entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    existing_keys = {f"{e.entity_type.value}:{e.canonical_name.lower().strip()}" for e in existing_entities}

    for item in extracted:
        key = f"{item['entity_type'].value}:{item['canonical_name'].lower().strip()}"
        if key not in existing_keys:
            existing_keys.add(key)
            new_entity = Entity(
                case_id=case_id,
                name=item["name"],
                entity_type=item["entity_type"],
                canonical_name=item["canonical_name"],
                confidence_score=item["confidence_score"],
                attributes_json=item["attributes_json"]
            )
            db.add(new_entity)
    db.commit()

@router.get("/cases/{case_id}/evidence", response_model=List[EvidenceOut])
def list_case_evidence(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    return db.query(Evidence).filter(Evidence.case_id == case_id).order_by(Evidence.created_at.desc()).all()

@router.post("/cases/{case_id}/evidence", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
def create_case_evidence(
    case_id: str,
    evidence_in: EvidenceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot upload or modify evidence.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    text_content = evidence_in.extracted_text or ""
    heuristics = extract_metadata_heuristics(text_content, evidence_in.source_type.value)
    merged_metadata = {**(evidence_in.metadata_json or {}), **heuristics}

    # Compute Cryptographic SHA-256 Ingestion Hash
    payload = f"{evidence_in.title}::{text_content}::{evidence_in.source_type.value}"
    sha256_hash = compute_evidence_sha256(payload)

    evidence = Evidence(
        case_id=case_id,
        title=evidence_in.title,
        description=evidence_in.description,
        source_type=evidence_in.source_type,
        extracted_text=text_content,
        metadata_json=merged_metadata,
        sha256_hash=sha256_hash,
        integrity_status=IntegrityStatus.VERIFIED,
        event_timestamp=evidence_in.event_timestamp or datetime.utcnow(),
        uploaded_by=current_user.id
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # Record Initial Chain-of-Custody Event
    log_custody_event(
        db=db,
        evidence_id=evidence.id,
        event_type="uploaded",
        user_id=current_user.id,
        hash_at_event=sha256_hash,
        notes=f"Evidence ingested with initial SHA-256 digest ({sha256_hash[:12]}...)"
    )

    # Compute Evidence Quality Score using Innovation 1 Engine
    score_data = compute_4d_quality_score(
        source_type=evidence.source_type,
        event_timestamp=evidence.event_timestamp,
        extracted_text=evidence.extracted_text,
        metadata_json=evidence.metadata_json,
        corroborating_sources_count=0,
        integrity_status=IntegrityStatus.VERIFIED
    )
    quality_score = EvidenceQualityScore(
        evidence_id=evidence.id,
        **score_data
    )
    db.add(quality_score)
    db.commit()
    db.refresh(evidence)

    # Automatically extract and persist candidate entities
    auto_extract_and_persist_entities(case_id, text_content, db)

    # Publish Transactional Domain Outbox Event (§4.A)
    publish_domain_event(
        db=db,
        event_type="evidence.uploaded.v1",
        aggregate_id=evidence.id,
        aggregate_type="evidence",
        payload={
            "evidence_id": evidence.id,
            "case_id": case_id,
            "title": evidence.title,
            "source_type": evidence.source_type.value,
            "sha256_hash": sha256_hash,
            "overall_quality_score": score_data["overall_quality_score"]
        },
        actor_id=current_user.id
    )
    db.commit()

    log_audit_event(
        db=db,
        action="INGEST_EVIDENCE",
        resource_type="evidence",
        resource_id=evidence.id,
        user=current_user,
        case_id=case_id,
        details={
            "title": evidence.title,
            "source_type": evidence.source_type.value,
            "sha256_hash": sha256_hash,
            "overall_quality_score": score_data["overall_quality_score"]
        },
        request=request
    )

    return evidence

@router.post("/cases/{case_id}/evidence/upload", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def upload_case_evidence_file(
    case_id: str,
    title: str = Form(...),
    source_type: EvidenceSourceType = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot upload evidence.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    file_bytes = await file.read()
    sha256_hash = compute_evidence_sha256(file_bytes)

    extracted_text, file_meta = extract_text_from_file(file_bytes, file.filename, file.content_type)
    heuristics = extract_metadata_heuristics(extracted_text, source_type.value)
    merged_metadata = {**file_meta, **heuristics}

    case_upload_dir = os.path.join(UPLOAD_DIR, case_id)
    os.makedirs(case_upload_dir, exist_ok=True)
    saved_filename = f"{uuid.uuid4()}_{file.filename}"
    saved_path = os.path.join(case_upload_dir, saved_filename)
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    evidence = Evidence(
        case_id=case_id,
        title=title,
        description=description,
        source_type=source_type,
        file_path=saved_path,
        extracted_text=extracted_text,
        metadata_json=merged_metadata,
        sha256_hash=sha256_hash,
        integrity_status=IntegrityStatus.VERIFIED,
        event_timestamp=datetime.utcnow(),
        uploaded_by=current_user.id
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # Record Initial Chain-of-Custody Event
    log_custody_event(
        db=db,
        evidence_id=evidence.id,
        event_type="uploaded",
        user_id=current_user.id,
        hash_at_event=sha256_hash,
        notes=f"Binary file '{file.filename}' uploaded and hashed ({sha256_hash[:12]}...)"
    )

    # Compute Evidence Quality Score using Innovation 1 Engine
    score_data = compute_4d_quality_score(
        source_type=evidence.source_type,
        event_timestamp=evidence.event_timestamp,
        extracted_text=evidence.extracted_text,
        metadata_json=evidence.metadata_json,
        corroborating_sources_count=0,
        integrity_status=IntegrityStatus.VERIFIED
    )
    quality_score = EvidenceQualityScore(
        evidence_id=evidence.id,
        **score_data
    )
    db.add(quality_score)
    db.commit()
    db.refresh(evidence)

    # Automatically extract and persist candidate entities
    auto_extract_and_persist_entities(case_id, extracted_text, db)

    log_audit_event(
        db=db,
        action="UPLOAD_EVIDENCE_FILE",
        resource_type="evidence",
        resource_id=evidence.id,
        user=current_user,
        case_id=case_id,
        details={
            "filename": file.filename,
            "source_type": evidence.source_type.value,
            "sha256_hash": sha256_hash,
            "overall_quality_score": score_data["overall_quality_score"]
        },
        request=request
    )

    return evidence

# --- STRUCTURED CSV INGESTION ENDPOINTS (§4 & §5 of Production PRD) ---

@router.post("/cases/{case_id}/evidence/cdr", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def upload_structured_cdr_csv(
    case_id: str,
    title: str = Form(...),
    description: Optional[str] = Form("Structured Call Detail Records CSV Dump"),
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot upload evidence.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    file_bytes = await file.read()
    sha256_hash = compute_evidence_sha256(file_bytes)
    csv_text = file_bytes.decode("utf-8", errors="ignore")

    case_upload_dir = os.path.join(UPLOAD_DIR, case_id)
    os.makedirs(case_upload_dir, exist_ok=True)
    saved_filename = f"cdr_{uuid.uuid4()}_{file.filename}"
    saved_path = os.path.join(case_upload_dir, saved_filename)
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    reader = csv.DictReader(io.StringIO(csv_text))
    cdr_rows = []
    phone_set = set()

    for row in reader:
        # Standardize field names
        caller = row.get("caller_number") or row.get("caller") or row.get("source") or row.get("from") or ""
        receiver = row.get("receiver_number") or row.get("receiver") or row.get("destination") or row.get("to") or ""
        duration = int(row.get("duration_seconds") or row.get("duration") or 0)
        tower = row.get("tower_location") or row.get("tower") or row.get("location") or ""
        
        if caller and receiver:
            caller_norm = caller.strip()
            receiver_norm = receiver.strip()
            cdr_rows.append({
                "caller": caller_norm,
                "receiver": receiver_norm,
                "duration": duration,
                "tower": tower
            })
            phone_set.add(caller_norm)
            phone_set.add(receiver_norm)

    meta = {
        "format": "csv",
        "record_type": "cdr_records",
        "record_count": len(cdr_rows),
        "detected_phone_numbers": list(phone_set)
    }

    summary_text = f"Structured CDR Extract ({len(cdr_rows)} calls): " + ", ".join(
        [f"{r['caller']} -> {r['receiver']} ({r['duration']}s)" for r in cdr_rows[:5]]
    )

    evidence = Evidence(
        case_id=case_id,
        title=title,
        description=description,
        source_type=EvidenceSourceType.CDR,
        file_path=saved_path,
        extracted_text=summary_text,
        metadata_json=meta,
        sha256_hash=sha256_hash,
        integrity_status=IntegrityStatus.VERIFIED,
        event_timestamp=datetime.utcnow(),
        uploaded_by=current_user.id
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # Insert parsed CDR records
    for r in cdr_rows:
        db_cdr = CDRRecord(
            evidence_id=evidence.id,
            caller_number=r["caller"],
            receiver_number=r["receiver"],
            call_timestamp=datetime.utcnow(),
            duration_seconds=r["duration"],
            tower_location=r["tower"]
        )
        db.add(db_cdr)

    # Automatically generate phone entities and CALLS graph relationships
    entity_map = {}
    for ph in phone_set:
        ent = db.query(Entity).filter(Entity.case_id == case_id, Entity.canonical_name == ph).first()
        if not ent:
            ent = Entity(
                case_id=case_id,
                name=ph,
                entity_type=EntityType.PHONE,
                canonical_name=ph,
                confidence_score=0.95,
                attributes_json={"source": "CDR Structured CSV"}
            )
            db.add(ent)
            db.commit()
            db.refresh(ent)
        entity_map[ph] = ent

    # Add CALLS relationships
    for r in cdr_rows:
        caller_ent = entity_map.get(r["caller"])
        receiver_ent = entity_map.get(r["receiver"])
        if caller_ent and receiver_ent and caller_ent.id != receiver_ent.id:
            existing_rel = db.query(Relationship).filter(
                Relationship.case_id == case_id,
                Relationship.source_entity_id == caller_ent.id,
                Relationship.target_entity_id == receiver_ent.id,
                Relationship.relationship_type == RelationshipType.CALLS
            ).first()
            if not existing_rel:
                new_rel = Relationship(
                    case_id=case_id,
                    source_entity_id=caller_ent.id,
                    target_entity_id=receiver_ent.id,
                    relationship_type=RelationshipType.CALLS,
                    weight=0.90,
                    confidence_score=0.90
                )
                db.add(new_rel)

    log_custody_event(
        db=db,
        evidence_id=evidence.id,
        event_type="uploaded",
        user_id=current_user.id,
        hash_at_event=sha256_hash,
        notes=f"Structured CDR CSV '{file.filename}' parsed ({len(cdr_rows)} calls, {len(phone_set)} phone entities)."
    )

    # Score evidence quality
    score_data = compute_4d_quality_score(
        source_type=evidence.source_type,
        event_timestamp=evidence.event_timestamp,
        extracted_text=summary_text,
        metadata_json=meta,
        corroborating_sources_count=0,
        integrity_status=IntegrityStatus.VERIFIED
    )
    quality_score = EvidenceQualityScore(
        evidence_id=evidence.id,
        **score_data
    )
    db.add(quality_score)
    db.commit()
    db.refresh(evidence)

    log_audit_event(
        db=db,
        action="INGEST_STRUCTURED_CDR",
        resource_type="evidence",
        resource_id=evidence.id,
        user=current_user,
        case_id=case_id,
        details={"records_parsed": len(cdr_rows), "phones_linked": len(phone_set)},
        request=request
    )

    return evidence

@router.post("/cases/{case_id}/evidence/financial", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
async def upload_structured_financial_csv(
    case_id: str,
    title: str = Form(...),
    description: Optional[str] = Form("Structured Bank Financial Remittance CSV"),
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot upload evidence.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    file_bytes = await file.read()
    sha256_hash = compute_evidence_sha256(file_bytes)
    csv_text = file_bytes.decode("utf-8", errors="ignore")

    case_upload_dir = os.path.join(UPLOAD_DIR, case_id)
    os.makedirs(case_upload_dir, exist_ok=True)
    saved_filename = f"fin_{uuid.uuid4()}_{file.filename}"
    saved_path = os.path.join(case_upload_dir, saved_filename)
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    reader = csv.DictReader(io.StringIO(csv_text))
    txn_rows = []
    entity_set = set()
    total_amount = 0.0

    for row in reader:
        sender = row.get("sender") or row.get("from_account") or row.get("source") or ""
        receiver = row.get("receiver") or row.get("to_account") or row.get("destination") or ""
        amt_str = row.get("amount") or row.get("inr_amount") or "0"
        try:
            amt = float(amt_str.replace(",", "").replace("INR", "").strip())
        except ValueError:
            amt = 0.0
        bank = row.get("bank_name") or row.get("bank") or ""

        if sender and receiver:
            sender_norm = sender.strip()
            receiver_norm = receiver.strip()
            txn_rows.append({
                "sender": sender_norm,
                "receiver": receiver_norm,
                "amount": amt,
                "bank": bank
            })
            entity_set.add(sender_norm)
            entity_set.add(receiver_norm)
            total_amount += amt

    meta = {
        "format": "csv",
        "record_type": "financial_transactions",
        "record_count": len(txn_rows),
        "total_amount_inr": total_amount,
        "involved_entities": list(entity_set)
    }

    summary_text = f"Financial Transactions Dump ({len(txn_rows)} records, INR {total_amount:,.2f}): " + ", ".join(
        [f"{t['sender']} -> {t['receiver']} (INR {t['amount']:,.2f})" for t in txn_rows[:5]]
    )

    evidence = Evidence(
        case_id=case_id,
        title=title,
        description=description,
        source_type=EvidenceSourceType.FINANCIAL_RECORDS,
        file_path=saved_path,
        extracted_text=summary_text,
        metadata_json=meta,
        sha256_hash=sha256_hash,
        integrity_status=IntegrityStatus.VERIFIED,
        event_timestamp=datetime.utcnow(),
        uploaded_by=current_user.id
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # Insert parsed financial transaction records
    for t in txn_rows:
        db_txn = FinancialTransaction(
            evidence_id=evidence.id,
            sender=t["sender"],
            receiver=t["receiver"],
            amount=t["amount"],
            txn_timestamp=datetime.utcnow(),
            bank_name=t["bank"]
        )
        db.add(db_txn)

    # Automatically generate Organization/Person entities and TRANSFERRED_TO relationships
    entity_map = {}
    for name in entity_set:
        ent = db.query(Entity).filter(Entity.case_id == case_id, Entity.canonical_name == name).first()
        if not ent:
            is_org = any(w in name.lower() for w in ["ltd", "corp", "hub", "bank", "exports", "pvt", "inc", "trust"])
            ent = Entity(
                case_id=case_id,
                name=name,
                entity_type=EntityType.ORGANIZATION if is_org else EntityType.PERSON,
                canonical_name=name,
                confidence_score=0.90,
                attributes_json={"source": "Financial Structured CSV"}
            )
            db.add(ent)
            db.commit()
            db.refresh(ent)
        entity_map[name] = ent

    # Add TRANSFERRED_TO relationships
    for t in txn_rows:
        s_ent = entity_map.get(t["sender"])
        r_ent = entity_map.get(t["receiver"])
        if s_ent and r_ent and s_ent.id != r_ent.id:
            existing_rel = db.query(Relationship).filter(
                Relationship.case_id == case_id,
                Relationship.source_entity_id == s_ent.id,
                Relationship.target_entity_id == r_ent.id,
                Relationship.relationship_type == RelationshipType.TRANSFERRED_TO
            ).first()
            if not existing_rel:
                new_rel = Relationship(
                    case_id=case_id,
                    source_entity_id=s_ent.id,
                    target_entity_id=r_ent.id,
                    relationship_type=RelationshipType.TRANSFERRED_TO,
                    weight=0.95,
                    confidence_score=0.95
                )
                db.add(new_rel)

    log_custody_event(
        db=db,
        evidence_id=evidence.id,
        event_type="uploaded",
        user_id=current_user.id,
        hash_at_event=sha256_hash,
        notes=f"Structured Financial CSV '{file.filename}' parsed ({len(txn_rows)} txns, INR {total_amount:,.2f})."
    )

    # Score evidence quality
    score_data = compute_4d_quality_score(
        source_type=evidence.source_type,
        event_timestamp=evidence.event_timestamp,
        extracted_text=summary_text,
        metadata_json=meta,
        corroborating_sources_count=0,
        integrity_status=IntegrityStatus.VERIFIED
    )
    quality_score = EvidenceQualityScore(
        evidence_id=evidence.id,
        **score_data
    )
    db.add(quality_score)
    db.commit()
    db.refresh(evidence)

    log_audit_event(
        db=db,
        action="INGEST_STRUCTURED_FINANCIAL",
        resource_type="evidence",
        resource_id=evidence.id,
        user=current_user,
        case_id=case_id,
        details={"txns_parsed": len(txn_rows), "total_amount_inr": total_amount},
        request=request
    )

    return evidence

# --- EVIDENCE DETAIL & CRUD ---

@router.get("/evidence/{evidence_id}", response_model=EvidenceOut)
def get_evidence_detail(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    # IDOR Check: Ensure investigator has case-level access (§4.C.5)
    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    if current_user.role == UserRole.INVESTIGATOR and case:
        if case.created_by != current_user.id and case.assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not assigned to this case.")

    # Record 'accessed' custody event
    log_custody_event(
        db=db,
        evidence_id=evidence.id,
        event_type="accessed",
        user_id=current_user.id,
        hash_at_event=evidence.sha256_hash,
        notes=f"Evidence accessed by {current_user.full_name} ({current_user.role.value})"
    )

    return evidence

@router.delete("/evidence/{evidence_id}", status_code=status.HTTP_200_OK)
def delete_evidence_item(
    evidence_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot delete evidence.")

    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # IDOR Check: Ensure investigator has case-level access
    case = db.query(Case).filter(Case.id == evidence.case_id).first()
    if current_user.role == UserRole.INVESTIGATOR and case:
        if case.created_by != current_user.id and case.assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied. You cannot delete evidence from this case.")

    case_id = evidence.case_id
    evidence_title = evidence.title

    if evidence.file_path and os.path.exists(evidence.file_path):
        try:
            os.remove(evidence.file_path)
        except Exception:
            pass

    db.delete(evidence)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_EVIDENCE",
        resource_type="evidence",
        resource_id=evidence_id,
        user=current_user,
        case_id=case_id,
        details={"title": evidence_title},
        request=request
    )
    return {"message": f"Evidence '{evidence_title}' successfully deleted."}

# --- CHAIN-OF-CUSTODY & INTEGRITY ENDPOINTS (§2.2 SIH26189 Alignment) ---

@router.get("/evidence/{evidence_id}/integrity", response_model=EvidenceIntegrityOut)
def get_evidence_integrity_status(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    current_hash = compute_stored_evidence_hash(evidence)
    is_valid = (current_hash == evidence.sha256_hash) and bool(evidence.sha256_hash)

    custody_chain = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.evidence_id == evidence_id)
        .order_by(CustodyEvent.timestamp.desc())
        .all()
    )

    last_verified = next((c.timestamp for c in custody_chain if c.event_type == "verified"), None)

    return EvidenceIntegrityOut(
        id=evidence.id,
        case_id=evidence.case_id,
        title=evidence.title,
        sha256_hash=evidence.sha256_hash,
        current_recomputed_hash=current_hash,
        integrity_status=evidence.integrity_status,
        is_valid=is_valid,
        last_verified_at=last_verified,
        custody_chain=custody_chain
    )

@router.post("/evidence/{evidence_id}/verify")
def verify_integrity_endpoint(
    evidence_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        result = verify_evidence_integrity(db, evidence_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    log_audit_event(
        db=db,
        action="VERIFY_EVIDENCE_INTEGRITY",
        resource_type="evidence",
        resource_id=evidence_id,
        user=current_user,
        details=result,
        request=request
    )

    # Recalculate case evidence quality to reflect any change in integrity
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if evidence:
        recalculate_case_evidence_quality(db, evidence.case_id)
        # Publish Outbox Domain Event (§4.A)
        event_type = "evidence.integrity_verified.v1" if result.get("status") == "verified" else "evidence.integrity_mismatch_detected.v1"
        publish_domain_event(
            db=db,
            event_type=event_type,
            aggregate_id=evidence_id,
            aggregate_type="evidence",
            payload={"evidence_id": evidence_id, "case_id": evidence.case_id, "result": result},
            actor_id=current_user.id
        )
        db.commit()

    return result

@router.post("/evidence/{evidence_id}/simulate-tamper")
def simulate_tamper_endpoint(
    evidence_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        result = simulate_tampering(db, evidence_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    log_audit_event(
        db=db,
        action="SIMULATE_TAMPER_EVIDENCE",
        resource_type="evidence",
        resource_id=evidence_id,
        user=current_user,
        details=result,
        request=request
    )

    # Recalculate case evidence quality
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if evidence:
        recalculate_case_evidence_quality(db, evidence.case_id)
        # Publish Critical Mismatch Outbox Domain Event (§4.A)
        publish_domain_event(
            db=db,
            event_type="evidence.integrity_mismatch_detected.v1",
            aggregate_id=evidence_id,
            aggregate_type="evidence",
            payload={"evidence_id": evidence_id, "case_id": evidence.case_id, "status": "COMPROMISED", "result": result},
            actor_id=current_user.id
        )
        db.commit()

    return result

@router.get("/evidence/{evidence_id}/custody-chain", response_model=List[CustodyEventOut])
def get_custody_chain_endpoint(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    return (
        db.query(CustodyEvent)
        .filter(CustodyEvent.evidence_id == evidence_id)
        .order_by(CustodyEvent.timestamp.desc())
        .all()
    )

# --- EVIDENCE QUALITY ENGINE ENDPOINTS ---

@router.get("/evidence/{evidence_id}/quality", response_model=EvidenceQualityScoreOut)
def get_evidence_quality(evidence_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    score = db.query(EvidenceQualityScore).filter(EvidenceQualityScore.evidence_id == evidence_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="Quality score not found for this evidence")
    return score

@router.get("/cases/{case_id}/evidence-quality", response_model=List[EvidenceQualityScoreOut])
def get_case_evidence_quality(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scores = (
        db.query(EvidenceQualityScore)
        .join(Evidence, Evidence.id == EvidenceQualityScore.evidence_id)
        .filter(Evidence.case_id == case_id)
        .order_by(EvidenceQualityScore.overall_quality_score.desc())
        .all()
    )
    return scores

@router.post("/cases/{case_id}/evidence-quality/recalculate")
def recalculate_quality_scores(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot trigger quality recalculation.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = recalculate_case_evidence_quality(db, case_id)

    log_audit_event(
        db=db,
        action="RECALCULATE_EVIDENCE_QUALITY",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details=result,
        request=request
    )
    return result

@router.get("/cases/{case_id}/evidence-quality/summary")
def get_quality_summary(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return get_case_quality_summary(db, case_id)
