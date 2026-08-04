"""Fix James Carter testimonial avatar URL

Revision ID: 009
Revises: 008
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JAMES_AVATAR = "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=96&h=96&fit=crop&crop=entropy&auto=format&q=80"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text("UPDATE testimonials SET avatar_url = :url WHERE name ILIKE '%James Carter%'"),
        {"url": JAMES_AVATAR},
    )


def downgrade() -> None:
    pass
