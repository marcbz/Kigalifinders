"""Rename Kigalifinders to Kigali Rent in FAQ copy

Revision ID: 018
Revises: 017
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE faqs SET question = replace(question, 'Kigalifinders', 'Kigali Rent') "
            "WHERE question LIKE '%Kigalifinders%'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE faqs SET answer = replace(answer, 'Kigalifinders', 'Kigali Rent') "
            "WHERE answer LIKE '%Kigalifinders%'"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE faqs SET question = replace(question, 'Kigali Rent', 'Kigalifinders') "
            "WHERE question LIKE '%Kigali Rent%'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE faqs SET answer = replace(answer, 'Kigali Rent', 'Kigalifinders') "
            "WHERE answer LIKE '%Kigali Rent%'"
        )
    )
