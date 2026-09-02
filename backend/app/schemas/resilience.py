from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class ResilienceRunRequest(BaseModel):
    test_type: str = "node_removal" # 'node_removal', 'edge_removal', 'integrity_cascade'
    target_entity_ids: Optional[List[str]] = None
    removal_fraction: Optional[float] = Field(0.2, ge=0.0, le=1.0)
    simulate_compromised_cascade: bool = False

class ResilienceNodeMetricResponse(BaseModel):
    id: str
    entity_id: str
    entity_name: str
    entity_type: str
    baseline_betweenness: float
    stress_betweenness: float
    centrality_shift_percent: float
    stability_classification: str # 'STABLE', 'SENSITIVE', 'FRAGILE'
    is_single_point_of_failure: int
    disruption_impact_score: float
    explanation: Optional[str] = None

    class Config:
        from_attributes = True

class ResilienceTestRunResponse(BaseModel):
    id: str
    case_id: str
    test_type: str
    parameters_json: Dict[str, Any]
    created_by: str
    total_nodes_evaluated: int
    baseline_density: float
    stress_density: float
    density_delta: float
    fragmentation_index: float
    fragile_node_count: int
    sensitive_node_count: int
    stable_node_count: int
    summary_report_json: Dict[str, Any]
    created_at: datetime
    node_metrics: List[ResilienceNodeMetricResponse] = []

    class Config:
        from_attributes = True

class ResilienceMonteCarloRequest(BaseModel):
    seed: Optional[int] = 42
    iterations: Optional[int] = Field(50, ge=10, le=500)
    perturbation_rate: Optional[float] = Field(0.15, ge=0.01, le=0.5)

class ResilienceMonteCarloResponse(BaseModel):
    id: str
    case_id: str
    seed: int
    iterations: int
    perturbation_rate: float
    mean_fragmentation: float
    critical_bridges_json: List[Dict[str, Any]]
    results_summary_json: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
