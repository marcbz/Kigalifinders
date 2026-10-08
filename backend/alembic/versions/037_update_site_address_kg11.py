"""Update site address to KG 11 Ave, Kigali and pin the office plus code

Revision ID: 037
Revises: 036
Create Date: 2026-10-08
"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "037"
down_revision: Union[str, None] = "036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ADDRESS = "KG 11 Ave, Kigali"
OLD_ADDRESS = "Kigali, Rwanda"
# Centre of plus code 342G+G8 Kigali (6GCG342G+G8), the Google Business Profile pin.
OFFICE_LATITUDE = -1.9486875
OFFICE_LONGITUDE = 30.1258125


def _update_site(**fields) -> None:
    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'site'")).fetchone()
    if not row or not row[0]:
        return

    value = row[0]
    if isinstance(value, str):
        value = json.loads(value)

    for key, field_value in fields.items():
        if field_value is None:
            value.pop(key, None)
        else:
            value[key] = field_value
    conn.execute(
        sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'site'"),
        {"value": json.dumps(value)},
    )


def upgrade() -> None:
    _update_site(address=NEW_ADDRESS, latitude=OFFICE_LATITUDE, longitude=OFFICE_LONGITUDE)


def downgrade() -> None:
    _update_site(address=OLD_ADDRESS, latitude=None, longitude=None)
