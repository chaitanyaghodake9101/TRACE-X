import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session
from app.models.evidence import Evidence, EvidenceQualityScore, EvidenceSourceType, IntegrityStatus
from app.models.entity import Entity

# 1. Base Source Reliability Weights (w1 = 0.35)
SOURCE_RELIABILITY_WEIGHTS: Dict[EvidenceSourceType, float] = {
    EvidenceSourceType.FIR: 0.90,
    EvidenceSourceType.CDR: 0.85,
    EvidenceSourceType.FINANCIAL_RECORDS: 0.80,
    EvidenceSourceType.CCTV: 0.75,
    EvidenceSourceType.WITNESS_STATEMENT: 0.50,
    EvidenceSourceType.ANONYMOUS_TIP: 0.20,
    EvidenceSourceType.OTHER: 0.40,
}

# Exponential decay constant for 30-day half-life: lambda = ln(2) / 30 ≈ 0.0231049
DECAY_LAMBDA = 0.0231049

def compute_4d_quality_score(
    source_type: EvidenceSourceType,
    event_timestamp: Optional[datetime] = None,
    extracted_text: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
    corroborating_sources_count: int = 0,
    integrity_status: IntegrityStatus = IntegrityStatus.VERIFIED
) -> Dict[str, Any]:
    """
    Implements TRACE-X Innovation 1: Evidence Quality Graph scoring model (BLUEPRINT.md §2.1)
    with Cryptographic Chain-of-Custody Integrity integration (§3 of SIH26189 Alignment):
    Q(e) = (0.35 * S(e) + 0.20 * T(e) + 0.30 * C(e) + 0.15 * D(e)) * I(e)
    """
    # 1. Source Reliability S(e)
    s_score = SOURCE_RELIABILITY_WEIGHTS.get(source_type, 0.40)

    # 2. Temporal Freshness T(e)
    if event_timestamp:
        now = datetime.now(timezone.utc)
        if event_timestamp.tzinfo is None:
            ts_aware = event_timestamp.replace(tzinfo=timezone.utc)
        else:
            ts_aware = event_timestamp
        
        days_since_event = max(0.0, (now - ts_aware).total_seconds() / 86400.0)
        t_score = math.exp(-DECAY_LAMBDA * days_since_event)
    else:
        t_score = 0.50

    # 3. Cross-Source Corroboration C(e)
    c_score = min(1.0, 0.30 + 0.20 * max(0, corroborating_sources_count))

    # 4. Data Quality / Completeness D(e)
    text = (extracted_text or "").strip()
    text_len = len(text)
    meta = metadata_json or {}

    completeness_points = 0.0
    if text_len > 300:
        completeness_points += 0.40
    elif text_len > 100:
        completeness_points += 0.25
    elif text_len > 20:
        completeness_points += 0.15

    if meta.get("detected_phone_numbers") or meta.get("detected_vehicle_numbers") or meta.get("detected_monetary_amounts"):
        completeness_points += 0.30
    if meta.get("format") in ["csv", "json"] or meta.get("line_count", 0) > 2:
        completeness_points += 0.30

    d_score = min(1.0, max(0.20, completeness_points))

    # 5. Cryptographic Chain-of-Custody Integrity I(e)
    if integrity_status == IntegrityStatus.COMPROMISED:
        integrity_score = 0.10
    elif integrity_status == IntegrityStatus.UNVERIFIED:
        integrity_score = 0.80
    else:
        integrity_score = 1.0

    # Overall Weighted Score
    base_overall = (
        0.35 * s_score +
        0.20 * t_score +
        0.30 * c_score +
        0.15 * d_score
    )

    if integrity_status == IntegrityStatus.COMPROMISED:
        overall_score = min(0.15, round(base_overall * integrity_score, 3))
    else:
        overall_score = max(0.0, min(1.0, round(base_overall * integrity_score, 3)))

    return {
        "source_reliability_score": round(s_score, 3),
        "temporal_freshness_score": round(t_score, 3),
        "cross_corroboration_score": round(c_score, 3),
        "data_quality_score": round(d_score, 3),
        "integrity_score": integrity_score,
        "overall_quality_score": overall_score,
        "explanation_json": {
            "formula": "Q(e) = (0.35*S + 0.20*T + 0.30*C + 0.15*D) * I",
            "weights": {
                "source_reliability": 0.35,
                "temporal_freshness": 0.20,
                "cross_source_corroboration": 0.30,
                "data_completeness": 0.15,
                "integrity_modifier": integrity_score
            },
            "integrity_status": integrity_status.value,
            "corroborating_sources_count": corroborating_sources_count,
            "temporal_half_life_days": 30
        }
    }

def recalculate_case_evidence_quality(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Recalculates all Evidence Quality scores for a case by analyzing cross-source entity overlaps,
    accounting for cryptographic integrity status, and propagating confidence into the entity graph.
    """
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()

    # Step 1: Map each entity to the distinct evidence source types mentioning it
    entity_sources_map: Dict[str, Set[EvidenceSourceType]] = {}
    entity_evidence_map: Dict[str, List[Evidence]] = {}

    for ent in entities:
        ent_key = ent.id
        entity_sources_map[ent_key] = set()
        entity_evidence_map[ent_key] = []
        name_lower = ent.name.lower()
        canon_lower = (ent.canonical_name or "").lower()

        for ev in evidence_items:
            # Only count non-compromised sources for corroboration
            if ev.integrity_status == IntegrityStatus.COMPROMISED:
                continue

            ev_text = (ev.extracted_text or "").lower()
            if (name_lower and name_lower in ev_text) or (canon_lower and canon_lower in ev_text):
                entity_sources_map[ent_key].add(ev.source_type)
                entity_evidence_map[ent_key].append(ev)

    # Step 2: Compute corroboration for each evidence item based on shared entities from distinct sources
    updated_scores: List[EvidenceQualityScore] = []
    evidence_score_map: Dict[str, float] = {}

    for ev in evidence_items:
        ev_text = (ev.extracted_text or "").lower()
        corroborating_sources: Set[EvidenceSourceType] = set()

        for ent in entities:
            name_lower = ent.name.lower()
            canon_lower = (ent.canonical_name or "").lower()
            if (name_lower and name_lower in ev_text) or (canon_lower and canon_lower in ev_text):
                for st in entity_sources_map.get(ent.id, set()):
                    if st != ev.source_type:
                        corroborating_sources.add(st)

        corroborating_count = len(corroborating_sources)

        # Compute new 4D quality score
        score_data = compute_4d_quality_score(
            source_type=ev.source_type,
            event_timestamp=ev.event_timestamp,
            extracted_text=ev.extracted_text,
            metadata_json=ev.metadata_json,
            corroborating_sources_count=corroborating_count,
            integrity_status=ev.integrity_status
        )

        evidence_score_map[ev.id] = score_data["overall_quality_score"]

        # Update or create EvidenceQualityScore row
        existing_score = db.query(EvidenceQualityScore).filter(EvidenceQualityScore.evidence_id == ev.id).first()
        if existing_score:
            existing_score.source_reliability_score = score_data["source_reliability_score"]
            existing_score.temporal_freshness_score = score_data["temporal_freshness_score"]
            existing_score.cross_corroboration_score = score_data["cross_corroboration_score"]
            existing_score.data_quality_score = score_data["data_quality_score"]
            existing_score.integrity_score = score_data["integrity_score"]
            existing_score.overall_quality_score = score_data["overall_quality_score"]
            existing_score.explanation_json = score_data["explanation_json"]
            existing_score.calculated_at = datetime.utcnow()
            updated_scores.append(existing_score)
        else:
            new_score = EvidenceQualityScore(
                evidence_id=ev.id,
                **score_data
            )
            db.add(new_score)
            updated_scores.append(new_score)

    # Step 3: Graph Confidence Propagation: Update Entity confidence scores based on supporting evidence
    for ent in entities:
        supporting_evidence = entity_evidence_map.get(ent.id, [])
        if supporting_evidence:
            uncertainty_product = 1.0
            for ev in supporting_evidence:
                q = evidence_score_map.get(ev.id, 0.50)
                uncertainty_product *= (1.0 - q)
            propagated_confidence = max(0.50, min(1.0, round(1.0 - uncertainty_product, 2)))
            ent.confidence_score = propagated_confidence

    db.commit()

    return {
        "case_id": case_id,
        "evidence_items_recalculated": len(updated_scores),
        "entities_confidence_propagated": len(entities),
        "average_quality_score": round(sum(s.overall_quality_score for s in updated_scores) / max(1, len(updated_scores)), 3)
    }

def get_case_quality_summary(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Generates case-level executive quality metrics and intelligence breakdown.
    """
    scores = (
        db.query(EvidenceQualityScore)
        .join(Evidence, Evidence.id == EvidenceQualityScore.evidence_id)
        .filter(Evidence.case_id == case_id)
        .all()
    )

    if not scores:
        return {
            "total_evidence": 0,
            "average_quality_score": 0.0,
            "high_quality_count": 0,
            "medium_quality_count": 0,
            "low_quality_count": 0,
            "dimension_averages": {}
        }

    total = len(scores)
    avg_quality = round(sum(s.overall_quality_score for s in scores) / total, 3)
    avg_reliability = round(sum(s.source_reliability_score for s in scores) / total, 3)
    avg_freshness = round(sum(s.temporal_freshness_score for s in scores) / total, 3)
    avg_corroboration = round(sum(s.cross_corroboration_score for s in scores) / total, 3)
    avg_completeness = round(sum(s.data_quality_score for s in scores) / total, 3)
    avg_integrity = round(sum(s.integrity_score for s in scores) / total, 3)

    high_count = sum(1 for s in scores if s.overall_quality_score >= 0.70)
    med_count = sum(1 for s in scores if 0.40 <= s.overall_quality_score < 0.70)
    low_count = sum(1 for s in scores if s.overall_quality_score < 0.40)

    return {
        "total_evidence": total,
        "average_quality_score": avg_quality,
        "high_quality_count": high_count,
        "medium_quality_count": med_count,
        "low_quality_count": low_count,
        "dimension_averages": {
            "source_reliability": avg_reliability,
            "temporal_freshness": avg_freshness,
            "cross_source_corroboration": avg_corroboration,
            "data_completeness": avg_completeness,
            "cryptographic_integrity": avg_integrity
        }
    }
