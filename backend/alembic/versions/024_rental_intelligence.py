"""Rental intelligence: FX, observations, search intents, market stats.

Revision ID: 024
Revises: 023
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("original_price", sa.Float(), nullable=True))
    op.add_column("properties", sa.Column("original_currency", sa.String(length=3), nullable=True))
    op.add_column("properties", sa.Column("usd_price", sa.Float(), nullable=True))
    op.add_column("properties", sa.Column("exchange_rate", sa.Float(), nullable=True))
    op.add_column("properties", sa.Column("exchange_rate_date", sa.Date(), nullable=True))
    op.add_column("properties", sa.Column("exchange_rate_source", sa.String(length=100), nullable=True))
    op.add_column("properties", sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "properties",
        sa.Column(
            "data_source_kind",
            sa.String(length=40),
            nullable=False,
            server_default="verified_kigali_rent",
        ),
    )
    op.create_index("ix_properties_usd_price", "properties", ["usd_price"])
    op.create_index("ix_properties_last_verified_at", "properties", ["last_verified_at"])

    op.execute(
        """
        UPDATE properties
        SET usd_price = CASE
              WHEN UPPER(COALESCE(currency, 'USD')) = 'USD' THEN price
              ELSE usd_price
            END,
            original_price = COALESCE(original_price, price),
            original_currency = COALESCE(original_currency, currency, 'USD'),
            last_verified_at = COALESCE(last_verified_at, published_at, updated_at, created_at)
        """
    )

    op.create_table(
        "exchange_rates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("base_currency", sa.String(length=3), nullable=False),
        sa.Column("quote_currency", sa.String(length=3), nullable=False),
        sa.Column("rate", sa.Float(), nullable=False),
        sa.Column("rate_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("base_currency", "quote_currency", "rate_date", "source", name="uq_exchange_rate_day_source"),
    )
    op.create_index("ix_exchange_rates_pair_date", "exchange_rates", ["base_currency", "quote_currency", "rate_date"])

    op.create_table(
        "rental_observations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("source_listing_id", sa.String(length=120), nullable=True),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("property_type", sa.String(length=80), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("bathrooms", sa.Float(), nullable=True),
        sa.Column("size_sqm", sa.Float(), nullable=True),
        sa.Column("neighborhood", sa.String(length=120), nullable=True),
        sa.Column("neighborhood_slug", sa.String(length=120), nullable=True),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("asking_price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("usd_price", sa.Float(), nullable=True),
        sa.Column("exchange_rate", sa.Float(), nullable=True),
        sa.Column("exchange_rate_date", sa.Date(), nullable=True),
        sa.Column("exchange_rate_source", sa.String(length=100), nullable=True),
        sa.Column("is_furnished", sa.Boolean(), nullable=True),
        sa.Column("amenities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("rental_term", sa.String(length=80), nullable=True),
        sa.Column("observation_status", sa.String(length=40), nullable=False, server_default="active_observed"),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rental_observations_dedupe_key", "rental_observations", ["dedupe_key"])
    op.create_index("ix_rental_observations_observed_at", "rental_observations", ["observed_at"])
    op.create_index(
        "ix_rental_observations_slice",
        "rental_observations",
        ["neighborhood_slug", "bedrooms", "property_type", "observed_at"],
    )

    op.create_table(
        "market_stat_snapshots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("granularity", sa.String(length=20), nullable=False, server_default="month"),
        sa.Column("location_slug", sa.String(length=120), nullable=False),
        sa.Column("location_name", sa.String(length=120), nullable=True),
        sa.Column("property_type", sa.String(length=80), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("is_furnished", sa.Boolean(), nullable=True),
        sa.Column("data_kind", sa.String(length=40), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("median_usd", sa.Float(), nullable=True),
        sa.Column("p25_usd", sa.Float(), nullable=True),
        sa.Column("p75_usd", sa.Float(), nullable=True),
        sa.Column("min_usd", sa.Float(), nullable=True),
        sa.Column("max_usd", sa.Float(), nullable=True),
        sa.Column("common_amenities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_market_stat_snapshots_lookup",
        "market_stat_snapshots",
        ["location_slug", "period_end", "data_kind", "bedrooms", "property_type"],
    )

    op.create_table(
        "search_intents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("location_slug", sa.String(length=120), nullable=False),
        sa.Column("intent_slug", sa.String(length=200), nullable=False),
        sa.Column("path", sa.String(length=320), nullable=False),
        sa.Column("query", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("h1", sa.String(length=255), nullable=False),
        sa.Column("meta_description", sa.String(length=500), nullable=True),
        sa.Column("intro_html", sa.Text(), nullable=True),
        sa.Column("quality_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("index_status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("match_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_built_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("gsc_impressions", sa.Integer(), nullable=True),
        sa.Column("gsc_clicks", sa.Integer(), nullable=True),
        sa.Column("gsc_ctr", sa.Float(), nullable=True),
        sa.Column("gsc_position", sa.Float(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("location_slug", "intent_slug", name="uq_search_intent_path_parts"),
        sa.UniqueConstraint("path", name="uq_search_intent_path"),
    )
    op.create_index("ix_search_intents_index_status", "search_intents", ["index_status"])

    op.create_table(
        "search_landing_relations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("from_intent_id", sa.UUID(), nullable=False),
        sa.Column("to_intent_id", sa.UUID(), nullable=False),
        sa.Column("relation_type", sa.String(length=40), nullable=False, server_default="related"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["from_intent_id"], ["search_intents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_intent_id"], ["search_intents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("from_intent_id", "to_intent_id", name="uq_search_landing_relation"),
    )

    op.create_table(
        "gsc_query_suggestions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("query", sa.String(length=500), nullable=False),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("ctr", sa.Float(), nullable=True),
        sa.Column("position", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="pending_review"),
        sa.Column("suggested_path", sa.String(length=320), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("gsc_query_suggestions")
    op.drop_table("search_landing_relations")
    op.drop_table("search_intents")
    op.drop_index("ix_market_stat_snapshots_lookup", table_name="market_stat_snapshots")
    op.drop_table("market_stat_snapshots")
    op.drop_index("ix_rental_observations_slice", table_name="rental_observations")
    op.drop_index("ix_rental_observations_observed_at", table_name="rental_observations")
    op.drop_index("ix_rental_observations_dedupe_key", table_name="rental_observations")
    op.drop_table("rental_observations")
    op.drop_index("ix_exchange_rates_pair_date", table_name="exchange_rates")
    op.drop_table("exchange_rates")
    op.drop_index("ix_properties_last_verified_at", table_name="properties")
    op.drop_index("ix_properties_usd_price", table_name="properties")
    op.drop_column("properties", "data_source_kind")
    op.drop_column("properties", "last_verified_at")
    op.drop_column("properties", "exchange_rate_source")
    op.drop_column("properties", "exchange_rate_date")
    op.drop_column("properties", "exchange_rate")
    op.drop_column("properties", "usd_price")
    op.drop_column("properties", "original_currency")
    op.drop_column("properties", "original_price")
