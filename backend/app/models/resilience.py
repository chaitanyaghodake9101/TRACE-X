import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class ResilienceTestRun(Base):
    """
    Stress-testing evaluation of the case graph topology under simulated disruptions.
    """
    __tablename__ = "resilience_test_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    test_type = Column(String(50), nullable=False) # 'node_removal', 'edge_removal', 'integrity_cascade', 'monte_carlo'
    parameters_json = Column(JSON, default=dict, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # Topology Stress Metrics
    total_nodes_evaluated = Column(Integer, default=0, nullable=False)
    baseline_density = Column(Float, default=0.0, nullable=False)
    stress_density = Column(Float, default=0.0, nullable=False)
    density_delta = Column(Float, default=0.0, nullable=False)
    fragmentation_index = Column(Float, default=0.0, nullable=False) # 0 = fully connected, 1 = completely shattered
    fragile_node_count = Column(Integer, default=0, nullable=False)
    sensitive_node_count = Column(Integer, default=0, nullable=False)
    stable_node_count = Column(Integer, default=0, nullable=False)
    summary_report_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="resilience_test_runs")
    creator = relationship("User", foreign_keys=[created_by])
    node_metrics = relationship("ResilienceNodeMetric", back_populates="run", cascade="all, delete-orphan")


class ResilienceNodeMetric(Base):
    """
    Individual entity stability score & betweenness centrality delta under stress.
    """
    __tablename__ = "resilience_node_metrics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String(36), ForeignKey("resilience_test_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)
    entity_name = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False)
    
    baseline_betweenness = Column(Float, default=0.0, nullable=False)
    stress_betweenness = Column(Float, default=0.0, nullable=False)
    centrality_shift_percent = Column(Float, default=0.0, nullable=False)
    stability_classification = Column(String(20), nullable=False, index=True) # 'STABLE', 'SENSITIVE', 'FRAGILE'
    is_single_point_of_failure = Column(Integer, default=0, nullable=False) # 1 = true, 0 = false
    disruption_impact_score = Column(Float, default=0.0, nullable=False)
    explanation = Column(Text, nullable=True)

    # Relationships
    run = relationship("ResilienceTestRun", back_populates="node_metrics")


class ResilienceMonteCarloRun(Base):
    """
    Deterministic seeded Monte Carlo simulation for multi-perturbation graph resilience.
    """
    __tablename__ = "resilience_monte_carlo_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    seed = Column(Integer, nullable=False)
    iterations = Column(Integer, default=100, nullable=False)
    perturbation_rate = Column(Float, default=0.15, nullable=False) # fraction of edges/nodes perturbed
    mean_fragmentation = Column(Float, default=0.0, nullable=False)
    critical_bridges_json = Column(JSON, default=list, nullable=False)
    results_summary_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="resilience_monte_carlo_runs")
