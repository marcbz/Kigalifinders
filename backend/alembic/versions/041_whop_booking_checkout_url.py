"""Point booking CTAs at on-site Whop checkout (/book)

Revision ID: 041
Revises: 040
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "041"
down_revision: Union[str, None] = "040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOOKING_URL = "/book"
LEGACY_SETMORE = "https://kigalirent.setmore.com/"


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
    # Rewrite any FAQ answers that still deep-link to Setmore.
    conn.execute(
        sa.text(
            """
            UPDATE faqs
            SET answer = regexp_replace(
                answer,
                'https?://[^\"''\\s<>]*setmore\\.com[^\"''\\s<>]*',
                :booking,
                'gi'
            )
            WHERE answer ~* 'setmore\\.com'
            """
        ),
        {"booking": BOOKING_URL},
    )




def downgrade() -> None:
    conn = op.get_bind()
    _update_json_setting(conn, "site", {"booking_url": LEGACY_SETMORE})
    _update_json_setting(
        conn,
        "links",
        {"booking_url": LEGACY_SETMORE, "book_consultation_url": LEGACY_SETMORE},
    )
