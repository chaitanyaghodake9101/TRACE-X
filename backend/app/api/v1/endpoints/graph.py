from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.case import Case
from app.models.entity import Entity, Relationship
from app.models.evidence import Evidence
from app.models.structured import CDRRecord, FinancialTransaction
from app.models.user import User, UserRole
from app.schemas.entity import GraphData
from app.api.v1.endpoints.auth import get_current_user
from app.services.graph_service import build_case_graph, get_case_graph_stats, sync_case_to_neo4j

router = APIRouter()

@router.get("/cases/{case_id}/graph", response_model=GraphData)
def get_case_graph(
    case_id: str,
    min_quality_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    entity_types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if current_user.role == UserRole.INVESTIGATOR:
        if case.created_by != current_user.id and case.assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to case graph.")

    return build_case_graph(
        db=db,
        case_id=case_id,
        min_quality_score=min_quality_score,
        entity_types=entity_types
    )

@router.get("/cases/{case_id}/graph/stats")
def get_graph_statistics(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return get_case_graph_stats(db, case_id)

@router.post("/cases/{case_id}/graph/sync")
def trigger_neo4j_graph_sync(
    case_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditors cannot trigger graph synchronization.")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    sync_result = sync_case_to_neo4j(db, case_id)

    log_audit_event(
        db=db,
        action="SYNC_GRAPH_NEO4J",
        resource_type="case",
        resource_id=case_id,
        user=current_user,
        case_id=case_id,
        details=sync_result,
        request=request
    )

    return sync_result

# --- KEY INFLUENCERS & PATTERN DETECTION (§5 & §7 of Production PRD) ---

@router.get("/cases/{case_id}/graph/key-influencers")
def get_key_influencers(
    case_id: str,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()

    if not entities:
        return {"case_id": case_id, "influencers": []}

    # Build adjacency
    in_degrees: Dict[str, int] = {e.id: 0 for e in entities}
    out_degrees: Dict[str, int] = {e.id: 0 for e in entities}
    adj: Dict[str, List[str]] = {e.id: [] for e in entities}

    for r in relationships:
        if r.source_entity_id in out_degrees:
            out_degrees[r.source_entity_id] += 1
            adj[r.source_entity_id].append(r.target_entity_id)
        if r.target_entity_id in in_degrees:
            in_degrees[r.target_entity_id] += 1

    # Simplified PageRank calculation (20 power iterations with damping factor 0.85)
    n = len(entities)
    d = 0.85
    pagerank = {e.id: 1.0 / n for e in entities}

    for _ in range(20):
        new_pr = {e.id: (1.0 - d) / n for e in entities}
        for node_id, neighbors in adj.items():
            if neighbors:
                share = (d * pagerank[node_id]) / len(neighbors)
                for neighbor in neighbors:
                    if neighbor in new_pr:
                        new_pr[neighbor] += share
            else:
                # Dangling node distribution
                for e_id in new_pr:
                    new_pr[e_id] += (d * pagerank[node_id]) / n
        pagerank = new_pr

    # Compile influencer records
    influencers = []
    for e in entities:
        total_deg = in_degrees[e.id] + out_degrees[e.id]
        score = round(pagerank[e.id] * 100, 3)
        influencers.append({
            "entity_id": e.id,
            "name": e.name,
            "canonical_name": e.canonical_name or e.name,
            "entity_type": e.entity_type.value,
            "confidence_score": e.confidence_score,
            "total_connections": total_deg,
            "in_degree": in_degrees[e.id],
            "out_degree": out_degrees[e.id],
            "importance_score": score,
            "rank_label": "High Centrality" if score > (100.0 / n) * 1.5 else "Moderate Centrality"
        })

    influencers.sort(key=lambda x: x["importance_score"], reverse=True)

    return {
        "case_id": case_id,
        "total_analyzed_entities": n,
        "influencers": influencers[:limit]
    }

@router.get("/cases/{case_id}/patterns")
def detect_case_patterns(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    patterns = []

    # 1. Check for High-Frequency Telecommunication Bursts
    cdr_rows = (
        db.query(CDRRecord)
        .join(Evidence, Evidence.id == CDRRecord.evidence_id)
        .filter(Evidence.case_id == case_id)
        .all()
    )
    if len(cdr_rows) >= 5:
        call_counts: Dict[str, int] = {}
        for r in cdr_rows:
            pair = f"{r.caller_number} <-> {r.receiver_number}"
            call_counts[pair] = call_counts.get(pair, 0) + 1

        for pair, count in call_counts.items():
            if count >= 3:
                patterns.append({
                    "id": f"pat-cdr-{len(patterns)+1}",
                    "type": "CALL_BURST_PATTERN",
                    "severity": "high" if count >= 10 else "medium",
                    "title": f"High-Frequency Communication Cluster ({count} calls)",
                    "description": f"Repeated burst calls detected between numbers: {pair}.",
                    "evidence_type": "cdr",
                    "recommendation": "Subpoena call tower dumps and inspect IMEI handset history."
                })

    # 2. Check for High-Value Hawala / Remittance Conduits
    fin_txns = (
        db.query(FinancialTransaction)
        .join(Evidence, Evidence.id == FinancialTransaction.evidence_id)
        .filter(Evidence.case_id == case_id)
        .all()
    )
    high_value_txns = [t for t in fin_txns if t.amount >= 10000000.0] # >= 1 Crore INR
    if high_value_txns:
        total_high_val = sum(t.amount for t in high_value_txns)
        patterns.append({
            "id": f"pat-fin-{len(patterns)+1}",
            "type": "LARGE_REMITTANCE_ANOMALY",
            "severity": "critical",
            "title": f"Large-Scale Structured Remittance (INR {total_high_val:,.2f})",
            "description": f"{len(high_value_txns)} high-value foreign transfers detected across shell entities.",
            "evidence_type": "financial_records",
            "recommendation": "Execute Financial Intelligence Unit (FIU) audit and request MLAT bank disclosure."
        })

    # 3. Graph Topological Ring / Shell Network Anomaly
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    org_entities = [e for e in entities if e.entity_type.value == "organization"]
    if len(org_entities) >= 2:
        patterns.append({
            "id": f"pat-org-{len(patterns)+1}",
            "type": "SHELL_CORPORATE_ROUTING",
            "severity": "high",
            "title": "Layered Corporate Shell Routing Network",
            "description": f"Multiple corporate entities ({', '.join(o.name for o in org_entities[:3])}) identified acting as intermediaries.",
            "evidence_type": "property_graph",
            "recommendation": "Issue corporate registry subpoena (CIN & beneficial ownership audit)."
        })

    return {
        "case_id": case_id,
        "patterns_detected_count": len(patterns),
        "patterns": patterns
    }
