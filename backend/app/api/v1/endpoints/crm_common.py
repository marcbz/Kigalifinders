"""Shared helpers for the admin-only Property CRM endpoints."""

from __future__ import annotations

import math
import uuid
from datetime import date, datetime
from typing import Any, Iterable

from fastapi import HTTPException
from sqlalchemy import Select, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CrmActivity, CrmDeal, CrmLandlord, CrmLead, Property, User
from app.services.indexnow import site_url

MAX_PAGE_SIZE = 100


def iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def enum_value(value: Any) -> Any:
    return getattr(value, "value", value)


def public_property_url(slug: str | None) -> str | None:
    return site_url(f"/properties/{slug}") if slug else None


def clamp_page(page: int, page_size: int) -> tuple[int, int]:
    return max(page, 1), min(max(page_size, 1), MAX_PAGE_SIZE)


async def paginate(db: AsyncSession, stmt: Select, page: int, page_size: int) -> tuple[list, int, int, int]:
    page, page_size = clamp_page(page, page_size)
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    rows = (await db.execute(stmt.limit(page_size).offset((page - 1) * page_size))).all()
    return rows, total, page, page_size


def page_payload(items: list, total: int, page: int, page_size: int, **extra: Any) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
        **extra,
    }


def user_name_expr(model=User):
    full = func.trim(func.concat(func.coalesce(model.first_name, ""), literal(" "), func.coalesce(model.last_name, "")))
    return func.coalesce(func.nullif(full, ""), model.email)


async def get_or_404(db: AsyncSession, model, obj_id: uuid.UUID, label: str):
    obj = await db.get(model, obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


async def ensure_exists(db: AsyncSession, refs: Iterable[tuple[Any, uuid.UUID | None, str]]) -> None:
    """Validate optional foreign keys up front so the API returns 400 instead of a DB error."""
    for model, obj_id, label in refs:
        if obj_id is not None and await db.get(model, obj_id) is None:
            raise HTTPException(status_code=400, detail=f"{label} not found")


def require_any_relation(**ids: uuid.UUID | None) -> None:
    if not any(ids.values()):
        raise HTTPException(status_code=400, detail="Link this record to at least one landlord, client, property or deal.")


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def search_pattern(q: str | None) -> str | None:
    q = (q or "").strip()
    return f"%{q}%" if q else None


async def activity_rows(db: AsyncSession, *conditions, limit: int = 30) -> list[dict]:
    stmt = (
        select(
            CrmActivity.id,
            CrmActivity.event,
            CrmActivity.summary,
            CrmActivity.note,
            CrmActivity.meta,
            CrmActivity.created_at,
            CrmActivity.property_id,
            CrmActivity.landlord_id,
            CrmActivity.lead_id,
            CrmActivity.deal_id,
            user_name_expr().label("user_name"),
            Property.crm_ref.label("property_ref"),
            CrmLandlord.name.label("landlord_name"),
            CrmLead.name.label("lead_name"),
        )
        .outerjoin(User, User.id == CrmActivity.user_id)
        .outerjoin(Property, Property.id == CrmActivity.property_id)
        .outerjoin(CrmLandlord, CrmLandlord.id == CrmActivity.landlord_id)
        .outerjoin(CrmLead, CrmLead.id == CrmActivity.lead_id)
        .where(*conditions)
        .order_by(CrmActivity.created_at.desc())
        .limit(limit)
    )
    return [activity_dict(r) for r in (await db.execute(stmt)).all()]


def activity_dict(r) -> dict:
    return {
        "id": str(r.id),
        "event": r.event,
        "summary": r.summary,
        "note": r.note,
        "meta": r.meta,
        "created_at": iso(r.created_at),
        "user_name": r.user_name or "KigaliRent",
        "property_id": str(r.property_id) if r.property_id else None,
        "property_ref": r.property_ref,
        "landlord_id": str(r.landlord_id) if r.landlord_id else None,
        "landlord_name": r.landlord_name,
        "lead_id": str(r.lead_id) if r.lead_id else None,
        "lead_name": r.lead_name,
        "deal_id": str(r.deal_id) if r.deal_id else None,
    }


def deal_select():
    return (
        select(
            CrmDeal,
            Property.crm_ref.label("property_ref"),
            Property.title.label("property_title"),
            CrmLandlord.name.label("landlord_name"),
            CrmLead.name.label("lead_name"),
        )
        .outerjoin(Property, Property.id == CrmDeal.property_id)
        .outerjoin(CrmLandlord, CrmLandlord.id == CrmDeal.landlord_id)
        .outerjoin(CrmLead, CrmLead.id == CrmDeal.lead_id)
    )


def deal_dict(row, today: date | None = None) -> dict:
    d: CrmDeal = row[0]
    overdue = bool(
        d.commission_status == "OVERDUE"
        or (
            today
            and d.commission_status in ("EXPECTED", "INVOICED", "PENDING")
            and d.commission_due_date is not None
            and d.commission_due_date < today
        )
    )
    return {
        "id": str(d.id),
        "property_id": str(d.property_id) if d.property_id else None,
        "property_ref": row.property_ref,
        "property_title": row.property_title,
        "landlord_id": str(d.landlord_id) if d.landlord_id else None,
        "landlord_name": row.landlord_name,
        "lead_id": str(d.lead_id) if d.lead_id else None,
        "lead_name": row.lead_name,
        "rent_amount": d.rent_amount,
        "currency": d.currency,
        "status": d.status,
        "expected_move_in": iso(d.expected_move_in),
        "lease_start": iso(d.lease_start),
        "lease_end": iso(d.lease_end),
        "contract_signed_on": iso(d.contract_signed_on),
        "completed_at": iso(d.completed_at),
        "commission_type": d.commission_type,
        "commission_value": d.commission_value,
        "commission_currency": d.commission_currency,
        "commission_amount": d.commission_amount,
        "commission_amount_usd": d.commission_amount_usd,
        "commission_status": d.commission_status,
        "commission_overdue": overdue,
        "commission_due_date": iso(d.commission_due_date),
        "commission_paid_date": iso(d.commission_paid_date),
        "notes": d.notes,
        "created_at": iso(d.created_at),
        "updated_at": iso(d.updated_at),
    }
