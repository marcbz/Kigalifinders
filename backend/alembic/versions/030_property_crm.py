"""Internal Property CRM: landlords, leads, viewings, deals, follow-ups, documents,
activity, plus CRM/availability columns on properties.

Revision ID: 030
Revises: 029
Create Date: 2026-10-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _id() -> sa.Column:
    return sa.Column("id", UUID(as_uuid=True), primary_key=True)


def _fk(name: str, table: str, *, index: bool = False) -> sa.Column:
    return sa.Column(name, UUID(as_uuid=True), sa.ForeignKey(f"{table}.id", ondelete="SET NULL"), nullable=True, index=index)


def _ts(name: str, *, nullable: bool = False, index: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable, index=index)


def upgrade() -> None:
    op.create_table(
        "crm_landlords",
        _id(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(40)),
        sa.Column("whatsapp", sa.String(40)),
        sa.Column("email", sa.String(255)),
        sa.Column("preferred_contact", sa.String(20)),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("notes", sa.Text()),
        sa.Column("commission_type", sa.String(20)),
        sa.Column("commission_value", sa.Float()),
        sa.Column("commission_currency", sa.String(3)),
        sa.Column("commission_notes", sa.Text()),
        _ts("last_contacted_at", nullable=True),
        _ts("next_follow_up_at", nullable=True),
        _fk("created_by_id", "users"),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_crm_landlords_status", "crm_landlords", ["status"])
    op.create_index("ix_crm_landlords_next_follow_up_at", "crm_landlords", ["next_follow_up_at"])
    op.create_index("ix_crm_landlords_created_at", "crm_landlords", ["created_at"])

    op.create_table(
        "crm_leads",
        _id(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(40)),
        sa.Column("whatsapp", sa.String(40)),
        sa.Column("email", sa.String(255)),
        sa.Column("budget_min", sa.Float()),
        sa.Column("budget_max", sa.Float()),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        _fk("district_id", "districts"),
        _fk("neighborhood_id", "neighborhoods"),
        sa.Column("area_preference", sa.String(255)),
        sa.Column("bedrooms", sa.Integer()),
        sa.Column("bathrooms", sa.Integer()),
        sa.Column("furnishing", sa.String(20)),
        _fk("property_type_id", "property_types"),
        sa.Column("move_in_date", sa.Date()),
        sa.Column("requirements", sa.Text()),
        sa.Column("source", sa.String(30)),
        sa.Column("status", sa.String(20), nullable=False, server_default="NEW"),
        sa.Column("notes", sa.Text()),
        _fk("assigned_to_id", "users"),
        _ts("last_contacted_at", nullable=True),
        _fk("created_by_id", "users"),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_crm_leads_status", "crm_leads", ["status"])
    op.create_index("ix_crm_leads_created_at", "crm_leads", ["created_at"])

    op.create_table(
        "crm_lead_properties",
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("crm_leads.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("note", sa.String(500)),
        _ts("created_at"),
    )
    op.create_index("ix_crm_lead_properties_property_id", "crm_lead_properties", ["property_id"])

    op.create_table(
        "crm_deals",
        _id(),
        _fk("property_id", "properties", index=True),
        _fk("landlord_id", "crm_landlords", index=True),
        _fk("lead_id", "crm_leads", index=True),
        sa.Column("rent_amount", sa.Float()),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(20), nullable=False, server_default="LEAD"),
        sa.Column("expected_move_in", sa.Date()),
        sa.Column("lease_start", sa.Date()),
        sa.Column("lease_end", sa.Date()),
        sa.Column("contract_signed_on", sa.Date()),
        _ts("completed_at", nullable=True),
        sa.Column("commission_type", sa.String(20)),
        sa.Column("commission_value", sa.Float()),
        sa.Column("commission_currency", sa.String(3)),
        sa.Column("commission_amount", sa.Float()),
        sa.Column("commission_amount_usd", sa.Float()),
        sa.Column("commission_status", sa.String(20), nullable=False, server_default="EXPECTED"),
        sa.Column("commission_due_date", sa.Date()),
        sa.Column("commission_paid_date", sa.Date()),
        sa.Column("notes", sa.Text()),
        _fk("created_by_id", "users"),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_crm_deals_status", "crm_deals", ["status"])
    op.create_index("ix_crm_deals_completed_at", "crm_deals", ["completed_at"])
    op.create_index("ix_crm_deals_commission_status", "crm_deals", ["commission_status"])
    op.create_index("ix_crm_deals_commission_due_date", "crm_deals", ["commission_due_date"])
    op.create_index("ix_crm_deals_commission_paid_date", "crm_deals", ["commission_paid_date"])
    op.create_index("ix_crm_deals_created_at", "crm_deals", ["created_at"])

    op.create_table(
        "crm_viewings",
        _id(),
        _fk("property_id", "properties", index=True),
        _fk("lead_id", "crm_leads", index=True),
        _fk("landlord_id", "crm_landlords", index=True),
        _ts("scheduled_at"),
        sa.Column("status", sa.String(20), nullable=False, server_default="SCHEDULED"),
        sa.Column("notes", sa.Text()),
        sa.Column("client_feedback", sa.Text()),
        sa.Column("interest_level", sa.String(20)),
        sa.Column("next_action", sa.String(500)),
        _fk("created_by_id", "users"),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_crm_viewings_scheduled_at", "crm_viewings", ["scheduled_at"])
    op.create_index("ix_crm_viewings_status", "crm_viewings", ["status"])

    op.create_table(
        "crm_follow_ups",
        _id(),
        sa.Column("title", sa.String(255), nullable=False),
        _ts("due_at"),
        sa.Column("priority", sa.String(10), nullable=False, server_default="MEDIUM"),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("notes", sa.Text()),
        _fk("landlord_id", "crm_landlords", index=True),
        _fk("lead_id", "crm_leads", index=True),
        _fk("property_id", "properties", index=True),
        _fk("deal_id", "crm_deals", index=True),
        _fk("assigned_to_id", "users", index=True),
        _ts("completed_at", nullable=True),
        _fk("created_by_id", "users"),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_crm_follow_ups_due_at", "crm_follow_ups", ["due_at"])
    op.create_index("ix_crm_follow_ups_status_due_at", "crm_follow_ups", ["status", "due_at"])

    op.create_table(
        "crm_documents",
        _id(),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("doc_type", sa.String(40), nullable=False, server_default="OTHER"),
        _fk("landlord_id", "crm_landlords", index=True),
        _fk("lead_id", "crm_leads", index=True),
        _fk("property_id", "properties", index=True),
        _fk("deal_id", "crm_deals", index=True),
        sa.Column("storage", sa.String(20), nullable=False),
        sa.Column("storage_key", sa.String(500)),
        sa.Column("resource_type", sa.String(20)),
        sa.Column("file_format", sa.String(20)),
        sa.Column("file_name", sa.String(255)),
        sa.Column("mime_type", sa.String(100)),
        sa.Column("size_bytes", sa.Integer()),
        sa.Column("external_url", sa.String(2000)),
        sa.Column("notes", sa.Text()),
        _fk("uploaded_by_id", "users"),
        _ts("created_at"),
    )
    op.create_index("ix_crm_documents_created_at", "crm_documents", ["created_at"])

    op.create_table(
        "crm_activities",
        _id(),
        sa.Column("event", sa.String(60), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column("meta", JSONB()),
        _fk("user_id", "users"),
        _fk("property_id", "properties", index=True),
        _fk("landlord_id", "crm_landlords", index=True),
        _fk("lead_id", "crm_leads", index=True),
        _fk("deal_id", "crm_deals", index=True),
        _ts("created_at"),
    )
    op.create_index("ix_crm_activities_event", "crm_activities", ["event"])
    op.create_index("ix_crm_activities_created_at", "crm_activities", ["created_at"])

    # --- CRM columns on the existing properties table ---------------------------------
    op.add_column("properties", sa.Column("crm_ref", sa.String(20), nullable=True))
    op.add_column(
        "properties",
        sa.Column("landlord_id", UUID(as_uuid=True), sa.ForeignKey("crm_landlords.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "properties",
        sa.Column("availability_status", sa.String(20), nullable=False, server_default="AVAILABLE"),
    )
    op.add_column("properties", sa.Column("availability_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("properties", sa.Column("availability_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "properties",
        sa.Column(
            "availability_verified_by_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("properties", sa.Column("availability_note", sa.Text(), nullable=True))
    op.add_column("properties", sa.Column("commission_type", sa.String(20), nullable=True))
    op.add_column("properties", sa.Column("commission_value", sa.Float(), nullable=True))
    op.add_column("properties", sa.Column("commission_currency", sa.String(3), nullable=True))
    op.add_column("properties", sa.Column("crm_notes", sa.Text(), nullable=True))

    op.create_check_constraint(
        "ck_properties_availability_status",
        "properties",
        "availability_status IN ('AVAILABLE','VERIFY','RESERVED','RENTED','UNAVAILABLE')",
    )

    # Seed availability from the existing publication status, without touching publication.
    op.execute(
        """
        UPDATE properties SET
          availability_status = CASE
            WHEN upper(status::text) IN ('RENTED', 'SOLD') THEN 'RENTED'
            WHEN upper(status::text) = 'ARCHIVED' THEN 'UNAVAILABLE'
            ELSE 'AVAILABLE'
          END,
          availability_updated_at = COALESCE(last_verified_at, updated_at, created_at, now()),
          availability_verified_at = COALESCE(last_verified_at, published_at, created_at)
        """
    )

    # Stable internal IDs: KR-<year>-<sequence>. Existing rows numbered by creation order.
    op.execute("CREATE SEQUENCE IF NOT EXISTS crm_property_ref_seq START 1")
    op.execute(
        """
        WITH ordered AS (
          SELECT id, COALESCE(created_at, now()) AS created_at,
                 row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
          FROM properties
        )
        UPDATE properties p
        SET crm_ref = 'KR-' || to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY') || '-'
                      || lpad(o.rn::text, GREATEST(4, length(o.rn::text)), '0')
        FROM ordered o
        WHERE p.id = o.id
        """
    )
    op.execute(
        """
        SELECT setval('crm_property_ref_seq',
                      GREATEST((SELECT count(*) FROM properties), 1),
                      (SELECT count(*) > 0 FROM properties))
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION crm_next_property_ref() RETURNS text
        LANGUAGE plpgsql VOLATILE AS $$
        DECLARE n bigint := nextval('crm_property_ref_seq');
        BEGIN
          RETURN 'KR-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-'
                 || lpad(n::text, GREATEST(4, length(n::text)), '0');
        END
        $$
        """
    )
    op.execute("ALTER TABLE properties ALTER COLUMN crm_ref SET DEFAULT crm_next_property_ref()")
    op.alter_column("properties", "crm_ref", nullable=False)

    op.create_index("ix_properties_crm_ref", "properties", ["crm_ref"], unique=True)
    op.create_index("ix_properties_landlord_id", "properties", ["landlord_id"])
    op.create_index("ix_properties_availability_status", "properties", ["availability_status"])
    op.create_index("ix_properties_availability_updated_at", "properties", ["availability_updated_at"])
    op.create_index("ix_properties_availability_verified_at", "properties", ["availability_verified_at"])


def downgrade() -> None:
    for ix in (
        "ix_properties_availability_verified_at",
        "ix_properties_availability_updated_at",
        "ix_properties_availability_status",
        "ix_properties_landlord_id",
        "ix_properties_crm_ref",
    ):
        op.drop_index(ix, table_name="properties")
    op.execute("ALTER TABLE properties ALTER COLUMN crm_ref DROP DEFAULT")
    op.execute("DROP FUNCTION IF EXISTS crm_next_property_ref()")
    op.execute("DROP SEQUENCE IF EXISTS crm_property_ref_seq")
    op.drop_constraint("ck_properties_availability_status", "properties", type_="check")
    for col in (
        "crm_notes",
        "commission_currency",
        "commission_value",
        "commission_type",
        "availability_note",
        "availability_verified_by_id",
        "availability_verified_at",
        "availability_updated_at",
        "availability_status",
        "landlord_id",
        "crm_ref",
    ):
        op.drop_column("properties", col)
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
        op.drop_table(table)
