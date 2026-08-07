"""Point hero background to optimized local image

Revision ID: 014
Revises: 013
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OPTIMIZED_HERO_IMAGE = "/images/hero-kigali.webp"
LEGACY_PATTERNS = ("talosluxuryvillas.com", "/29.jpg")


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'hero'")).fetchone()
    if not row or not row[0]:
        return

    value = row[0]
    if isinstance(value, str):
        value = json.loads(value)

    background_image = str(value.get("background_image", ""))
    if any(pattern in background_image for pattern in LEGACY_PATTERNS):
        value["background_image"] = OPTIMIZED_HERO_IMAGE
        conn.execute(
            sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'hero'"),
            {"value": json.dumps(value)},
        )


def downgrade() -> None:
    pass
