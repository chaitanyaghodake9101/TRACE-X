"""Initial PostgreSQL schema for TRACE-X

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('email', sa.String(length=255), unique=True, index=True, nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 2. cases
    op.create_table(
        'cases',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_number', sa.String(length=50), unique=True, index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), default='open', nullable=False),
        sa.Column('priority', sa.String(length=50), default='medium', nullable=False),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('assigned_to', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 3. evidence
    op.create_table(
        'evidence',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=False),
        sa.Column('uploaded_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('event_timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 4. evidence_quality_scores
    op.create_table(
        'evidence_quality_scores',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),
        sa.Column('source_reliability_score', sa.Float(), nullable=False),
        sa.Column('temporal_freshness_score', sa.Float(), nullable=False),
        sa.Column('cross_corroboration_score', sa.Float(), nullable=False),
        sa.Column('data_quality_score', sa.Float(), nullable=False),
        sa.Column('overall_quality_score', sa.Float(), index=True, nullable=False),
        sa.Column('explanation_json', sa.JSON(), nullable=False),
        sa.Column('calculated_at', sa.DateTime(), nullable=False),
    )

    # 5. entities
    op.create_table(
        'entities',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('name', sa.String(length=255), index=True, nullable=False),
        sa.Column('entity_type', sa.String(length=50), index=True, nullable=False),
        sa.Column('canonical_name', sa.String(length=255), nullable=True),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=False),
        sa.Column('attributes_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 6. relationships
    op.create_table(
        'relationships',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('source_entity_id', sa.String(length=36), sa.ForeignKey('entities.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('target_entity_id', sa.String(length=36), sa.ForeignKey('entities.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('relationship_type', sa.String(length=50), index=True, nullable=False),
        sa.Column('weight', sa.Float(), default=1.0, nullable=False),
        sa.Column('confidence_score', sa.Float(), default=1.0, nullable=False),
        sa.Column('attributes_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 7. hypotheses
    op.create_table(
        'hypotheses',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(length=50), default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 8. evidence_hypothesis
    op.create_table(
        'evidence_hypothesis',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('hypothesis_id', sa.String(length=36), sa.ForeignKey('hypotheses.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.Column('relationship_strength', sa.Float(), default=1.0, nullable=False),
        sa.Column('rationale', sa.Text(), nullable=True),
        sa.Column('linked_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 9. hypothesis_scores
    op.create_table(
        'hypothesis_scores',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('hypothesis_id', sa.String(length=36), sa.ForeignKey('hypotheses.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),
        sa.Column('raw_score', sa.Float(), default=0.0, nullable=False),
        sa.Column('normalized_score', sa.Float(), default=0.5, index=True, nullable=False),
        sa.Column('confidence_level', sa.String(length=50), default='medium', nullable=False),
        sa.Column('supporting_count', sa.Integer(), default=0, nullable=False),
        sa.Column('contradicting_count', sa.Integer(), default=0, nullable=False),
        sa.Column('supporting_weight_sum', sa.Float(), default=0.0, nullable=False),
        sa.Column('contradicting_weight_sum', sa.Float(), default=0.0, nullable=False),
        sa.Column('calculated_at', sa.DateTime(), nullable=False),
    )

    # 10. investigative_actions
    op.create_table(
        'investigative_actions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('action_type', sa.String(length=50), index=True, nullable=False),
        sa.Column('status', sa.String(length=50), default='pending', index=True, nullable=False),
        sa.Column('base_gain', sa.Float(), default=0.5, nullable=False),
        sa.Column('gap_multiplier', sa.Float(), default=1.0, nullable=False),
        sa.Column('hypothesis_multiplier', sa.Float(), default=1.0, nullable=False),
        sa.Column('feasibility_multiplier', sa.Float(), default=1.0, nullable=False),
        sa.Column('expected_information_gain', sa.Float(), default=0.5, index=True, nullable=False),
        sa.Column('priority_rank', sa.Integer(), default=0, index=True, nullable=False),
        sa.Column('target_entity_id', sa.String(length=36), sa.ForeignKey('entities.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_to', sa.String(length=36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 11. action_outcomes
    op.create_table(
        'action_outcomes',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('action_id', sa.String(length=36), sa.ForeignKey('investigative_actions.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),
        sa.Column('outcome_notes', sa.Text(), nullable=True),
        sa.Column('produced_new_evidence', sa.Boolean(), default=False, nullable=False),
        sa.Column('evidence_id', sa.String(length=36), sa.ForeignKey('evidence.id', ondelete='SET NULL'), nullable=True),
        sa.Column('effectiveness_score', sa.Float(), default=1.0, nullable=False),
        sa.Column('logged_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 12. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id'), index=True, nullable=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='SET NULL'), index=True, nullable=True),
        sa.Column('action', sa.String(length=100), index=True, nullable=False),
        sa.Column('resource_type', sa.String(length=100), index=True, nullable=False),
        sa.Column('resource_id', sa.String(length=100), nullable=True),
        sa.Column('details_json', sa.JSON(), nullable=False),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('timestamp', sa.DateTime(), index=True, nullable=False),
    )

def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('action_outcomes')
    op.drop_table('investigative_actions')
    op.drop_table('hypothesis_scores')
    op.drop_table('evidence_hypothesis')
    op.drop_table('hypotheses')
    op.drop_table('relationships')
    op.drop_table('entities')
    op.drop_table('evidence_quality_scores')
    op.drop_table('evidence')
    op.drop_table('cases')
    op.drop_table('users')
