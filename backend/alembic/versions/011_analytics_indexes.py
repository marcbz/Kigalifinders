"""Alembic chain stub (analytics indexes removed)

Revision ID: 011
Revises: 010
"""
from typing import Sequence, Union

from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Analytics feature was removed; this revision is kept so Render/Alembic
    # can resolve databases that already recorded revision 011.
    pass


def downgrade() -> None:
    pass
