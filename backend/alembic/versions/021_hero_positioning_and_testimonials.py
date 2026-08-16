"""Update hero positioning and Kigalifinders testimonials

Revision ID: 021
Revises: 020
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'hero'")).fetchone()
    if row and row[0]:
        value = row[0]
        if isinstance(value, str):
            value = json.loads(value)
        value["tagline"] = "KIGALI'S #1 RENTAL AND PROPERTY MARKETPLACE"
        value["subtitle"] = (
            "We know what housing costs in Kigali, where to live, what neighborhoods are like, and what is actually available."
        )
        conn.execute(
            sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'hero'"),
            {"value": json.dumps(value)},
        )

    conn.execute(
        sa.text(
            "UPDATE testimonials SET content = replace(content, 'Kigalifinders', 'Kigali Rent') "
            "WHERE content LIKE '%Kigalifinders%'"
        )
    )


def downgrade() -> None:
    pass
