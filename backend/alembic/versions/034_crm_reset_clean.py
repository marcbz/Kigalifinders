"""One-time reset of the Property CRM to a clean slate before real data entry.

Website listings are NOT deleted or changed (title, price, photos, publication status stay as they
are); they are only taken out of the CRM and their CRM-only fields are cleared. All CRM records
(landlords/managers, clients, viewings, deals, follow-ups, documents, activity) are cleared and
property IDs restart at 0001. CRM settings are kept.

Revision ID: 034
Revises: 033
Create Date: 2026-10-07
"""

from typing import Sequence, Union

from alembic import op

revision: str = "034"
down_revision: Union[str, None] = "033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE properties SET
          in_crm = false,
          crm_ref = NULL,
          landlord_id = NULL,
          availability_status = 'AVAILABLE',
          availability_updated_at = NULL,
          availability_verified_at = NULL,
          availability_verified_by_id = NULL,
          availability_note = NULL,
          commission_type = NULL,
          commission_value = NULL,
          commission_currency = NULL,
          crm_notes = NULL
        WHERE in_crm = true OR crm_ref IS NOT NULL OR landlord_id IS NOT NULL OR crm_notes IS NOT NULL
           OR commission_type IS NOT NULL OR availability_status <> 'AVAILABLE'
        """
    )
    for table in (
        "crm_activities",
        "crm_documents",
        "crm_follow_ups",
        "crm_viewings",
        "crm_deals",
        "crm_lead_properties",
        "crm_leads",
        "crm_landlords",
    ):
        op.execute(f"DELETE FROM {table}")
    op.execute("ALTER SEQUENCE crm_property_ref_seq RESTART WITH 1")


def downgrade() -> None:
    pass
