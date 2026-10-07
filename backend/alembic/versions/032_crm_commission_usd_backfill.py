"""Backfill CRM deal commission amounts (incl. USD totals used by the dashboard, commissions and
reports) and the RENTED availability history for completed deals that are missing them.

Revision ID: 032
Revises: 031
Create Date: 2026-10-07
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "032"
down_revision: Union[str, None] = "031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE crm_deals SET commission_currency = currency
        WHERE commission_type = 'PERCENTAGE' AND commission_currency IS NULL
        """
    )
    op.execute(
        """
        UPDATE crm_deals SET commission_amount = CASE
            WHEN commission_type = 'FIXED' THEN round(commission_value::numeric, 2)::float
            ELSE round((rent_amount * commission_value / 100.0)::numeric, 2)::float
          END
        WHERE commission_amount IS NULL AND commission_type IS NOT NULL AND commission_value IS NOT NULL
          AND (commission_type = 'FIXED' OR rent_amount IS NOT NULL)
        """
    )
    op.execute(
        """
        UPDATE crm_deals SET commission_amount_usd = CASE
            WHEN upper(COALESCE(commission_currency, currency, 'USD')) = 'USD' THEN round(commission_amount::numeric, 2)::float
            ELSE round((commission_amount / COALESCE(
                (SELECT rate FROM exchange_rates
                 WHERE base_currency = 'USD' AND quote_currency = 'RWF' AND rate > 0
                 ORDER BY rate_date DESC LIMIT 1), 1474.0))::numeric, 2)::float
          END
        WHERE commission_amount_usd IS NULL AND commission_amount IS NOT NULL
          AND upper(COALESCE(commission_currency, currency, 'USD')) IN ('USD', 'RWF')
        """
    )

    if context.is_offline_mode():
        return
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT p.id, p.crm_ref, p.landlord_id, d.completed_at, d.created_by_id
            FROM crm_deals d JOIN properties p ON p.id = d.property_id
            WHERE d.status = 'COMPLETED' AND p.availability_status = 'RENTED'
              AND NOT EXISTS (
                SELECT 1 FROM crm_activities a
                WHERE a.property_id = p.id AND a.event = 'availability_changed' AND a.meta->>'to' = 'RENTED'
              )
            """
        )
    ).all()
    seen = set()
    for r in rows:
        if r.id in seen:
            continue
        seen.add(r.id)
        conn.execute(
            sa.text(
                """INSERT INTO crm_activities (id, event, summary, meta, user_id, property_id, landlord_id, created_at)
                   VALUES (:id, 'availability_changed', :summary, CAST(:meta AS jsonb), :uid, :prop, :ll, :at)"""
            ),
            {
                "id": uuid.uuid4(), "summary": f"{r.crm_ref or 'Property'}: AVAILABLE → RENTED (deal completed)",
                "meta": json.dumps({"from": "AVAILABLE", "to": "RENTED"}), "uid": r.created_by_id, "prop": r.id,
                "ll": r.landlord_id, "at": r.completed_at or datetime.now(timezone.utc),
            },
        )


def downgrade() -> None:
    pass
