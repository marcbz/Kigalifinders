"""Add listing_alerts for saved match preferences.

Revision ID: 023
Revises: 022
Create Date: 2026-08-22
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listing_alerts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("budget", sa.String(length=120), nullable=True),
        sa.Column("area", sa.String(length=255), nullable=True),
        sa.Column("bedrooms", sa.String(length=40), nullable=True),
        sa.Column("intent", sa.String(length=40), nullable=True),
        sa.Column("search_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_listing_alerts_email", "listing_alerts", ["email"])

    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'hero'")).fetchone()
    if row and row[0]:
        value = row[0]
        if isinstance(value, str):
            value = json.loads(value)
        value["tagline"] = "KIGALI RENTAL AND PROPERTY MARKETPLACE"
        conn.execute(
            sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'hero'"),
            {"value": json.dumps(value)},
        )


def downgrade() -> None:
    op.drop_index("ix_listing_alerts_email", table_name="listing_alerts")
    op.drop_table("listing_alerts")
