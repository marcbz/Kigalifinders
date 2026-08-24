"""Observation import batch references for research provenance.

Revision ID: 028
Revises: 027
Create Date: 2026-08-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "observation_import_batches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reference", sa.String(length=32), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rows_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_new", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sources", JSONB(), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_observation_import_batches_reference", "observation_import_batches", ["reference"], unique=True)
    op.create_index("ix_observation_import_batches_imported_at", "observation_import_batches", ["imported_at"])


def downgrade() -> None:
    op.drop_index("ix_observation_import_batches_imported_at", table_name="observation_import_batches")
    op.drop_index("ix_observation_import_batches_reference", table_name="observation_import_batches")
    op.drop_table("observation_import_batches")
