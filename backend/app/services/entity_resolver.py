import difflib
import re
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.entity import Entity, Relationship, EntityType
from app.models.user import User
from app.core.audit import log_audit_event

def normalize_text(s: str) -> str:
    return re.sub(r'[\s\-_\.,]+', ' ', s).strip().lower()

def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """
    Computes string similarity using Python's SequenceMatcher as an efficient ratio.
    """
    s1_norm = normalize_text(s1)
    s2_norm = normalize_text(s2)
    if s1_norm == s2_norm:
        return 1.0
    return difflib.SequenceMatcher(None, s1_norm, s2_norm).ratio()

def compute_entity_similarity(ent_a: Entity, ent_b: Entity) -> Tuple[float, str]:
    """
    Calculates similarity between two entities of the same type.
    Returns (similarity_score: float, match_reason: str).
    """
    if ent_a.entity_type != ent_b.entity_type:
        return 0.0, "Different entity types"

    # 1. PHONE MATCHING (Strict Normalization)
    if ent_a.entity_type == EntityType.PHONE:
        digits_a = re.sub(r'\D', '', ent_a.name)[-10:]
        digits_b = re.sub(r'\D', '', ent_b.name)[-10:]
        if digits_a and digits_b and digits_a == digits_b:
            return 1.0, f"Exact 10-digit mobile match: {digits_a}"
        return 0.0, "No phone match"

    # 2. VEHICLE MATCHING (Normalized Plate)
    if ent_a.entity_type == EntityType.VEHICLE:
        plate_a = re.sub(r'[\s\-]', '', ent_a.name).upper()
        plate_b = re.sub(r'[\s\-]', '', ent_b.name).upper()
        if plate_a == plate_b:
            return 1.0, f"Exact vehicle registration plate match: {plate_a}"
        sim = difflib.SequenceMatcher(None, plate_a, plate_b).ratio()
        if sim > 0.8:
            return sim, f"Fuzzy license plate match ({sim:.2f})"
        return sim, "Low vehicle plate similarity"

    # 3. PERSON MATCHING (Initial Abbreviation + Full Name Jaro-Winkler)
    if ent_a.entity_type == EntityType.PERSON:
        name_a = normalize_text(ent_a.name)
        name_b = normalize_text(ent_b.name)
        
        if name_a == name_b:
            return 1.0, "Exact person name match"

        tokens_a = name_a.split()
        tokens_b = name_b.split()

        # Handle "V. Malhotra" vs "Vikram Malhotra"
        if len(tokens_a) == 2 and len(tokens_b) == 2:
            first_a, last_a = tokens_a
            first_b, last_b = tokens_b
            if last_a == last_b:
                if (len(first_a) == 1 and first_b.startswith(first_a)) or (len(first_b) == 1 and first_a.startswith(first_b)):
                    return 0.90, f"Initial + Last name match: {first_a} / {first_b} {last_a}"

        ratio = difflib.SequenceMatcher(None, name_a, name_b).ratio()
        if ratio >= 0.75:
            return ratio, f"Fuzzy person name match ({ratio:.2f})"
        return ratio, "Low person name similarity"

    # 4. LOCATION / ORGANIZATION / EVENT (General Fuzzy String Match)
    name_a = normalize_text(ent_a.name)
    name_b = normalize_text(ent_b.name)
    if name_a == name_b:
        return 1.0, "Exact name match"

    ratio = difflib.SequenceMatcher(None, name_a, name_b).ratio()
    if ratio >= 0.75:
        return ratio, f"Fuzzy name match ({ratio:.2f})"
    return ratio, "Low name similarity"

def find_duplicate_candidates(db: Session, case_id: str, threshold: float = 0.75) -> List[Dict[str, Any]]:
    """
    Scans all entities for a case and finds candidate duplicate pairs exceeding the threshold.
    """
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    candidates: List[Dict[str, Any]] = []

    # Group entities by type
    by_type: Dict[EntityType, List[Entity]] = {}
    for e in entities:
        by_type.setdefault(e.entity_type, []).append(e)

    for etype, group in by_type.items():
        n = len(group)
        for i in range(n):
            for j in range(i + 1, n):
                ent1 = group[i]
                ent2 = group[j]
                sim, reason = compute_entity_similarity(ent1, ent2)
                if sim >= threshold:
                    # Choose primary (prefer higher confidence score or longer name)
                    if (ent1.confidence_score, len(ent1.name)) >= (ent2.confidence_score, len(ent2.name)):
                        primary, secondary = ent1, ent2
                    else:
                        primary, secondary = ent2, ent1

                    candidates.append({
                        "primary_entity_id": primary.id,
                        "primary_name": primary.name,
                        "primary_canonical_name": primary.canonical_name,
                        "secondary_entity_id": secondary.id,
                        "secondary_name": secondary.name,
                        "secondary_canonical_name": secondary.canonical_name,
                        "entity_type": etype.value,
                        "similarity_score": round(sim, 3),
                        "match_reason": reason
                    })

    # Sort descending by similarity
    candidates.sort(key=lambda x: x["similarity_score"], reverse=True)
    return candidates

def merge_entities(
    db: Session,
    case_id: str,
    primary_id: str,
    secondary_ids: List[str],
    current_user: User,
    request: Any = None
) -> Entity:
    """
    Consolidates secondary entities into the primary canonical entity:
    - Rewires incoming/outgoing relationships to primary_id.
    - Merges attributes_json and mentions.
    - Deletes secondary entities.
    - Emits audit log.
    """
    primary = db.query(Entity).filter(Entity.id == primary_id, Entity.case_id == case_id).first()
    if not primary:
        raise ValueError(f"Primary entity {primary_id} not found in case {case_id}")

    merged_names = [primary.name]
    merged_attrs = dict(primary.attributes_json or {})
    merged_attrs["alias_names"] = list(merged_attrs.get("alias_names", []))

    for sec_id in secondary_ids:
        sec = db.query(Entity).filter(Entity.id == sec_id, Entity.case_id == case_id).first()
        if not sec or sec.id == primary.id:
            continue

        merged_names.append(sec.name)
        if sec.name not in merged_attrs["alias_names"]:
            merged_attrs["alias_names"].append(sec.name)

        # Merge secondary attributes
        if sec.attributes_json:
            for k, v in sec.attributes_json.items():
                if k not in merged_attrs:
                    merged_attrs[k] = v

        # Rewire relationships where secondary was source
        db.query(Relationship).filter(
            Relationship.case_id == case_id,
            Relationship.source_entity_id == sec.id
        ).update({"source_entity_id": primary.id}, synchronize_session=False)

        # Rewire relationships where secondary was target
        db.query(Relationship).filter(
            Relationship.case_id == case_id,
            Relationship.target_entity_id == sec.id
        ).update({"target_entity_id": primary.id}, synchronize_session=False)

        # Delete secondary entity
        db.delete(sec)

    primary.attributes_json = merged_attrs
    # Boost confidence score slightly upon multi-source resolution
    primary.confidence_score = min(1.0, round(primary.confidence_score + 0.05, 2))
    db.commit()
    db.refresh(primary)

    log_audit_event(
        db=db,
        action="RESOLVE_MERGE_ENTITIES",
        resource_type="entity",
        resource_id=primary.id,
        user=current_user,
        case_id=case_id,
        details={
            "canonical_name": primary.canonical_name,
            "merged_secondary_ids": secondary_ids,
            "aliases": merged_attrs["alias_names"]
        },
        request=request
    )

    return primary
