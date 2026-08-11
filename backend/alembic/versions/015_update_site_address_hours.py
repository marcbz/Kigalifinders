"""Update site address and business hours

Revision ID: 015
Revises: 014
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ADDRESS = "Kigali, Rwanda"
NEW_HOURS = "Mon - Sat: 9:00 AM - 5:00 PM"


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'site'")).fetchone()
    if not row or not row[0]:
        return

    value = row[0]
    if isinstance(value, str):
        value = json.loads(value)

    value["address"] = NEW_ADDRESS
    value["hours"] = NEW_HOURS
    conn.execute(
        sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'site'"),
        {"value": json.dumps(value)},
    )


def downgrade() -> None:
    pass
