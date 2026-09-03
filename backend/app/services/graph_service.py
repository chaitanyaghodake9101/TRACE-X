from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.entity import Entity, Relationship, EntityType, EvidenceEntityLink, RelationshipEvidenceLink
from app.models.evidence import Evidence, EvidenceQualityScore
from app.schemas.entity import GraphNode, GraphEdge, GraphData
from app.core.neo4j import neo4j_client

def build_case_graph(
    db: Session,
    case_id: str,
    min_quality_score: Optional[float] = None,
    entity_types: Optional[List[str]] = None
) -> GraphData:
    """
    Compiles a unified, evidence-linked graph representation of a case:
    - Entity nodes (Person, Phone, Vehicle, Location, Organization, Event)
    - Evidence nodes with 4-dimensional quality scores & SHA-256 hashes
    - Entity-to-Entity explicit relationships with linked source evidence
    - Evidence-to-Entity MENTIONED_IN edges linking evidence documents to extracted entities
    """
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []
    node_id_set: Set[str] = set()

    # 1. Fetch Evidence Items and Quality Scores
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    evidence_map = {ev.id: ev for ev in evidence_items}
    evidence_scores = {
        s.evidence_id: s
        for s in db.query(EvidenceQualityScore).join(Evidence, Evidence.id == EvidenceQualityScore.evidence_id).filter(Evidence.case_id == case_id).all()
    }

    # Fetch Explicit Evidence-Entity and Relationship-Evidence links if present
    entity_ev_links: Dict[str, Set[str]] = {}
    rel_ev_links: Dict[str, Set[str]] = {}

    try:
        explicit_entity_links = db.query(EvidenceEntityLink).join(Entity, Entity.id == EvidenceEntityLink.entity_id).filter(Entity.case_id == case_id).all()
        for link in explicit_entity_links:
            entity_ev_links.setdefault(link.entity_id, set()).add(link.evidence_id)
    except Exception:
        pass

    try:
        explicit_rel_links = db.query(RelationshipEvidenceLink).join(Relationship, Relationship.id == RelationshipEvidenceLink.relationship_id).filter(Relationship.case_id == case_id).all()
        for link in explicit_rel_links:
            rel_ev_links.setdefault(link.relationship_id, set()).add(link.evidence_id)
    except Exception:
        pass

    # 2. Fetch Entities
    entity_query = db.query(Entity).filter(Entity.case_id == case_id)
    if entity_types:
        entity_query = entity_query.filter(Entity.entity_type.in_([EntityType(et) for et in entity_types if et in [e.value for e in EntityType]]))
    entities = entity_query.all()

    # Scan evidence text for mentions if explicit links not fully populated
    for ent in entities:
        name_lower = ent.name.lower()
        canon_lower = (ent.canonical_name or "").lower()
        for ev in evidence_items:
            ev_text = (ev.extracted_text or "").lower() + " " + (ev.title or "").lower() + " " + (ev.description or "").lower()
            if (name_lower and name_lower in ev_text) or (canon_lower and canon_lower in ev_text):
                entity_ev_links.setdefault(ent.id, set()).add(ev.id)

    # 3. Build Entity Graph Nodes
    for ent in entities:
        node_id = ent.id
        node_id_set.add(node_id)
        linked_ev_ids = list(entity_ev_links.get(ent.id, set()))
        linked_ev_titles = [evidence_map[eid].title for eid in linked_ev_ids if eid in evidence_map]

        # Determine entity emergence timestamp (from attributes, linked evidence, or creation)
        entity_ts = None
        if ent.attributes_json and ("timestamp" in ent.attributes_json or "event_timestamp" in ent.attributes_json):
            entity_ts = ent.attributes_json.get("timestamp") or ent.attributes_json.get("event_timestamp")
        elif linked_ev_ids:
            linked_timestamps = [
                evidence_map[eid].event_timestamp.isoformat()
                for eid in linked_ev_ids
                if eid in evidence_map and evidence_map[eid].event_timestamp
            ]
            if linked_timestamps:
                entity_ts = min(linked_timestamps)
        if not entity_ts and ent.created_at:
            entity_ts = ent.created_at.isoformat()

        nodes.append(GraphNode(
            id=node_id,
            label=ent.canonical_name or ent.name,
            type=ent.entity_type.value,
            quality_score=ent.confidence_score,
            linked_evidence_ids=linked_ev_ids,
            linked_evidence_titles=linked_ev_titles,
            properties={
                "name": ent.name,
                "canonical_name": ent.canonical_name,
                "confidence_score": ent.confidence_score,
                "entity_type": ent.entity_type.value,
                "evidence_count": len(linked_ev_ids),
                "timestamp": entity_ts,
                **(ent.attributes_json or {})
            }
        ))

    # 4. Build Evidence Graph Nodes
    for ev in evidence_items:
        score_obj = evidence_scores.get(ev.id)
        overall_score = score_obj.overall_quality_score if score_obj else 0.50

        # Apply min_quality_score filter if requested
        if min_quality_score is not None and overall_score < min_quality_score:
            continue

        ev_node_id = f"evidence_{ev.id}"
        node_id_set.add(ev_node_id)
        ev_ts = ev.event_timestamp.isoformat() if ev.event_timestamp else (ev.created_at.isoformat() if ev.created_at else None)

        nodes.append(GraphNode(
            id=ev_node_id,
            label=ev.title,
            type="evidence",
            quality_score=overall_score,
            linked_evidence_ids=[ev.id],
            linked_evidence_titles=[ev.title],
            properties={
                "source_type": ev.source_type.value,
                "overall_quality_score": overall_score,
                "sha256_hash": ev.sha256_hash,
                "integrity_status": ev.integrity_status.value if hasattr(ev.integrity_status, 'value') else str(ev.integrity_status),
                "reliability": score_obj.source_reliability_score if score_obj else 0.4,
                "freshness": score_obj.temporal_freshness_score if score_obj else 0.5,
                "corroboration": score_obj.cross_corroboration_score if score_obj else 0.3,
                "completeness": score_obj.data_quality_score if score_obj else 0.5,
                "timestamp": ev_ts,
                **(ev.metadata_json or {})
            }
        ))

        # Synthesize MENTIONED_IN edges linking Evidence -> Entities
        ev_text = (ev.extracted_text or "").lower()
        for ent in entities:
            if ent.id in entity_ev_links.get(ent.id, set()) and ev.id in entity_ev_links.get(ent.id, set()):
                edges.append(GraphEdge(
                    id=f"mention_{ev.id}_{ent.id}",
                    source=ev_node_id,
                    target=ent.id,
                    label="MENTIONED_IN",
                    weight=overall_score,
                    confidence=ent.confidence_score,
                    linked_evidence_ids=[ev.id],
                    linked_evidence_titles=[ev.title],
                    properties={"weight": overall_score, "confidence": ent.confidence_score}
                ))

    # 5. Fetch and Build Explicit Entity-to-Entity Relationships
    relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()
    for rel in relationships:
        if rel.source_entity_id in node_id_set and rel.target_entity_id in node_id_set:
            # Aggregate linked evidence for this relationship
            linked_ev_ids = list(rel_ev_links.get(rel.id, set()))
            # If no explicit links, inherit common evidence from source & target entities
            if not linked_ev_ids:
                src_ev = entity_ev_links.get(rel.source_entity_id, set())
                tgt_ev = entity_ev_links.get(rel.target_entity_id, set())
                common_ev = src_ev.intersection(tgt_ev)
                linked_ev_ids = list(common_ev if common_ev else (src_ev.union(tgt_ev)))

            linked_ev_titles = [evidence_map[eid].title for eid in linked_ev_ids if eid in evidence_map]

            edges.append(GraphEdge(
                id=rel.id,
                source=rel.source_entity_id,
                target=rel.target_entity_id,
                label=rel.relationship_type.value,
                weight=rel.weight,
                confidence=rel.confidence_score,
                linked_evidence_ids=linked_ev_ids,
                linked_evidence_titles=linked_ev_titles,
                properties={
                    "weight": rel.weight,
                    "confidence_score": rel.confidence_score,
                    "evidence_count": len(linked_ev_ids),
                    **(rel.attributes_json or {})
                }
            ))

    return GraphData(nodes=nodes, edges=edges)

def get_case_graph_stats(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Computes key topological and descriptive graph metrics for a case.
    """
    graph = build_case_graph(db, case_id)
    node_count = len(graph.nodes)
    edge_count = len(graph.edges)

    type_counts: Dict[str, int] = {}
    for node in graph.nodes:
        type_counts[node.type] = type_counts.get(node.type, 0) + 1

    edge_label_counts: Dict[str, int] = {}
    for edge in graph.edges:
        edge_label_counts[edge.label] = edge_label_counts.get(edge.label, 0) + 1

    density = 0.0
    if node_count > 1:
        density = round((2.0 * edge_count) / (node_count * (node_count - 1)), 4)

    avg_degree = round((2.0 * edge_count) / node_count, 2) if node_count > 0 else 0.0

    return {
        "total_nodes": node_count,
        "total_edges": edge_count,
        "node_counts_by_type": type_counts,
        "edge_counts_by_predicate": edge_label_counts,
        "density": density,
        "average_degree": avg_degree
    }

def sync_case_to_neo4j(db: Session, case_id: str) -> Dict[str, Any]:
    """
    Pushes relational case graph state into Neo4j graph database.
    """
    graph_data = build_case_graph(db, case_id)
    return neo4j_client.sync_graph(
        case_id=case_id,
        nodes=[n.model_dump() for n in graph_data.nodes],
        edges=[e.model_dump() for e in graph_data.edges]
    )
