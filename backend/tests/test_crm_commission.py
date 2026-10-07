import asyncio
import importlib.util
import json
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.api.v1.endpoints import crm_ops
from app.models import CrmDeal
from app.services import crm as svc

VERSIONS = Path(__file__).resolve().parents[1] / "alembic" / "versions"


class _Fx:
    async def get_rate(self, base="USD", quote="RWF"):
        return SimpleNamespace(rate=1450.0)


@pytest.fixture
def fixed_fx(monkeypatch):
    import app.services.fx as fx

    monkeypatch.setattr(fx, "get_default_fx_provider", lambda: _Fx())


def test_commission_amount_rules():
    assert svc.compute_commission_amount("PERCENTAGE", 10, 1200) == 120.0
    assert svc.compute_commission_amount("FIXED", 300, None) == 300.0
    assert svc.compute_commission_amount("PERCENTAGE", 10, None) is None
    assert svc.compute_commission_amount(None, 10, 1200) is None


@pytest.mark.parametrize(
    ("ctype", "value", "rent", "currency", "ccur", "amount", "usd"),
    [
        ("PERCENTAGE", 10, 1500, "USD", None, 150.0, 150.0),
        ("PERCENTAGE", 50, 870000, "RWF", "USD", 435000.0, 300.0),
        ("FIXED", 145000, 900, "USD", "RWF", 145000.0, 100.0),
        ("FIXED", 200, 900000, "RWF", "USD", 200.0, 200.0),
    ],
)
def test_deal_commission_always_has_usd_total(fixed_fx, ctype, value, rent, currency, ccur, amount, usd):
    d = CrmDeal(commission_type=ctype, commission_value=value, rent_amount=rent, currency=currency, commission_currency=ccur)
    asyncio.run(crm_ops._recompute_commission(d))
    assert d.commission_amount == amount
    assert d.commission_amount_usd == usd
    if ctype == "PERCENTAGE":
        assert d.commission_currency == currency


def test_landlord_labels_mark_property_managers():
    assert svc.landlord_label("Jean", "OWNER") == "Jean"
    assert svc.landlord_label("Eric", "PROPERTY_MANAGER", "Acme Homes") == "Eric (Property manager · Acme Homes)"
    assert svc.landlord_label("Eric", "PROPERTY_MANAGER") == "Eric (Property manager)"
    assert svc.landlord_kind("PROPERTY_MANAGER") == "Property manager"
    assert svc.landlord_kind(None) == "Landlord"


def test_crm_ref_format():
    assert svc.format_crm_ref("Gasabo", "Kibagabaga", "House", 1) == "GKH-0001"
    assert svc.format_crm_ref("Kicukiro", None, "Apartment", 27) == "KXA-0027"


class _Res:
    def __init__(self, rows=(), scalar=None):
        self._rows, self._scalar = list(rows), scalar

    def all(self):
        return self._rows

    def scalar(self):
        return self._scalar


class _Conn:
    """Records the sample-seed writes; answers the few SELECTs the seed makes."""

    def __init__(self):
        self.seq = 0
        self.writes = []

    def execute(self, stmt, params=None):
        sql = str(stmt)
        missing = set(stmt.compile().params) - set(params or {})
        assert not missing, (sql, missing)
        if "nextval" in sql:
            self.seq += 1
            return _Res(scalar=self.seq)
        if "FROM exchange_rates" in sql:
            return _Res(scalar=1450.0)
        if "FROM users" in sql:
            return _Res(scalar=uuid.uuid4())
        if sql.lstrip().startswith("SELECT p.id"):
            status = "RWF" if "'DRAFT'" in sql else "USD"
            rows = [
                SimpleNamespace(id=uuid.uuid4(), title=f"p{i}", price=870000.0 if status == "RWF" else 1500.0, currency=status,
                                district="Gasabo", neighborhood="Kibagabaga", ptype="House")
                for i in range(params["lim"])
            ]
            return _Res(rows)
        self.writes.append((sql, params or {}))
        return _Res()


def test_sample_seed_deals_feed_dashboard_totals():
    spec = importlib.util.spec_from_file_location("m031", VERSIONS / "031_crm_fresh_refs.py")
    m031 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m031)
    conn = _Conn()
    m031._seed_samples(conn)

    deals = [p for sql, p in conn.writes if "INSERT INTO crm_deals" in sql]
    assert len(deals) == 2
    for d in deals:
        assert d["camount_usd"] is not None and d["camount_usd"] > 0
    paid = next(d for d in deals if d["cstatus"] == "PAID")
    assert paid["status"] == "COMPLETED" and paid["paid"] is not None and paid["completed"] is not None
    assert paid["camount_usd"] == (round(paid["camount"] / 1450.0, 2) if paid["cur"] == "RWF" else paid["camount"])

    rented_prop = paid["prop"]
    updates = [p for sql, p in conn.writes if sql.lstrip().startswith("UPDATE properties")]
    assert any(p["id"] == rented_prop and p["status"] == "RENTED" for p in updates)
    activity = [p for sql, p in conn.writes if "INSERT INTO crm_activities" in sql]
    assert any(
        p["event"] == "availability_changed" and p["prop"] == rented_prop and json.loads(p["meta"])["to"] == "RENTED"
        for p in activity
    )
    assert conn.seq == 10
