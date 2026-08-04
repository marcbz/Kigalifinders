"""Add Nyamirambo neighborhood

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            """
            INSERT INTO neighborhoods (id, district_id, name, slug, property_count, is_active)
            SELECT gen_random_uuid(), d.id, 'Nyamirambo', 'nyamirambo', 0, true
            FROM districts d
            WHERE d.slug = 'nyarugenge'
            ON CONFLICT (slug) DO UPDATE
            SET name = EXCLUDED.name, district_id = EXCLUDED.district_id, is_active = true
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DELETE FROM neighborhoods WHERE slug = 'nyamirambo'"))
