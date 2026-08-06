"""Seed legal page content in settings

Revision ID: 012
Revises: 011
"""
import json
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.legal_defaults import DEFAULT_LEGAL

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'legal'")).fetchone()
    if existing and existing[0]:
        value = existing[0]
        if isinstance(value, str):
            value = json.loads(value)
        merged = {**DEFAULT_LEGAL, **value}
        if not value.get("privacy_policy") or "Your privacy policy" in str(value.get("privacy_policy", "")):
            merged["privacy_policy"] = DEFAULT_LEGAL["privacy_policy"]
        if not value.get("terms_of_service") or "Your terms of service" in str(value.get("terms_of_service", "")):
            merged["terms_of_service"] = DEFAULT_LEGAL["terms_of_service"]
        if not value.get("sitemap_intro"):
            merged["sitemap_intro"] = DEFAULT_LEGAL["sitemap_intro"]
        conn.execute(
            sa.text("UPDATE settings SET value = CAST(:value AS jsonb) WHERE key = 'legal'"),
            {"value": json.dumps(merged)},
        )
    else:
        conn.execute(
            sa.text(
                "INSERT INTO settings (id, key, value, updated_at) VALUES (:id, 'legal', CAST(:value AS jsonb), NOW())"
            ),
            {"id": str(uuid.uuid4()), "value": json.dumps(DEFAULT_LEGAL)},
        )


def downgrade() -> None:
    pass
