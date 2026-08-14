"""Update social profiles and Setmore booking URLs

Revision ID: 019
Revises: 018
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOOKING_URL = "https://kigalirent.setmore.com/"
SOCIAL = {
    "facebook": "https://facebook.com/kigalirent",
    "instagram": "https://instagram.com/kigalirent",
    "linkedin": "https://linkedin.com/kigalirent",
    "youtube": "https://youtube.com/@kigalirent",
    "tiktok": "https://www.tiktok.com/@kigalirent",
}


def _load(value):
    if value is None:
        return {}
    if isinstance(value, str):
        return json.loads(value)
    return dict(value)


def _update_json_setting(conn, key: str, patch: dict) -> None:
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = :key"), {"key": key}).fetchone()
    if not row:
        return
    value = _load(row[0])
    value.update(patch)
    conn.execute(
        sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = :key"),
        {"value": json.dumps(value), "key": key},
    )


def upgrade() -> None:
    conn = op.get_bind()
    _update_json_setting(conn, "site", {"booking_url": BOOKING_URL})
    _update_json_setting(
        conn,
        "links",
        {"booking_url": BOOKING_URL, "book_consultation_url": BOOKING_URL},
    )
    _update_json_setting(conn, "social", SOCIAL)


def downgrade() -> None:
    pass
