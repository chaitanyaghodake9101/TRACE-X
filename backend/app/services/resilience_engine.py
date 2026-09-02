import random
from datetime import datetime
from typing import Dict, Any, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from app.models.case import Case
from app.models.entity import Entity, Relationship
from app.models.evidence import Evidence, IntegrityStatus
from app.models.resilience import ResilienceTestRun, ResilienceNodeMetric, ResilienceMonteCarloRun
from app.services.graph_service import build_case_graph

def _calculate_betweenness_and_components(node_ids: List[str], adj: Dict[str, Set[str]]) -> Tuple[Dict[str, float], int, int]:
    """
    Computes betweenness centrality using Brandes algorithm,
    along with total connected components and largest component size.
    """
    betweenness = {n: 0.0 for n in node_ids}
    if not node_ids:
        return betweenness, 0, 0

    # Brandes algorithm for unweighted shortest paths
    for s in node_ids:
        stack = []
        predecessors: Dict[str, List[str]] = {n: [] for n in node_ids}
        sigma = {n: 0.0 for n in node_ids}
        sigma[s] = 1.0
        dist = {n: -1 for n in node_ids}
        dist[s] = 0
        queue = [s]

        while queue:
            v = queue.pop(0)
            stack.append(v)
            for w in adj.get(v, set()):
                if w not in dist:
                    continue
                # Path discovery
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                # Path counting
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    predecessors[w].append(v)

        delta = {n: 0.0 for n in node_ids}
        while stack:
            w = stack.pop()
            for v in predecessors[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w])
            if w != s:
                betweenness[w] += delta[w]

    # Normalize betweenness
    n = len(node_ids)
    if n > 2:
        norm_factor = 2.0 / ((n - 1) * (n - 2))
        for k in betweenness:
            betweenness[k] = round(betweenness[k] * norm_factor, 4)

    # Connected components search (BFS)
    visited: Set[str] = set()
    component_sizes: List[int] = []
    for node in node_ids:
        if node not in visited:
            comp_size = 0
            q = [node]
            visited.add(node)
            while q:
                curr = q.pop(0)
                comp_size += 1
                for neighbor in adj.get(curr, set()):
                    if neighbor in adj and neighbor not in visited:
                        visited.add(neighbor)
                        q.append(neighbor)
            component_sizes.append(comp_size)

    total_components = len(component_sizes)
    largest_component = max(component_sizes) if component_sizes else 0

    return betweenness, total_components, largest_component

def run_resilience_test(
    db: Session,
    case_id: str,
    user_id: str,
    test_type: str = "node_removal",
    target_entity_ids: Optional[List[str]] = None,
    removal_fraction: float = 0.2,
    simulate_compromised_cascade: bool = False
) -> Dict[str, Any]:
    """
    Stress-tests the case evidentiary graph topology and calculates node stability.
    Classifies nodes as STABLE, SENSITIVE, or FRAGILE (Single Point of Failure).
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    # Fetch entities and relationships
    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()
    entity_map = {e.id: e for e in entities}

    node_ids = list(entity_map.keys())
    adj: Dict[str, Set[str]] = {n: set() for n in node_ids}
    for rel in relationships:
        if rel.source_entity_id in adj and rel.target_entity_id in adj:
            adj[rel.source_entity_id].add(rel.target_entity_id)
            adj[rel.target_entity_id].add(rel.source_entity_id)

    # 1. Baseline calculation
    base_betweenness, base_comps, base_largest = _calculate_betweenness_and_components(node_ids, adj)
    total_edges = sum(len(neighbors) for neighbors in adj.values()) // 2
    n_nodes = len(node_ids)
    baseline_density = round((2.0 * total_edges) / (n_nodes * (n_nodes - 1)), 4) if n_nodes > 1 else 0.0

    # 2. Determine nodes to perturb/remove
    perturbed_nodes: Set[str] = set()
    if simulate_compromised_cascade:
        # Find entities linked only to compromised evidence
        compromised_ev = db.query(Evidence).filter(
            Evidence.case_id == case_id,
            Evidence.integrity_status == IntegrityStatus.COMPROMISED
        ).all()
        for ev in compromised_ev:
            ev_text = (ev.extracted_text or "").lower()
            for ent in entities:
                if ent.name.lower() in ev_text:
                    perturbed_nodes.add(ent.id)

    if target_entity_ids:
        perturbed_nodes.update(target_entity_ids)
    elif not perturbed_nodes:
        # Select top betweenness nodes or random fraction
        sorted_by_cent = sorted(node_ids, key=lambda x: base_betweenness.get(x, 0.0), reverse=True)
        count_to_remove = max(1, int(len(node_ids) * removal_fraction))
        perturbed_nodes.update(sorted_by_cent[:count_to_remove])

    # 3. Build perturbed stress graph
    stress_node_ids = [n for n in node_ids if n not in perturbed_nodes]
    stress_adj: Dict[str, Set[str]] = {n: set() for n in stress_node_ids}
    for u in stress_node_ids:
        for v in adj.get(u, set()):
            if v in stress_adj:
                stress_adj[u].add(v)

    stress_betweenness, stress_comps, stress_largest = _calculate_betweenness_and_components(stress_node_ids, stress_adj)
    stress_edges = sum(len(neighbors) for neighbors in stress_adj.values()) // 2
    n_stress = len(stress_node_ids)
    stress_density = round((2.0 * stress_edges) / (n_stress * (n_stress - 1)), 4) if n_stress > 1 else 0.0
    density_delta = round(stress_density - baseline_density, 4)

    # Fragmentation index: ratio of nodes detached from largest component
    fragmentation_index = round(1.0 - (stress_largest / n_nodes), 3) if n_nodes > 0 else 0.0

    # 4. Classify nodes
    fragile_count = 0
    sensitive_count = 0
    stable_count = 0
    node_metrics_list: List[Dict[str, Any]] = []

    for ent_id in node_ids:
        ent = entity_map[ent_id]
        b_base = base_betweenness.get(ent_id, 0.0)
        b_stress = stress_betweenness.get(ent_id, 0.0)
        
        shift_pct = round(abs(b_stress - b_base) / (b_base + 0.001) * 100, 1)

        # Stability criteria
        if ent_id in perturbed_nodes or shift_pct > 45.0 or (b_base > 0.15 and len(adj.get(ent_id, set())) <= 2):
            classification = "FRAGILE"
            is_spof = 1 if (ent_id in perturbed_nodes and stress_comps > base_comps) else 0
            fragile_count += 1
            impact_score = round(min(1.0, 0.5 + (shift_pct / 100.0)), 2)
            explanation = f"Critical structural bottleneck. Removal causes network partition or >45% betweenness shift ({shift_pct}% shift)."
        elif shift_pct >= 15.0:
            classification = "SENSITIVE"
            is_spof = 0
            sensitive_count += 1
            impact_score = round(min(1.0, 0.3 + (shift_pct / 100.0)), 2)
            explanation = f"Moderate structural sensitivity. Local path rerouting observed ({shift_pct}% shift)."
        else:
            classification = "STABLE"
            is_spof = 0
            stable_count += 1
            impact_score = round(max(0.1, shift_pct / 100.0), 2)
            explanation = f"Resilient entity with redundant connection pathways ({shift_pct}% shift)."

        node_metrics_list.append({
            "entity_id": ent_id,
            "entity_name": ent.name,
            "entity_type": ent.entity_type.value,
            "baseline_betweenness": b_base,
            "stress_betweenness": b_stress,
            "centrality_shift_percent": shift_pct,
            "stability_classification": classification,
            "is_single_point_of_failure": is_spof,
            "disruption_impact_score": impact_score,
            "explanation": explanation
        })

    # 5. Persist run and metrics
    run_record = ResilienceTestRun(
        case_id=case_id,
        test_type=test_type,
        parameters_json={
            "target_entity_ids": list(perturbed_nodes),
            "removal_fraction": removal_fraction,
            "simulate_compromised_cascade": simulate_compromised_cascade
        },
        created_by=user_id,
        total_nodes_evaluated=n_nodes,
        baseline_density=baseline_density,
        stress_density=stress_density,
        density_delta=density_delta,
        fragmentation_index=fragmentation_index,
        fragile_node_count=fragile_count,
        sensitive_node_count=sensitive_count,
        stable_node_count=stable_count,
        summary_report_json={
            "baseline_components": base_comps,
            "stress_components": stress_comps,
            "perturbed_nodes_count": len(perturbed_nodes),
            "network_resilience_rating": "CRITICAL_RISK" if fragmentation_index > 0.4 else "MODERATE" if fragmentation_index > 0.2 else "ROBUST"
        },
        created_at=datetime.utcnow()
    )
    db.add(run_record)
    db.commit()
    db.refresh(run_record)

    for nm in node_metrics_list:
        metric_rec = ResilienceNodeMetric(
            run_id=run_record.id,
            entity_id=nm["entity_id"],
            entity_name=nm["entity_name"],
            entity_type=nm["entity_type"],
            baseline_betweenness=nm["baseline_betweenness"],
            stress_betweenness=nm["stress_betweenness"],
            centrality_shift_percent=nm["centrality_shift_percent"],
            stability_classification=nm["stability_classification"],
            is_single_point_of_failure=nm["is_single_point_of_failure"],
            disruption_impact_score=nm["disruption_impact_score"],
            explanation=nm["explanation"]
        )
        db.add(metric_rec)
    db.commit()

    return {
        "run_id": run_record.id,
        "case_id": case_id,
        "test_type": test_type,
        "baseline_density": baseline_density,
        "stress_density": stress_density,
        "density_delta": density_delta,
        "fragmentation_index": fragmentation_index,
        "fragile_count": fragile_count,
        "sensitive_count": sensitive_count,
        "stable_count": stable_count,
        "node_metrics": node_metrics_list,
        "summary": run_record.summary_report_json
    }

def run_monte_carlo_resilience(
    db: Session,
    case_id: str,
    seed: int = 42,
    iterations: int = 50,
    perturbation_rate: float = 0.15
) -> Dict[str, Any]:
    """
    Executes seeded, deterministic Monte Carlo permutations on the evidence graph topology.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case {case_id} not found")

    entities = db.query(Entity).filter(Entity.case_id == case_id).all()
    relationships = db.query(Relationship).filter(Relationship.case_id == case_id).all()
    node_ids = [e.id for e in entities]
    
    if len(node_ids) < 2:
        return {
            "id": "mc_insufficient_nodes",
            "case_id": case_id,
            "seed": seed,
            "iterations": 0,
            "perturbation_rate": perturbation_rate,
            "mean_fragmentation": 0.0,
            "critical_bridges_json": [],
            "results_summary_json": {"message": "Insufficient nodes for Monte Carlo simulation"},
            "created_at": datetime.utcnow()
        }

    adj: Dict[str, Set[str]] = {n: set() for n in node_ids}
    for rel in relationships:
        if rel.source_entity_id in adj and rel.target_entity_id in adj:
            adj[rel.source_entity_id].add(rel.target_entity_id)
            adj[rel.target_entity_id].add(rel.source_entity_id)

    rng = random.Random(seed)
    fragmentation_scores: List[float] = []
    bridge_disruption_counts: Dict[str, int] = {n: 0 for n in node_ids}

    for _ in range(iterations):
        sample_size = max(1, int(len(node_ids) * perturbation_rate))
        perturbed = set(rng.sample(node_ids, sample_size))
        
        stress_nodes = [n for n in node_ids if n not in perturbed]
        stress_adj = {n: (adj[n] - perturbed) for n in stress_nodes}
        
        _, _, largest_comp = _calculate_betweenness_and_components(stress_nodes, stress_adj)
        frag = round(1.0 - (largest_comp / len(node_ids)), 3)
        fragmentation_scores.append(frag)

        if frag > 0.35:
            for p in perturbed:
                bridge_disruption_counts[p] += 1

    mean_frag = round(sum(fragmentation_scores) / len(fragmentation_scores), 3) if fragmentation_scores else 0.0

    critical_bridges = [
        {"entity_id": nid, "entity_name": next((e.name for e in entities if e.id == nid), nid), "criticality_score": round(count / max(1, iterations), 2)}
        for nid, count in bridge_disruption_counts.items()
        if count > 0
    ]
    critical_bridges.sort(key=lambda x: x["criticality_score"], reverse=True)

    mc_record = ResilienceMonteCarloRun(
        case_id=case_id,
        seed=seed,
        iterations=iterations,
        perturbation_rate=perturbation_rate,
        mean_fragmentation=mean_frag,
        critical_bridges_json=critical_bridges,
        results_summary_json={
            "min_fragmentation": min(fragmentation_scores) if fragmentation_scores else 0.0,
            "max_fragmentation": max(fragmentation_scores) if fragmentation_scores else 0.0,
            "mean_fragmentation": mean_frag,
            "critical_bridge_count": len(critical_bridges)
        },
        created_at=datetime.utcnow()
    )
    db.add(mc_record)
    db.commit()
    db.refresh(mc_record)

    return {
        "id": mc_record.id,
        "case_id": case_id,
        "seed": seed,
        "iterations": iterations,
        "perturbation_rate": perturbation_rate,
        "mean_fragmentation": mean_frag,
        "critical_bridges_json": critical_bridges,
        "results_summary_json": mc_record.results_summary_json,
        "created_at": mc_record.created_at
    }
