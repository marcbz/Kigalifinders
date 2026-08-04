"""Sync Kigali service neighborhoods

Revision ID: 004
Revises: 003
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SERVICE_AREAS = [
    ("Nyarutarama", "nyarutarama", "gasabo"),
    ("Kiyovu", "kiyovu", "nyarugenge"),
    ("Gacuriro", "gacuriro", "gasabo"),
    ("Kibagabaga", "kibagabaga", "gasabo"),
    ("Kimihurura", "kimihurura", "gasabo"),
    ("Rebero", "rebero", "kicukiro"),
    ("Kacyiru", "kacyiru", "gasabo"),
    ("Kagugu", "kagugu", "gasabo"),
    ("Kagarama", "kagarama", "kicukiro"),
    ("Gisozi", "gisozi", "gasabo"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for name, slug, district_slug in SERVICE_AREAS:
        conn.execute(
            text(
                """
                INSERT INTO neighborhoods (id, district_id, name, slug, property_count, is_active)
                SELECT gen_random_uuid(), d.id, :name, :slug, 0, true
                FROM districts d
                WHERE d.slug = :district_slug
                ON CONFLICT (slug) DO NOTHING
                """
            ),
            {"name": name, "slug": slug, "district_slug": district_slug},
        )


def downgrade() -> None:
    slugs = [slug for _, slug, _ in SERVICE_AREAS]
    conn = op.get_bind()
    conn.execute(
        text("DELETE FROM neighborhoods WHERE slug = ANY(:slugs)"),
        {"slugs": slugs},
    )
