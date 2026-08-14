"""Update LinkedIn URL to company page

Revision ID: 020
Revises: 019
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_LINKEDIN = "https://www.linkedin.com/company/kigalirent/"


def upgrade() -> None:
    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'social'")).fetchone()
    if not row or not row[0]:
        return

    value = row[0]
    if isinstance(value, str):
        value = json.loads(value)

    value["linkedin"] = NEW_LINKEDIN
    conn.execute(
        sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'social'"),
        {"value": json.dumps(value)},
    )


def downgrade() -> None:
    pass
