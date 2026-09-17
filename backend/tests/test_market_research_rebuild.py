"""Regression tests for the market snapshot rebuild pipeline.

The rebuild runs in a Celery task and in the daily automation, so a broken code path
stays invisible until research pages quietly stop reflecting new listings. These tests
execute both rebuild functions against a fake session to keep that path exercised.
"""

from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.models import MarketDataKind, MarketStatSnapshot, Property, RentalObservation
from app.services.research import rebuild_observation_snapshots, rebuild_verified_snapshots


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class FakeSession:
    """Minimal AsyncSession stand-in that answers selects by queried entity."""

    def __init__(self, rows_by_entity):
        self._rows_by_entity = rows_by_entity
        self.added = []
        self.deleted = []
        self.flushes = 0

    async def execute(self, statement):
        entity = statement.column_descriptions[0]["entity"]
        return _Result(self._rows_by_entity.get(entity, []))

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        self.flushes += 1


def _property(price, bedrooms, slug="kagarama", name="Kagarama", furnished=False):
    return SimpleNamespace(
        price=price,
        usd_price=price,
        currency="USD",
        bedrooms=bedrooms,
        is_furnished=furnished,
        has_pool=False,
        amenities=[SimpleNamespace(slug="parking")],
        neighborhood=SimpleNamespace(slug=slug, name=name),
    )


def _observation(price, bedrooms, observed_at, slug="remera", name="Remera"):
    return SimpleNamespace(
        usd_price=price,
        bedrooms=bedrooms,
        observed_at=observed_at,
        neighborhood_slug=slug,
        neighborhood=name,
    )


@pytest.mark.asyncio
async def test_rebuild_verified_snapshots_creates_kigali_and_local_buckets():
    db = FakeSession(
        {
            Property: [_property(500, 2), _property(700, 2), _property(900, 3)],
            MarketStatSnapshot: [],
        }
    )

    created = await rebuild_verified_snapshots(db, period_end=date(2026, 9, 17))

    assert created == len(db.added) > 0
    kigali_overall = [
        s
        for s in db.added
        if s.location_slug == "kigali" and s.bedrooms is None and s.is_furnished is None
    ]
    assert len(kigali_overall) == 1
    snap = kigali_overall[0]
    assert snap.data_kind == MarketDataKind.VERIFIED_KIGALI_RENT.value
    assert snap.sample_size == 3
    assert snap.median_usd == 700
    assert snap.period_start == date(2026, 9, 1)
    assert snap.period_end == date(2026, 9, 17)


@pytest.mark.asyncio
async def test_rebuild_observation_snapshots_dates_open_and_closed_months():
    """The month being rebuilt ends on the rebuild date; past months end on month end."""
    db = FakeSession(
        {
            RentalObservation: [
                _observation(400, 1, datetime(2026, 8, 12, tzinfo=timezone.utc)),
                _observation(600, 2, datetime(2026, 8, 20, tzinfo=timezone.utc)),
                _observation(800, 2, datetime(2026, 9, 16, tzinfo=timezone.utc)),
            ],
            MarketStatSnapshot: [],
        }
    )

    created = await rebuild_observation_snapshots(db, period_end=date(2026, 9, 17))

    assert created == len(db.added) > 0
    assert all(s.data_kind == MarketDataKind.MARKET_OBSERVATION.value for s in db.added)

    august = {s.period_end for s in db.added if s.period_start == date(2026, 8, 1)}
    september = {s.period_end for s in db.added if s.period_start == date(2026, 9, 1)}
    assert august == {date(2026, 8, 31)}
    assert september == {date(2026, 9, 17)}


@pytest.mark.asyncio
async def test_rebuild_observation_snapshots_clears_previous_market_rows():
    stale = MarketStatSnapshot(
        period_start=date(2026, 7, 1),
        period_end=date(2026, 7, 31),
        location_slug="kigali",
        data_kind=MarketDataKind.MARKET_OBSERVATION.value,
        sample_size=1,
    )
    db = FakeSession(
        {
            RentalObservation: [_observation(500, 2, datetime(2026, 9, 10, tzinfo=timezone.utc))],
            MarketStatSnapshot: [stale],
        }
    )

    await rebuild_observation_snapshots(db, period_end=date(2026, 9, 17))

    assert db.deleted == [stale]


@pytest.mark.asyncio
async def test_rebuild_functions_tolerate_empty_data():
    db = FakeSession({Property: [], RentalObservation: [], MarketStatSnapshot: []})

    assert await rebuild_verified_snapshots(db, period_end=date(2026, 9, 17)) == 0
    assert await rebuild_observation_snapshots(db, period_end=date(2026, 9, 17)) == 0
