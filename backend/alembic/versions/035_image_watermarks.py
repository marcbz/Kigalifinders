"""Track watermarked listing images and where their private clean originals are stored.

Revision ID: 035
Revises: 034
Create Date: 2026-10-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "035"
down_revision: Union[str, None] = "034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "image_watermarks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("original_storage", sa.String(20), nullable=False),
        sa.Column("original_key", sa.String(500), nullable=False),
        sa.Column("source_url", sa.String(1000)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_image_watermarks_url", "image_watermarks", ["url"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_image_watermarks_url", table_name="image_watermarks")
    op.drop_table("image_watermarks")
