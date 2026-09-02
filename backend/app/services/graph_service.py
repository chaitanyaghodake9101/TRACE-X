from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.entity import Entity, Relationship, EntityType
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
    Compiles a unified graph representation of a case:
    - Entity nodes (Person, Phone, Vehicle, Location, Organization, Event)
    - Evidence nodes with 4-dimensional quality scores
    - Entity-to-Entity explicit relationships
    - Evidence-to-Entity MENTIONED_IN edges linking evidence documents to extracted entities
    """
    nodes: List[GraphNode] = []
    edges: List[GraphEdge] = []
    node_id_set: Set[str] = set()

    # 1. Fetch Entities
    entity_query = db.query(Entity).filter(Entity.case_id == case_id)
    if entity_types:
        entity_query = entity_query.filter(Entity.entity_type.in_([EntityType(et) for et in entity_types if et in [e.value for e in EntityType]]))
    entities = entity_query.all()

    for ent in entities:
        node_id = ent.id
        node_id_set.add(node_id)
        nodes.append(GraphNode(
            id=node_id,
            label=ent.canonical_name or ent.name,
            type=ent.entity_type.value,
            quality_score=ent.confidence_score,
            properties={
                "name": ent.name,
                "canonical_name": ent.canonical_name,
                "confidence_score": ent.confidence_score,
                **(ent.attributes_json or {})
            }
        ))

    # 2. Fetch Evidence Items and Quality Scores
    evidence_items = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    evidence_scores = {
        s.evidence_id: s
        for s in db.query(EvidenceQualityScore).join(Evidence, Evidence.id == EvidenceQualityScore.evidence_id).filter(Evidence.case_id == case_id).all()
    }

    for ev in evidence_items:
        score_obj = evidence_scores.get(ev.id)
        overall_score = score_obj.overall_quality_score if score_obj else 0.50

        # Apply min_quality_score filter if requested
        if min_quality_score is not None and overall_score < min_quality_score:
            continue

        ev_node_id = f"evidence_{ev.id}"
        node_id_set.add(ev_node_id)

        nodes.append(GraphNode(
            id=ev_node_id,
            label=ev.title,
            type="evidence",
            quality_score=overall_score,
            properties={
                "source_type": ev.source_type.value,
                "overall_quality_score": overall_score,
                "reliability": score_obj.source_reliability_score if score_obj else 0.4,
                "freshness": score_obj.temporal_freshness_score if score_obj else 0.5,
                "corroboration": score_obj.cross_corroboration_score if score_obj else 0.3,
                "completeness": score_obj.data_quality_score if score_obj else 0.5,
                **(ev.metadata_json or {})
            }
        ))

        # 3. Synthesize MENTIONED_IN edges linking Evidence -> Entities
        ev_text = (ev.extracted_text or "").lower()
        for ent in entities:
            name_lower = ent.name.lower()
            canon_lower = (ent.canonical_name or "").lower()
            if (name_lower and name_lower in ev_text) or (canon_lower and canon_lower in ev_text):
                edges.append(GraphEdge(
                    id=f"mention_{ev.id}_{ent.id}",
                    source=ev_node_id,
                    target=ent.id,
                    label="MENTIONED_IN",
                    properties={"weight": overall_score, "confidence": ent.confidence_score}
                ))

    # 4. Fetch Explicit Entity-to-Entity Relationships
    relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()
    for rel in relationships:
        if rel.source_entity_id in node_id_set and rel.target_entity_id in node_id_set:
            edges.append(GraphEdge(
                id=rel.id,
                source=rel.source_entity_id,
                target=rel.target_entity_id,
                label=rel.relationship_type.value,
                properties={
                    "weight": rel.weight,
                    "confidence_score": rel.confidence_score,
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
    Projects relational PostgreSQL/SQLite graph data into Neo4j graph database.
    Gracefully handles offline environments.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    graph = build_case_graph(db, case_id)

    if not neo4j_client.is_connected:
        return {
            "status": "offline_fallback",
            "message": "Neo4j is currently unreachable; operational in-memory fallback active.",
            "synced_nodes": len(graph.nodes),
            "synced_edges": len(graph.edges)
        }

    try:
        neo4j_client.execute_query(
            "MERGE (c:Case {id: $case_id}) SET c.title = $title, c.case_number = $case_number",
            {"case_id": case.id, "title": case.title, "case_number": case.case_number}
        )

        for node in graph.nodes:
            neo4j_client.execute_query(
                "MERGE (n:GraphNode {id: $node_id}) SET n.label = $label, n.type = $type, n.quality_score = $quality_score, n.case_id = $case_id",
                {"node_id": node.id, "label": node.label, "type": node.type, "quality_score": node.quality_score or 0.5, "case_id": case_id}
            )

        for edge in graph.edges:
            neo4j_client.execute_query(
                "MATCH (s:GraphNode {id: $source_id}), (t:GraphNode {id: $target_id}) MERGE (s)-[r:RELATION {id: $edge_id}]->(t) SET r.label = $label, r.weight = $weight",
                {"source_id": edge.source, "target_id": edge.target, "edge_id": edge.id, "label": edge.label, "weight": edge.properties.get("weight", 1.0)}
            )

        return {
            "status": "synchronized",
            "synced_nodes": len(graph.nodes),
            "synced_edges": len(graph.edges),
            "case_id": case_id
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Neo4j sync failed: {str(e)}",
            "synced_nodes": len(graph.nodes),
            "synced_edges": len(graph.edges)
        }
