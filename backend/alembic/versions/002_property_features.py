"""Add property feature columns

Revision ID: 002
Revises: 001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("realtor_name", sa.String(length=120), nullable=True))
    op.add_column("properties", sa.Column("has_balcony", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("properties", sa.Column("has_kitchen", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("properties", sa.Column("has_pool", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("properties", sa.Column("has_parking", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("properties", sa.Column("has_jacuzzi", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("properties", sa.Column("has_garden", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("properties", sa.Column("pets_allowed", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column("properties", "pets_allowed")
    op.drop_column("properties", "has_garden")
    op.drop_column("properties", "has_jacuzzi")
    op.drop_column("properties", "has_parking")
    op.drop_column("properties", "has_pool")
    op.drop_column("properties", "has_kitchen")
    op.drop_column("properties", "has_balcony")
    op.drop_column("properties", "realtor_name")
