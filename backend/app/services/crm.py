"""Internal Property CRM domain logic (admin-only).

Keeps status vocabularies, availability rules, the stale-verification sweep,
commission maths and activity logging in one place so endpoints stay thin.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CrmActivity, Property, Setting, User

logger = logging.getLogger(__name__)

# Rwanda is UTC+2 with no DST; a fixed offset avoids depending on system tzdata.
KIGALI_TZ = timezone(timedelta(hours=2), "CAT")

AVAILABILITY_STATUSES = ("AVAILABLE", "VERIFY", "RESERVED", "RENTED", "UNAVAILABLE")
LANDLORD_STATUSES = ("ACTIVE", "PROSPECT", "INACTIVE", "DO_NOT_CONTACT")
CONTACT_METHODS = ("PHONE", "WHATSAPP", "EMAIL")
LEAD_STATUSES = ("NEW", "CONTACTED", "SEARCHING", "VIEWING", "NEGOTIATING", "CONVERTED", "LOST", "INACTIVE")
ACTIVE_LEAD_STATUSES = ("NEW", "CONTACTED", "SEARCHING", "VIEWING", "NEGOTIATING")
LEAD_SOURCES = ("WEBSITE", "WHATSAPP", "PHONE", "REFERRAL", "SOCIAL", "WALK_IN", "PARTNER", "OTHER")
FURNISHING_OPTIONS = ("ANY", "FURNISHED", "UNFURNISHED")
VIEWING_STATUSES = ("SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED")
UPCOMING_VIEWING_STATUSES = ("SCHEDULED", "CONFIRMED", "RESCHEDULED")
INTEREST_LEVELS = ("LOW", "MEDIUM", "HIGH")
DEAL_STATUSES = ("LEAD", "VIEWING", "NEGOTIATING", "RESERVED", "CONTRACT", "COMPLETED", "CANCELLED")
OPEN_DEAL_STATUSES = ("LEAD", "VIEWING", "NEGOTIATING", "RESERVED", "CONTRACT")
COMMISSION_TYPES = ("PERCENTAGE", "FIXED")
COMMISSION_STATUSES = ("EXPECTED", "INVOICED", "PENDING", "PAID", "OVERDUE", "WAIVED", "CANCELLED")
UNPAID_COMMISSION_STATUSES = ("EXPECTED", "INVOICED", "PENDING", "OVERDUE")
FOLLOW_UP_STATUSES = ("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED")
OPEN_FOLLOW_UP_STATUSES = ("PENDING", "IN_PROGRESS")
FOLLOW_UP_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "URGENT")
DOCUMENT_TYPES = (
    "LANDLORD_AGREEMENT",
    "PROPERTY_AUTHORIZATION",
    "IDENTIFICATION",
    "COMMISSION_AGREEMENT",
    "PAYMENT_PROOF",
    "LEASE",
    "OTHER",
)
CURRENCIES = ("USD", "RWF")

CRM_SETTINGS_KEY = "crm_settings"
DEFAULT_CRM_SETTINGS: dict[str, Any] = {
    # Single source of truth for the availability-verification interval.
    "verify_after_days": 14,
}

STALE_SWEEP_MIN_INTERVAL_SECONDS = 600
_last_stale_sweep = 0.0


class Event:
    PROPERTY_CREATED = "property_created"
    PROPERTY_ADDED = "property_added"
    PROPERTY_REMOVED = "property_removed"
    PROPERTY_DELETED = "property_deleted"
    PROPERTY_UPDATED = "property_updated"
    PRICE_CHANGED = "price_changed"
    AVAILABILITY_CHANGED = "availability_changed"
    AVAILABILITY_CONFIRMED = "availability_confirmed"
    AVAILABILITY_FLAGGED = "availability_flagged"
    LANDLORD_CREATED = "landlord_created"
    LANDLORD_UPDATED = "landlord_updated"
    LANDLORD_CONTACTED = "landlord_contacted"
    LEAD_CREATED = "lead_created"
    LEAD_UPDATED = "lead_updated"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    LEAD_CONTACTED = "lead_contacted"
    LEAD_PROPERTY_LINKED = "lead_property_linked"
    VIEWING_SCHEDULED = "viewing_scheduled"
    VIEWING_UPDATED = "viewing_updated"
    VIEWING_COMPLETED = "viewing_completed"
    DEAL_CREATED = "deal_created"
    DEAL_STATUS_CHANGED = "deal_status_changed"
    DEAL_COMPLETED = "deal_completed"
    COMMISSION_UPDATED = "commission_updated"
    COMMISSION_PAID = "commission_paid"
    FOLLOW_UP_CREATED = "follow_up_created"
    FOLLOW_UP_COMPLETED = "follow_up_completed"
    DOCUMENT_ADDED = "document_added"
    DOCUMENT_DELETED = "document_deleted"
    NOTE_ADDED = "note_added"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def check_choice(value: str | None, allowed: tuple[str, ...], field: str, *, required: bool = False) -> str | None:
    if value is None or value == "":
        if required:
            raise HTTPException(status_code=400, detail=f"{field} is required.")
        return None
    normalized = value.strip().upper()
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid {field}: {value}. Allowed: {', '.join(allowed)}.")
    return normalized


def kigali_day_bounds(day: date | None = None) -> tuple[datetime, datetime]:
    """UTC [start, end) of a calendar day in Kigali."""
    local_day = day or datetime.now(KIGALI_TZ).date()
    start = datetime.combine(local_day, datetime.min.time(), tzinfo=KIGALI_TZ)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


def kigali_month_start() -> datetime:
    today = datetime.now(KIGALI_TZ).date()
    start = datetime.combine(today.replace(day=1), datetime.min.time(), tzinfo=KIGALI_TZ)
    return start.astimezone(timezone.utc)


def kigali_today() -> date:
    return datetime.now(KIGALI_TZ).date()


def as_aware(value: datetime | None) -> datetime | None:
    """Naive datetimes from admin forms are Kigali wall-clock times."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=KIGALI_TZ)


def user_label(user: User | None) -> str:
    if not user:
        return "KigaliRent"
    full = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return full or getattr(user, "email", None) or "KigaliRent"


# --- Settings -----------------------------------------------------------------------


async def get_crm_settings(db: AsyncSession) -> dict[str, Any]:
    row = (await db.execute(select(Setting).where(Setting.key == CRM_SETTINGS_KEY))).scalar_one_or_none()
    merged = dict(DEFAULT_CRM_SETTINGS)
    if row and isinstance(row.value, dict):
        merged.update({k: v for k, v in row.value.items() if k in DEFAULT_CRM_SETTINGS})
    return merged


async def save_crm_settings(db: AsyncSession, values: dict[str, Any]) -> dict[str, Any]:
    current = await get_crm_settings(db)
    if "verify_after_days" in values and values["verify_after_days"] is not None:
        days = int(values["verify_after_days"])
        if days < 1 or days > 365:
            raise HTTPException(status_code=400, detail="verify_after_days must be between 1 and 365.")
        current["verify_after_days"] = days
    row = (await db.execute(select(Setting).where(Setting.key == CRM_SETTINGS_KEY))).scalar_one_or_none()
    if row:
        row.value = current
    else:
        db.add(Setting(key=CRM_SETTINGS_KEY, value=current, group="crm"))
    return current


# --- Activity -----------------------------------------------------------------------


def log_activity(
    db: AsyncSession,
    event: str,
    summary: str,
    *,
    user: User | None = None,
    note: str | None = None,
    meta: dict[str, Any] | None = None,
    property_id: uuid.UUID | None = None,
    landlord_id: uuid.UUID | None = None,
    lead_id: uuid.UUID | None = None,
    deal_id: uuid.UUID | None = None,
) -> CrmActivity:
    activity = CrmActivity(
        event=event,
        summary=summary[:500],
        note=note or None,
        meta=meta or None,
        user_id=user.id if user else None,
        property_id=property_id,
        landlord_id=landlord_id,
        lead_id=lead_id,
        deal_id=deal_id,
        created_at=utcnow(),
    )
    db.add(activity)
    return activity


# --- Availability -------------------------------------------------------------------


def set_availability(
    db: AsyncSession,
    prop: Property,
    status: str,
    *,
    user: User | None,
    note: str | None = None,
    reason: str | None = None,
) -> bool:
    """Change a property's CRM availability (independent of publication). Returns True if changed."""
    new_status = check_choice(status, AVAILABILITY_STATUSES, "availability status", required=True)
    old_status = prop.availability_status
    now = utcnow()
    if note is not None:
        prop.availability_note = note.strip() or None
    # Any human-set status counts as a verification of the property's real-world state.
    if user is not None:
        prop.availability_verified_at = now
        prop.availability_verified_by_id = user.id
    if new_status == old_status:
        return False
    prop.availability_status = new_status
    prop.availability_updated_at = now
    log_activity(
        db,
        Event.AVAILABILITY_CHANGED,
        f"{prop.crm_ref or prop.title}: availability {old_status} → {new_status}"
        + (f" ({reason})" if reason else ""),
        user=user,
        note=note,
        meta={"from": old_status, "to": new_status, **({"reason": reason} if reason else {})},
        property_id=prop.id,
        landlord_id=prop.landlord_id,
    )
    return True


def confirm_available(db: AsyncSession, prop: Property, *, user: User, note: str | None = None) -> None:
    previous = prop.availability_status
    set_availability(db, prop, "AVAILABLE", user=user, note=note)
    log_activity(
        db,
        Event.AVAILABILITY_CONFIRMED,
        f"{prop.crm_ref or prop.title}: availability confirmed",
        user=user,
        note=note,
        meta={"previous": previous},
        property_id=prop.id,
        landlord_id=prop.landlord_id,
    )


def verification_cutoff(verify_after_days: int, now: datetime | None = None) -> datetime:
    return (now or utcnow()) - timedelta(days=verify_after_days)


def stale_condition(cutoff: datetime):
    last_check = func.coalesce(Property.availability_verified_at, Property.availability_updated_at, Property.created_at)
    return and_(Property.in_crm.is_(True), Property.availability_status == "AVAILABLE", last_check < cutoff)


# --- Internal property IDs ----------------------------------------------------------


def ref_letter(name: str | None) -> str:
    for ch in (name or "").upper():
        if "A" <= ch <= "Z":
            return ch
    return "X"


def format_crm_ref(district: str | None, neighborhood: str | None, property_type: str | None, number: int) -> str:
    """District, neighborhood and property-type initials plus a unique number: Gasabo/Kibagabaga/House -> GKH-0001."""
    return f"{ref_letter(district)}{ref_letter(neighborhood)}{ref_letter(property_type)}-{number:04d}"


async def assign_crm_ref(db: AsyncSession, prop: Property) -> str:
    """Give a property its internal ID the first time it enters the CRM; it never changes afterwards."""
    if prop.crm_ref:
        return prop.crm_ref
    from app.models import District, Neighborhood, PropertyType

    async def name_of(model, obj_id):
        return (await db.execute(select(model.name).where(model.id == obj_id))).scalar_one_or_none() if obj_id else None

    number = (await db.execute(select(func.nextval("crm_property_ref_seq")))).scalar_one()
    prop.crm_ref = format_crm_ref(
        await name_of(District, prop.district_id),
        await name_of(Neighborhood, prop.neighborhood_id),
        await name_of(PropertyType, prop.property_type_id),
        int(number),
    )
    return prop.crm_ref


def initial_availability(prop: Property) -> str:
    status = getattr(prop.status, "value", prop.status)
    return {"rented": "RENTED", "sold": "RENTED", "archived": "UNAVAILABLE"}.get(str(status).lower(), "AVAILABLE")


async def add_to_crm(db: AsyncSession, prop: Property, *, user: User | None, availability: str | None = None) -> None:
    if prop.in_crm:
        return
    prop.in_crm = True
    await assign_crm_ref(db, prop)
    now = utcnow()
    prop.availability_status = check_choice(availability, AVAILABILITY_STATUSES, "availability status") or initial_availability(prop)
    prop.availability_updated_at = now
    if user is not None:
        prop.availability_verified_at = now
        prop.availability_verified_by_id = user.id
    log_activity(db, Event.PROPERTY_ADDED, f"{prop.crm_ref}: added to CRM ({prop.title})", user=user,
                 property_id=prop.id, landlord_id=prop.landlord_id)


def remove_from_crm(db: AsyncSession, prop: Property, *, user: User | None) -> None:
    if not prop.in_crm:
        return
    prop.in_crm = False
    log_activity(db, Event.PROPERTY_REMOVED, f"{prop.crm_ref}: removed from CRM", user=user,
                 property_id=prop.id, landlord_id=prop.landlord_id)


async def flag_stale_properties(db: AsyncSession, *, force: bool = False) -> int:
    """Move AVAILABLE properties not verified within the configured interval to VERIFY."""
    global _last_stale_sweep
    if not force and time.monotonic() - _last_stale_sweep < STALE_SWEEP_MIN_INTERVAL_SECONDS:
        return 0
    _last_stale_sweep = time.monotonic()

    cfg = await get_crm_settings(db)
    days = int(cfg["verify_after_days"])
    now = utcnow()
    rows = (
        await db.execute(
            update(Property)
            .where(stale_condition(verification_cutoff(days, now)))
            .values(availability_status="VERIFY", availability_updated_at=now)
            .returning(Property.id, Property.crm_ref, Property.landlord_id)
            .execution_options(synchronize_session=False)
        )
    ).all()
    if rows:
        await db.execute(
            insert(CrmActivity),
            [
                {
                    "id": uuid.uuid4(),
                    "event": Event.AVAILABILITY_FLAGGED,
                    "summary": f"{ref}: not verified for {days}+ days, flagged VERIFY",
                    "meta": {"from": "AVAILABLE", "to": "VERIFY", "reason": "stale"},
                    "property_id": pid,
                    "landlord_id": lid,
                    "created_at": now,
                }
                for pid, ref, lid in rows
            ],
        )
        await db.commit()
    return len(rows)


# --- Commission ---------------------------------------------------------------------


def compute_commission_amount(
    commission_type: str | None, commission_value: float | None, rent_amount: float | None
) -> float | None:
    """PERCENTAGE is a percentage of the monthly rent; FIXED is an absolute amount."""
    if commission_type is None or commission_value is None:
        return None
    if commission_type == "FIXED":
        return round(float(commission_value), 2)
    if rent_amount is None:
        return None
    return round(float(rent_amount) * float(commission_value) / 100.0, 2)


async def to_usd(amount: float | None, currency: str | None) -> float | None:
    if amount is None:
        return None
    cur = (currency or "USD").upper()
    if cur == "USD":
        return round(float(amount), 2)
    if cur == "RWF":
        from app.services.fx import get_default_fx_provider

        fx = await get_default_fx_provider().get_rate("USD", "RWF")
        rate = float(getattr(fx, "rate", 0) or 0)
        return round(float(amount) / rate, 2) if rate > 0 else None
    return None


def overdue_condition(model, today: date):
    return or_(
        model.commission_status == "OVERDUE",
        and_(
            model.commission_status.in_(("EXPECTED", "INVOICED", "PENDING")),
            model.commission_due_date.is_not(None),
            model.commission_due_date < today,
        ),
    )
