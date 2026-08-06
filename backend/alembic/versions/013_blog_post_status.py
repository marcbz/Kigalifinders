"""Add status column to blog posts

Revision ID: 013
Revises: 012
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("blog_posts", sa.Column("status", sa.String(length=20), server_default="draft", nullable=False))
    op.execute("UPDATE blog_posts SET status = 'published' WHERE is_published = true")
    op.execute("UPDATE blog_posts SET status = 'draft' WHERE is_published = false")


def downgrade() -> None:
    op.drop_column("blog_posts", "status")
