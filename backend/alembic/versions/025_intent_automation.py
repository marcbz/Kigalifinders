"""Search intent automation fields and DISCOVERED status support.

Revision ID: 025
Revises: 024
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("search_intents", sa.Column("source", sa.String(length=40), nullable=False, server_default="manual"))
    op.add_column("search_intents", sa.Column("opportunity_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("search_intents", sa.Column("matching_observation_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("search_intents", sa.Column("last_calculated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("search_intents", sa.Column("last_content_change_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("search_intents", sa.Column("data_freshness", sa.String(length=20), nullable=False, server_default="unknown"))
    op.add_column("search_intents", sa.Column("status_reason", sa.String(length=500), nullable=True))
    op.add_column("search_intents", sa.Column("canonical_query_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "search_intents",
        sa.Column("locked_by_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "search_intents",
        sa.Column("automation_disabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_search_intents_canonical_query_hash", "search_intents", ["canonical_query_hash"])
    op.create_index("ix_search_intents_opportunity_score", "search_intents", ["opportunity_score"])
    op.create_index("ix_search_intents_source", "search_intents", ["source"])

    op.create_table(
        "intent_automation_settings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_intent_automation_settings_key"),
    )


def downgrade() -> None:
    op.drop_table("intent_automation_settings")
    op.drop_index("ix_search_intents_source", table_name="search_intents")
    op.drop_index("ix_search_intents_opportunity_score", table_name="search_intents")
    op.drop_index("ix_search_intents_canonical_query_hash", table_name="search_intents")
    op.drop_column("search_intents", "automation_disabled")
    op.drop_column("search_intents", "locked_by_admin")
    op.drop_column("search_intents", "canonical_query_hash")
    op.drop_column("search_intents", "status_reason")
    op.drop_column("search_intents", "data_freshness")
    op.drop_column("search_intents", "last_content_change_at")
    op.drop_column("search_intents", "last_calculated_at")
    op.drop_column("search_intents", "matching_observation_count")
    op.drop_column("search_intents", "opportunity_score")
    op.drop_column("search_intents", "source")
