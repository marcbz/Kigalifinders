"""Add previous_price for Price reduced badges.

Revision ID: 022
Revises: 021
Create Date: 2026-08-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("previous_price", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("properties", "previous_price")
