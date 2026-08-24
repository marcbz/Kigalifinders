"""External market source control plane and collection runs.

Revision ID: 026
Revises: 025
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "external_market_sources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=True),
        sa.Column("robots_url", sa.String(length=500), nullable=True),
        sa.Column("preferred_ingest", sa.String(length=20), nullable=False, server_default="csv"),
        sa.Column("collection_method", sa.String(length=20), nullable=False, server_default="csv"),
        sa.Column("policy_status", sa.String(length=40), nullable=False, server_default="not_reviewed"),
        sa.Column("policy_notes", sa.Text(), nullable=True),
        sa.Column("robots_summary", sa.Text(), nullable=True),
        sa.Column("robots_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("automated_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("listing_adapter_ready", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_crawl_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_import_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("consecutive_errors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("observation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", name="uq_external_market_sources_source_id"),
    )
    op.create_index("ix_external_market_sources_source_id", "external_market_sources", ["source_id"])

    op.create_table(
        "external_collection_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="queued"),
        sa.Column("mode", sa.String(length=40), nullable=False, server_default="selected"),
        sa.Column("source_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("current_source_id", sa.String(length=80), nullable=True),
        sa.Column("progress", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("observations_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("observations_new", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("observations_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_external_collection_runs_status", "external_collection_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_external_collection_runs_status", table_name="external_collection_runs")
    op.drop_table("external_collection_runs")
    op.drop_index("ix_external_market_sources_source_id", table_name="external_market_sources")
    op.drop_table("external_market_sources")
