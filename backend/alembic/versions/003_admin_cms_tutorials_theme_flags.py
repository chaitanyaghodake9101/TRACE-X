"""Alembic migration for TRACE-X Extended Administration & CMS Modules:
- Officer Profiles, Status History, Role History, Case Memberships
- Content CMS (Pages & Version Snapshots)
- Interactive Tutorials & User Progress
- Theme Configurations, Version History & User Theme Preferences
- Feature Flags Management

Revision ID: 003_admin_cms_tutorials_theme_flags
Revises: 002_intelligence_modules
Create Date: 2026-09-02 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '003_admin_cms_tutorials_theme_flags'
down_revision = '002_intelligence_modules'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Officer Profiles
    op.create_table(
        'officer_profiles',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=True),
        sa.Column('district', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('rank', sa.String(length=50), nullable=True),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 2. Officer Status History
    op.create_table(
        'officer_status_history',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('previous_status', sa.Boolean(), nullable=False),
        sa.Column('new_status', sa.Boolean(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=False),
    )

    # 3. Officer Role History
    op.create_table(
        'officer_role_history',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('previous_role', sa.String(length=50), nullable=False),
        sa.Column('new_role', sa.String(length=50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=False),
    )

    # 4. Case Memberships
    op.create_table(
        'case_memberships',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('case_id', sa.String(length=36), sa.ForeignKey('cases.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('assignment_role', sa.String(length=50), default='investigator', nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('assigned_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
    )

    # 5. Content Pages
    op.create_table(
        'content_pages',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('slug', sa.String(length=100), unique=True, index=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('body_markdown', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), default='draft', index=True, nullable=False),
        sa.Column('current_version', sa.Integer(), default=1, nullable=False),
        sa.Column('author_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 6. Content Page Versions
    op.create_table(
        'content_page_versions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('page_id', sa.String(length=36), sa.ForeignKey('content_pages.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('body_markdown', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), default='draft', nullable=False),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('change_summary', sa.String(length=255), nullable=True),
    )

    # 7. Tutorials
    op.create_table(
        'tutorials',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), index=True, nullable=False),
        sa.Column('video_url', sa.String(length=500), nullable=True),
        sa.Column('youtube_id', sa.String(length=50), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), default=5, nullable=False),
        sa.Column('order_index', sa.Integer(), default=0, nullable=False),
        sa.Column('is_published', sa.Boolean(), default=True, index=True, nullable=False),
        sa.Column('steps_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 8. Tutorial Progress
    op.create_table(
        'tutorial_progress',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('tutorial_id', sa.String(length=36), sa.ForeignKey('tutorials.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('completed', sa.Boolean(), default=False, nullable=False),
        sa.Column('last_step_index', sa.Integer(), default=0, nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 9. Theme Configurations
    op.create_table(
        'theme_configurations',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('primary_color', sa.String(length=20), default='#06b6d4', nullable=False),
        sa.Column('accent_color', sa.String(length=20), default='#3b82f6', nullable=False),
        sa.Column('background_mode', sa.String(length=20), default='slate', nullable=False),
        sa.Column('font_family', sa.String(length=50), default='Inter', nullable=False),
        sa.Column('border_radius', sa.String(length=20), default='0.75rem', nullable=False),
        sa.Column('is_active', sa.Boolean(), default=False, index=True, nullable=False),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('custom_css_vars', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 10. Theme Versions
    op.create_table(
        'theme_versions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('theme_id', sa.String(length=36), sa.ForeignKey('theme_configurations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('config_json', sa.JSON(), nullable=False),
        sa.Column('change_notes', sa.String(length=255), nullable=True),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # 11. User Theme Preferences
    op.create_table(
        'user_theme_preferences',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),
        sa.Column('theme_id', sa.String(length=36), sa.ForeignKey('theme_configurations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('mode_override', sa.String(length=20), nullable=True),
        sa.Column('custom_overrides_json', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # 12. Feature Flags
    op.create_table(
        'feature_flags',
        sa.Column('key', sa.String(length=100), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), default=False, index=True, nullable=False),
        sa.Column('category', sa.String(length=50), default='admin', nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )

def downgrade() -> None:
    op.drop_table('feature_flags')
    op.drop_table('user_theme_preferences')
    op.drop_table('theme_versions')
    op.drop_table('theme_configurations')
    op.drop_table('tutorial_progress')
    op.drop_table('tutorials')
    op.drop_table('content_page_versions')
    op.drop_table('content_pages')
    op.drop_table('case_memberships')
    op.drop_table('officer_role_history')
    op.drop_table('officer_status_history')
    op.drop_table('officer_profiles')
