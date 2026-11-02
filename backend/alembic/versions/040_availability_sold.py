"""Allow SOLD as a property availability status

Revision ID: 040
Revises: 039
"""
from typing import Sequence, Union

from alembic import op

revision: str = "040"
down_revision: Union[str, None] = "039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_properties_availability_status", "properties", type_="check")
    op.create_check_constraint(
        "ck_properties_availability_status",
        "properties",
        "availability_status IN ('AVAILABLE','VERIFY','RESERVED','RENTED','SOLD','UNAVAILABLE')",
    )


def downgrade() -> None:
    op.execute(
        "UPDATE properties SET availability_status = 'RENTED' WHERE availability_status = 'SOLD'"
    )
    op.drop_constraint("ck_properties_availability_status", "properties", type_="check")
    op.create_check_constraint(
        "ck_properties_availability_status",
        "properties",
        "availability_status IN ('AVAILABLE','VERIFY','RESERVED','RENTED','UNAVAILABLE')",
    )
