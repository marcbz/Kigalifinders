"""Private admin redirect links and click tracking.

Revision ID: 029
Revises: 028
Create Date: 2026-08-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "redirect_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("destination_url", sa.String(length=2000), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("clicks_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_redirect_links_slug", "redirect_links", ["slug"], unique=True)

    op.create_table(
        "redirect_clicks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("redirect_link_id", UUID(as_uuid=True), sa.ForeignKey("redirect_links.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("country", sa.String(length=80), nullable=True),
        sa.Column("region", sa.String(length=120), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("referer", sa.String(length=1000), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_redirect_clicks_redirect_link_id", "redirect_clicks", ["redirect_link_id"])
    op.create_index("ix_redirect_clicks_clicked_at", "redirect_clicks", ["clicked_at"])


def downgrade() -> None:
    op.drop_index("ix_redirect_clicks_clicked_at", table_name="redirect_clicks")
    op.drop_index("ix_redirect_clicks_redirect_link_id", table_name="redirect_clicks")
    op.drop_table("redirect_clicks")
    op.drop_index("ix_redirect_links_slug", table_name="redirect_links")
    op.drop_table("redirect_links")
