"""Refresh testimonial avatar portrait URLs

Revision ID: 008
Revises: 007
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

AVATARS = {
    "Aline Mukamana": "https://images.unsplash.com/photo-1589156191108-c762ff4b96ab?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
    "James Carter": "https://images.unsplash.com/photo-1619895862022-09114b41f16a?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
    "Patrick Niyonzima": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=faces&auto=format&q=80",
}


def upgrade() -> None:
    conn = op.get_bind()
    for name, url in AVATARS.items():
        conn.execute(
            text("UPDATE testimonials SET avatar_url = :url WHERE name = :name"),
            {"name": name, "url": url},
        )


def downgrade() -> None:
    pass
