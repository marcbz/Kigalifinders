"""Update service neighborhoods and add links setting

Revision ID: 005
Revises: 004
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SERVICE_NEIGHBORHOODS = [
    ("Rebero", "rebero", "kicukiro"),
    ("Nyarutarama", "nyarutarama", "gasabo"),
    ("Kibagabaga", "kibagabaga", "gasabo"),
    ("Kiyovu", "kiyovu", "nyarugenge"),
    ("Gisozi", "gisozi", "gasabo"),
    ("Remera", "remera", "gasabo"),
    ("Gacuriro", "gacuriro", "gasabo"),
    ("Kacyiru", "kacyiru", "gasabo"),
    ("Kimihurura", "kimihurura", "gasabo"),
    ("Kagarama", "kagarama", "kicukiro"),
    ("Bugesera", "bugesera", "bugesera"),
    ("Musanze", "musanze", "musanze"),
    ("Kimironko", "kimironko", "gasabo"),
    ("Gasabo", "gasabo", "gasabo"),
    ("Nyarugenge", "nyarugenge", "nyarugenge"),
    ("Kicukiro", "kicukiro", "kicukiro"),
]

ACTIVE_SLUGS = [slug for _, slug, _ in SERVICE_NEIGHBORHOODS]


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        text(
            """
            INSERT INTO districts (id, city_id, name, slug, property_count, is_active)
            SELECT gen_random_uuid(), c.id, 'Bugesera', 'bugesera', 0, true
            FROM cities c WHERE c.slug = 'kigali'
            ON CONFLICT (slug) DO NOTHING
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO districts (id, city_id, name, slug, property_count, is_active)
            SELECT gen_random_uuid(), c.id, 'Musanze', 'musanze', 0, true
            FROM cities c WHERE c.slug = 'kigali'
            ON CONFLICT (slug) DO NOTHING
            """
        )
    )

    for name, slug, district_slug in SERVICE_NEIGHBORHOODS:
        conn.execute(
            text(
                """
                INSERT INTO neighborhoods (id, district_id, name, slug, property_count, is_active)
                SELECT gen_random_uuid(), d.id, :name, :slug, 0, true
                FROM districts d
                WHERE d.slug = :district_slug
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    district_id = EXCLUDED.district_id,
                    is_active = true
                """
            ),
            {"name": name, "slug": slug, "district_slug": district_slug},
        )

    conn.execute(
        text("UPDATE neighborhoods SET is_active = false WHERE NOT (slug = ANY(:slugs))"),
        {"slugs": ACTIVE_SLUGS},
    )

    conn.execute(
        text(
            """
            INSERT INTO settings (id, key, value, "group", updated_at)
            VALUES (
                gen_random_uuid(),
                'links',
                '{"booking_url":"https://secure-guard.setmore.com/","book_consultation_url":"https://secure-guard.setmore.com/","phone":"+250 784 806 641","whatsapp":"250784806641"}'::jsonb,
                'site',
                NOW()
            )
            ON CONFLICT (key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DELETE FROM settings WHERE key = 'links'"))
