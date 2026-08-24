"""Exchange-rate provider abstraction.

Preferred public reference approximates the USD/RWF rate aggregators surface
(including values similar to Google Finance displays). Swap implementations
without changing callers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExchangeRate

FALLBACK_USD_TO_RWF = 1474.0
DEFAULT_SOURCE = "fawazahmed0-currency-api"


@dataclass(frozen=True)
class FxQuote:
    base: str
    quote: str
    rate: float
    rate_date: date
    source: str


class ExchangeRateProvider(ABC):
    @abstractmethod
    async def get_rate(self, base: str = "USD", quote: str = "RWF") -> FxQuote:
        raise NotImplementedError


class CdnCurrencyApiProvider(ExchangeRateProvider):
    """Public CDN FX feed (no API key)."""

    async def get_rate(self, base: str = "USD", quote: str = "RWF") -> FxQuote:
        base_l = base.lower()
        quote_l = quote.lower()
        url = f"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base_l}.min.json"
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url)
            res.raise_for_status()
            data = res.json()
        rate = (data.get(base_l) or {}).get(quote_l)
        if not rate or not isinstance(rate, (int, float)):
            raise ValueError(f"No rate for {base}/{quote}")
        return FxQuote(
            base=base.upper(),
            quote=quote.upper(),
            rate=float(rate),
            rate_date=date.today(),
            source=DEFAULT_SOURCE,
        )


class FallbackExchangeRateProvider(ExchangeRateProvider):
    def __init__(self, primary: ExchangeRateProvider, fallback_rate: float = FALLBACK_USD_TO_RWF):
        self.primary = primary
        self.fallback_rate = fallback_rate

    async def get_rate(self, base: str = "USD", quote: str = "RWF") -> FxQuote:
        try:
            return await self.primary.get_rate(base, quote)
        except Exception:
            return FxQuote(
                base=base.upper(),
                quote=quote.upper(),
                rate=self.fallback_rate if base.upper() == "USD" and quote.upper() == "RWF" else 1.0,
                rate_date=date.today(),
                source="fallback-static",
            )


def get_default_fx_provider() -> ExchangeRateProvider:
    return FallbackExchangeRateProvider(CdnCurrencyApiProvider())


async def store_rate(db: AsyncSession, quote: FxQuote) -> ExchangeRate:
    existing = await db.execute(
        select(ExchangeRate).where(
            ExchangeRate.base_currency == quote.base,
            ExchangeRate.quote_currency == quote.quote,
            ExchangeRate.rate_date == quote.rate_date,
            ExchangeRate.source == quote.source,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.rate = quote.rate
        return row
    row = ExchangeRate(
        base_currency=quote.base,
        quote_currency=quote.quote,
        rate=quote.rate,
        rate_date=quote.rate_date,
        source=quote.source,
    )
    db.add(row)
    return row


async def get_latest_stored_rate(
    db: AsyncSession,
    base: str = "USD",
    quote: str = "RWF",
) -> Optional[ExchangeRate]:
    result = await db.execute(
        select(ExchangeRate)
        .where(ExchangeRate.base_currency == base.upper(), ExchangeRate.quote_currency == quote.upper())
        .order_by(ExchangeRate.rate_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def to_usd(amount: float, currency: str, usd_to_rwf: float) -> float:
    cur = (currency or "USD").upper()
    if cur == "USD":
        return float(amount)
    if cur == "RWF":
        return float(amount) / usd_to_rwf if usd_to_rwf else float(amount)
    return float(amount)


def resolve_property_usd_fields(
    price: float,
    currency: str,
    fx: FxQuote | None,
) -> dict:
    cur = (currency or "USD").upper()
    if cur == "USD":
        return {
            "original_price": price,
            "original_currency": "USD",
            "usd_price": price,
            "exchange_rate": fx.rate if fx else None,
            "exchange_rate_date": fx.rate_date if fx else None,
            "exchange_rate_source": fx.source if fx else None,
        }
    if cur == "RWF" and fx:
        return {
            "original_price": price,
            "original_currency": "RWF",
            "usd_price": round(price / fx.rate, 2),
            "exchange_rate": fx.rate,
            "exchange_rate_date": fx.rate_date,
            "exchange_rate_source": fx.source,
        }
    return {
        "original_price": price,
        "original_currency": cur,
        "usd_price": price if cur == "USD" else None,
        "exchange_rate": None,
        "exchange_rate_date": None,
        "exchange_rate_source": None,
    }


def effective_usd_price(prop) -> Optional[float]:
    if getattr(prop, "usd_price", None) is not None:
        return float(prop.usd_price)
    if (getattr(prop, "currency", None) or "USD").upper() == "USD":
        return float(prop.price)
    return None
