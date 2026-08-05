"""Add show_features_table to properties

Revision ID: 010
Revises: 009
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("show_features_table", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("properties", "show_features_table", server_default=None)


def downgrade() -> None:
    op.drop_column("properties", "show_features_table")
