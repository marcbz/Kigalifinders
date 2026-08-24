"""Search intent sitemap + SEO control fields.

Revision ID: 027
Revises: 026
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "search_intents",
        sa.Column("sitemap_status", sa.String(length=20), nullable=False, server_default="excluded"),
    )
    op.add_column(
        "search_intents",
        sa.Column("seo_control", sa.String(length=20), nullable=False, server_default="automatic"),
    )
    op.add_column(
        "search_intents",
        sa.Column("automatic_eligibility", sa.String(length=20), nullable=False, server_default="excluded"),
    )
    op.add_column(
        "search_intents",
        sa.Column("last_evaluated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_search_intents_sitemap_status", "search_intents", ["sitemap_status"])
    op.create_index("ix_search_intents_seo_control", "search_intents", ["seo_control"])
    op.create_index("ix_search_intents_automatic_eligibility", "search_intents", ["automatic_eligibility"])

    # Backfill: indexable + enabled pages start included in sitemap; manual locks preserved
    op.execute(
        """
        UPDATE search_intents
        SET sitemap_status = CASE
              WHEN index_status = 'indexable' AND is_enabled = true THEN 'included'
              ELSE 'excluded'
            END,
            automatic_eligibility = CASE
              WHEN index_status = 'indexable' THEN 'eligible'
              ELSE 'excluded'
            END,
            seo_control = CASE
              WHEN locked_by_admin = true THEN 'manual'
              ELSE 'automatic'
            END
        """
    )


def downgrade() -> None:
    op.drop_index("ix_search_intents_automatic_eligibility", table_name="search_intents")
    op.drop_index("ix_search_intents_seo_control", table_name="search_intents")
    op.drop_index("ix_search_intents_sitemap_status", table_name="search_intents")
    op.drop_column("search_intents", "last_evaluated_at")
    op.drop_column("search_intents", "automatic_eligibility")
    op.drop_column("search_intents", "seo_control")
    op.drop_column("search_intents", "sitemap_status")
