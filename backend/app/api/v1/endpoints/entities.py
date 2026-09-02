from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.entity import Entity, Relationship, EntityType, RelationshipType
from app.models.user import User, UserRole
from app.schemas.entity import (
    EntityCreate, EntityUpdate, EntityOut,
    RelationshipCreate, RelationshipOut,
    DuplicateCandidateOut, EntityMergeRequest, AutoResolveOut
)
from app.api.v1.endpoints.auth import get_current_user
from app.services.ner_service import extract_entities_from_text
from app.services.entity_resolver import find_duplicate_candidates, merge_entities

router = APIRouter()

@router.get("/cases/{case_id}/entities", response_model=List[EntityOut])
def list_case_entities(
    case_id: str,
    entity_type: Optional[EntityType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Entity).filter(Entity.case_id == case_id)
    if entity_type:
        query = query.filter(Entity.entity_type == entity_type)
    return query.order_by(Entity.created_at.desc()).all()

@router.post("/cases/{case_id}/entities", response_model=EntityOut, status_code=status.HTTP_201_CREATED)
def create_case_entity(
    case_id: str,
    entity_in: EntityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors have read-only access.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    entity = Entity(
        case_id=case_id,
        name=entity_in.name,
        entity_type=entity_in.entity_type,
        canonical_name=entity_in.canonical_name or entity_in.name,
        confidence_score=entity_in.confidence_score,
        attributes_json=entity_in.attributes_json or {}
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)

    log_audit_event(
        db=db,
        action="CREATE_ENTITY",
        resource_type="entity",
        resource_id=entity.id,
        user=current_user,
        case_id=case_id,
        details={"name": entity.name, "type": entity.entity_type.value},
        request=request
    )
    return entity

@router.delete("/entities/{entity_id}", status_code=status.HTTP_200_OK)
def delete_entity(
    entity_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot delete entities.")

    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    case_id = entity.case_id
    entity_name = entity.name

    db.delete(entity)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_ENTITY",
        resource_type="entity",
        resource_id=entity_id,
        user=current_user,
        case_id=case_id,
        details={"name": entity_name},
        request=request
    )
    return {"message": f"Entity '{entity_name}' successfully removed."}

@router.post("/cases/{case_id}/extract-entities", response_model=List[EntityOut])
def trigger_batch_ner_extraction(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot trigger entity extraction.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_list = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    created_entities: List[Entity] = []

    existing_entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    existing_keys = {f"{e.entity_type.value}:{e.canonical_name.lower().strip()}" for e in existing_entities}

    for ev in evidence_list:
        if not ev.extracted_text:
            continue
        extracted = extract_entities_from_text(ev.extracted_text)
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
                created_entities.append(new_entity)

    db.commit()
    for ent in created_entities:
        db.refresh(ent)

    log_audit_event(
        db=db,
        action="BATCH_NER_EXTRACTION",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details={"entities_extracted_count": len(created_entities)},
        request=request
    )

    return db.query(Entity).filter(Entity.case_id == case_id).all()

# --- ENTITY RESOLUTION ENDPOINTS ---

@router.get("/cases/{case_id}/entity-resolution/candidates", response_model=List[DuplicateCandidateOut])
def get_duplicate_candidates(
    case_id: str,
    threshold: float = Query(0.75, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return find_duplicate_candidates(db, case_id, threshold=threshold)

@router.post("/cases/{case_id}/entity-resolution/merge", response_model=EntityOut)
def merge_duplicate_entities(
    case_id: str,
    merge_in: EntityMergeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot merge entities.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        primary_entity = merge_entities(
            db=db,
            case_id=case_id,
            primary_id=merge_in.primary_entity_id,
            secondary_ids=merge_in.secondary_entity_ids,
            current_user=current_user,
            request=request
        )
        return primary_entity
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cases/{case_id}/entity-resolution/auto-resolve", response_model=AutoResolveOut)
def auto_resolve_duplicates(
    case_id: str,
    threshold: float = Query(0.85, ge=0.5, le=1.0),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot trigger auto-resolve.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    candidates = find_duplicate_candidates(db, case_id, threshold=threshold)
    resolved_count = 0
    merged_entities_list: List[Entity] = []

    for cand in candidates:
        # Check if secondary still exists in DB (could have been merged already in earlier iteration)
        sec_exists = db.query(Entity).filter(Entity.id == cand["secondary_entity_id"]).first()
        prim_exists = db.query(Entity).filter(Entity.id == cand["primary_entity_id"]).first()
        if sec_exists and prim_exists:
            merged = merge_entities(
                db=db,
                case_id=case_id,
                primary_id=cand["primary_entity_id"],
                secondary_ids=[cand["secondary_entity_id"]],
                current_user=current_user,
                request=request
            )
            resolved_count += 1
            if merged not in merged_entities_list:
                merged_entities_list.append(merged)

    return {
        "resolved_pairs_count": resolved_count,
        "merged_entities": [EntityOut.model_validate(e) for e in merged_entities_list]
    }

# --- RELATIONSHIP ENDPOINTS ---

@router.get("/cases/{case_id}/relationships", response_model=List[RelationshipOut])
def list_case_relationships(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Relationship).filter(Relationship.case_id == case_id).all()

@router.post("/cases/{case_id}/relationships", response_model=RelationshipOut, status_code=status.HTTP_201_CREATED)
def create_case_relationship(
    case_id: str,
    rel_in: RelationshipCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot create relationships.")

    rel = Relationship(
        case_id=case_id,
        source_entity_id=rel_in.source_entity_id,
        target_entity_id=rel_in.target_entity_id,
        relationship_type=rel_in.relationship_type,
        weight=rel_in.weight,
        confidence_score=rel_in.confidence_score,
        attributes_json=rel_in.attributes_json or {}
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)

    log_audit_event(
        db=db,
        action="CREATE_RELATIONSHIP",
        resource_type="relationship",
        resource_id=rel.id,
        user=current_user,
        case_id=case_id,
        details={"type": rel.relationship_type.value, "source": rel.source_entity_id, "target": rel.target_entity_id},
        request=request
    )
    return rel
