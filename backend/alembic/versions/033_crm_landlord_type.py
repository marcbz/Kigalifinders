"""CRM landlords can be owners or property managers (with an optional company name).

Revision ID: 033
Revises: 032
Create Date: 2026-10-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "033"
down_revision: Union[str, None] = "032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("crm_landlords", sa.Column("contact_type", sa.String(20), nullable=False, server_default="OWNER"))
    op.add_column("crm_landlords", sa.Column("company", sa.String(200), nullable=True))
    op.create_index("ix_crm_landlords_contact_type", "crm_landlords", ["contact_type"])
    op.create_check_constraint(
        "ck_crm_landlords_contact_type", "crm_landlords", "contact_type IN ('OWNER','PROPERTY_MANAGER')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_crm_landlords_contact_type", "crm_landlords", type_="check")
    op.drop_index("ix_crm_landlords_contact_type", table_name="crm_landlords")
    op.drop_column("crm_landlords", "company")
    op.drop_column("crm_landlords", "contact_type")
