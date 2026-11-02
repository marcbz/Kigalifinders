"""Add show_availability_badge for public listing status badges

Revision ID: 039
Revises: 038
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "039"
down_revision: Union[str, None] = "038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("show_availability_badge", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Existing CRM-managed listings already show public availability badges.
    op.execute(
        sa.text("UPDATE properties SET show_availability_badge = true WHERE in_crm = true")
    )
    op.alter_column("properties", "show_availability_badge", server_default=None)


def downgrade() -> None:
    op.drop_column("properties", "show_availability_badge")
