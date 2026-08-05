"""Add analytics indexes for reporting

Revision ID: 011
Revises: 010
"""
from typing import Sequence, Union

from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_analytics_created_at", "analytics", ["created_at"], if_not_exists=True)
    op.create_index("ix_analytics_event_type", "analytics", ["event_type"], if_not_exists=True)
    op.create_index(
        "ix_analytics_entity",
        "analytics",
        ["entity_type", "entity_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_analytics_entity", table_name="analytics", if_exists=True)
    op.drop_index("ix_analytics_event_type", table_name="analytics", if_exists=True)
    op.drop_index("ix_analytics_created_at", table_name="analytics", if_exists=True)
