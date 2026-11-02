"""Add per-listing WhatsApp number on properties

Revision ID: 038
Revises: 037
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "038"
down_revision: Union[str, None] = "037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("whatsapp", sa.String(40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("properties", "whatsapp")
