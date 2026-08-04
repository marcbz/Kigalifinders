"""Update testimonial avatar images

Revision ID: 007
Revises: 006
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AVATARS = {
    "Aline Mukamana": "https://images.unsplash.com/photo-1573497019940-1c056c886f2e?w=200&h=200&fit=crop&crop=face",
    "James Carter": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face",
    "Patrick Niyonzima": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&h=200&fit=crop&crop=face",
}


def upgrade() -> None:
    conn = op.get_bind()
    for name, url in AVATARS.items():
        conn.execute(
            text("UPDATE testimonials SET avatar_url = :url WHERE name = :name"),
            {"name": name, "url": url},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for name in AVATARS:
        conn.execute(
            text("UPDATE testimonials SET avatar_url = NULL WHERE name = :name"),
            {"name": name},
        )
