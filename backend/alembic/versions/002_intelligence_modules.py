"""Alembic migration for TRACE-X Intelligence Modules:
- Counterfactual Investigation Sandbox
- Network Resilience Analyzer
- Evidence Decay & Review Deadline Engine
- AI Disagreement & Minority-Evidence Panel

Revision ID: 002_intelligence_modules
Revises: 001_initial_schema
Create Date: 2026-09-02 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '002_intelligence_modules'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Simulation Branches
    op.create_table(
        'simulation_branches',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(length=50), default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 2. Simulation Evidence Overrides
    op.create_table(
        'simulation_evidence_overrides',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('branch_id', sa.String(length=36), sa.ForeignKey('simulation_branches.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('is_excluded', sa.Boolean(), default=False, nullable=False),
        sa.Column('overridden_quality_score', sa.Float(), nullable=True),
        sa.Column('overridden_reliability', sa.Float(), nullable=True),
        sa.Column('is_hypothetical', sa.Boolean(), default=False, nullable=False),
        sa.Column('hypothetical_title', sa.String(length=255), nullable=True),
        sa.Column('hypothetical_source_type', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 3. Simulation Hypothesis Deltas
    op.create_table(
        'simulation_hypothesis_deltas',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('branch_id', sa.String(length=36), sa.ForeignKey('simulation_branches.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('hypothesis_id', sa.String(length=36), sa.ForeignKey('hypotheses.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('original_normalized_score', sa.Float(), default=0.5, nullable=False),
        sa.Column('simulated_normalized_score', sa.Float(), default=0.5, nullable=False),
        sa.Column('delta_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('original_confidence_level', sa.String(length=50), default='medium', nullable=False),
        sa.Column('simulated_confidence_level', sa.String(length=50), default='medium', nullable=False),
        sa.Column('diagnostic_rationale', sa.Text(), nullable=True),
        sa.Column('calculated_at', sa.DateTime(), nullable=False),
    )

    # 4. Simulation Review Requests
    op.create_table(
        'simulation_review_requests',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('branch_id', sa.String(length=36), sa.ForeignKey('simulation_branches.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('requested_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(length=50), default='pending', index=True, nullable=False),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 5. Resilience Test Runs
    op.create_table(
        'resilience_test_runs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('test_type', sa.String(length=50), nullable=False),
        sa.Column('parameters_json', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('total_nodes_evaluated', sa.Integer(), default=0, nullable=False),
        sa.Column('baseline_density', sa.Float(), default=0.0, nullable=False),
        sa.Column('stress_density', sa.Float(), default=0.0, nullable=False),
        sa.Column('density_delta', sa.Float(), default=0.0, nullable=False),
        sa.Column('fragmentation_index', sa.Float(), default=0.0, nullable=False),
        sa.Column('fragile_node_count', sa.Integer(), default=0, nullable=False),
        sa.Column('sensitive_node_count', sa.Integer(), default=0, nullable=False),
        sa.Column('stable_node_count', sa.Integer(), default=0, nullable=False),
        sa.Column('summary_report_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 6. Resilience Node Metrics
    op.create_table(
        'resilience_node_metrics',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('run_id', sa.String(length=36), sa.ForeignKey('resilience_test_runs.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('entity_id', sa.String(length=36), index=True, nullable=False),
        sa.Column('entity_name', sa.String(length=255), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('baseline_betweenness', sa.Float(), default=0.0, nullable=False),
        sa.Column('stress_betweenness', sa.Float(), default=0.0, nullable=False),
        sa.Column('centrality_shift_percent', sa.Float(), default=0.0, nullable=False),
        sa.Column('stability_classification', sa.String(length=20), index=True, nullable=False),
        sa.Column('is_single_point_of_failure', sa.Integer(), default=0, nullable=False),
        sa.Column('disruption_impact_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
    )

    # 7. Resilience Monte Carlo Runs
    op.create_table(
        'resilience_monte_carlo_runs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('seed', sa.Integer(), nullable=False),
        sa.Column('iterations', sa.Integer(), default=100, nullable=False),
        sa.Column('perturbation_rate', sa.Float(), default=0.15, nullable=False),
        sa.Column('mean_fragmentation', sa.Float(), default=0.0, nullable=False),
        sa.Column('critical_bridges_json', sa.JSON(), nullable=False),
        sa.Column('results_summary_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 8. Review Priority Scores
    op.create_table(
        'review_priority_scores',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('temporal_urgency_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('integrity_urgency_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('volatility_score', sa.Float(), default=0.5, nullable=False),
        sa.Column('downstream_impact_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('corroboration_deficit_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('composite_urgency_score', sa.Float(), default=0.0, index=True, nullable=False),
        sa.Column('suggested_review_tier', sa.String(length=20), default='P2_ROUTINE', index=True, nullable=False),
        sa.Column('explanation_json', sa.JSON(), nullable=False),
        sa.Column('calculated_at', sa.DateTime(), nullable=False),
    )

    # 9. Review Tasks
    op.create_table(
        'review_tasks',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(length=20), default='P1', index=True, nullable=False),
        sa.Column('status', sa.String(length=30), default='pending', index=True, nullable=False),
        sa.Column('assigned_to', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )

    # 10. Review Action Logs
    op.create_table(
        'review_action_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('task_id', sa.String(length=36), sa.ForeignKey('review_tasks.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('action_taken', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 11. Disagreement Signals
    op.create_table(
        'disagreement_signals',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('dimension', sa.String(length=50), index=True, nullable=False),
        sa.Column('severity', sa.String(length=20), default='medium', index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('primary_entity_id', sa.String(length=36), index=True, nullable=True),
        sa.Column('primary_evidence_id', sa.String(length=36), index=True, nullable=True),
        sa.Column('primary_hypothesis_id', sa.String(length=36), index=True, nullable=True),
        sa.Column('signals_payload', sa.JSON(), nullable=False),
        sa.Column('recommended_reconciliation', sa.Text(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), default=False, index=True, nullable=False),
        sa.Column('resolved_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 12. Minority Evidence Items
    op.create_table(
        'minority_evidence_items',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('hypothesis_id', sa.String(length=36), sa.ForeignKey('hypotheses.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('outlier_category', sa.String(length=50), nullable=False),
        sa.Column('diagnostic_significance', sa.Float(), default=1.0, nullable=False),
        sa.Column('contradiction_target', sa.String(length=255), nullable=False),
        sa.Column('summary_rationale', sa.Text(), nullable=False),
        sa.Column('detected_at', sa.DateTime(), nullable=False),
    )

    # 13. Investigator Contestations
    op.create_table(
        'investigator_contestations',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('signal_id', sa.String(length=36), sa.ForeignKey('disagreement_signals.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('officer_id', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('contest_action', sa.String(length=50), nullable=False),
        sa.Column('justification', sa.Text(), nullable=False),
        sa.Column('adjusted_confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

def downgrade() -> None:
    op.drop_table('investigator_contestations')
    op.drop_table('minority_evidence_items')
    op.drop_table('disagreement_signals')
    op.drop_table('review_action_logs')
    op.drop_table('review_tasks')
    op.drop_table('review_priority_scores')
    op.drop_table('resilience_monte_carlo_runs')
    op.drop_table('resilience_node_metrics')
    op.drop_table('resilience_test_runs')
    op.drop_table('simulation_review_requests')
    op.drop_table('simulation_hypothesis_deltas')
    op.drop_table('simulation_evidence_overrides')
    op.drop_table('simulation_branches')
