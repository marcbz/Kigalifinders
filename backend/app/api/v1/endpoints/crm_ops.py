"""Internal Property CRM — viewings, deals, commissions, follow-ups, documents (admin-only)."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from typing import Annotated, Literal
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.v1.endpoints.crm import link_lead_property
from app.api.v1.endpoints.crm_common import (
    clean_text,
    deal_dict,
    deal_select,
    ensure_exists,
    get_or_404,
    iso,
    page_payload,
    paginate,
    require_any_relation,
    search_pattern,
    user_name_expr,
)
from app.core.deps import require_admin
from app.database.session import get_db
from app.models import (
    CrmDeal,
    CrmDocument,
    CrmFollowUp,
    CrmLandlord,
    CrmLead,
    CrmViewing,
    Property,
    User,
)
from app.schemas.crm import (
    DealCreate,
    DealUpdate,
    DocumentLinkCreate,
    FollowUpCreate,
    FollowUpUpdate,
    ViewingCreate,
    ViewingUpdate,
)
from app.services import crm as svc
from app.services import crm_documents as docs
from app.services.crm import Event

router = APIRouter(prefix="/admin/crm", tags=["Admin CRM"], dependencies=[Depends(require_admin)])

DbSession = Annotated[AsyncSession, Depends(get_db)]
AdminUser = Annotated[User, Depends(require_admin)]


# --- Viewings -------------------------------------------------------------------------


def viewing_select():
    return (
        select(
            CrmViewing,
            Property.crm_ref.label("property_ref"),
            Property.title.label("property_title"),
            CrmLead.name.label("lead_name"),
            CrmLead.phone.label("lead_phone"),
            CrmLandlord.name.label("landlord_name"),
        )
        .outerjoin(Property, Property.id == CrmViewing.property_id)
        .outerjoin(CrmLead, CrmLead.id == CrmViewing.lead_id)
        .outerjoin(CrmLandlord, CrmLandlord.id == CrmViewing.landlord_id)
    )


def viewing_dict(row) -> dict:
    v: CrmViewing = row[0]
    return {
        "id": str(v.id),
        "property_id": str(v.property_id) if v.property_id else None,
        "property_ref": row.property_ref,
        "property_title": row.property_title,
        "lead_id": str(v.lead_id) if v.lead_id else None,
        "lead_name": row.lead_name,
        "lead_phone": row.lead_phone,
        "landlord_id": str(v.landlord_id) if v.landlord_id else None,
        "landlord_name": row.landlord_name,
        "scheduled_at": iso(v.scheduled_at),
        "status": v.status,
        "notes": v.notes,
        "client_feedback": v.client_feedback,
        "interest_level": v.interest_level,
        "next_action": v.next_action,
        "created_at": iso(v.created_at),
    }


@router.get("/viewings")
async def list_viewings(
    db: DbSession,
    scope: Literal["upcoming", "today", "past", "all"] = "upcoming",
    status: str | None = None,
    property_id: UUID | None = None,
    lead_id: UUID | None = None,
    landlord_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 25,
):
    stmt = viewing_select()
    day_start, day_end = svc.kigali_day_bounds()
    now = svc.utcnow()
    if scope == "upcoming":
        stmt = stmt.where(CrmViewing.scheduled_at >= day_start).order_by(CrmViewing.scheduled_at.asc())
    elif scope == "today":
        stmt = stmt.where(CrmViewing.scheduled_at >= day_start, CrmViewing.scheduled_at < day_end).order_by(CrmViewing.scheduled_at.asc())
    elif scope == "past":
        stmt = stmt.where(CrmViewing.scheduled_at < now).order_by(CrmViewing.scheduled_at.desc())
    else:
        stmt = stmt.order_by(CrmViewing.scheduled_at.desc())
    if status:
        stmt = stmt.where(CrmViewing.status == svc.check_choice(status, svc.VIEWING_STATUSES, "status"))
    if date_from:
        stmt = stmt.where(CrmViewing.scheduled_at >= svc.kigali_day_bounds(date_from)[0])
    if date_to:
        stmt = stmt.where(CrmViewing.scheduled_at < svc.kigali_day_bounds(date_to)[1])
    for col, value in ((CrmViewing.property_id, property_id), (CrmViewing.lead_id, lead_id), (CrmViewing.landlord_id, landlord_id)):
        if value:
            stmt = stmt.where(col == value)
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload([viewing_dict(r) for r in rows], total, page, page_size)


async def _viewing_by_id(db: AsyncSession, viewing_id: UUID) -> dict:
    row = (await db.execute(viewing_select().where(CrmViewing.id == viewing_id))).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Viewing not found")
    return viewing_dict(row)


def _apply_viewing(v: CrmViewing, data: dict) -> None:
    for field in ("property_id", "lead_id", "landlord_id"):
        if field in data:
            setattr(v, field, data[field])
    if data.get("scheduled_at") is not None:
        v.scheduled_at = svc.as_aware(data["scheduled_at"])
    for field in ("notes", "client_feedback", "next_action"):
        if field in data:
            setattr(v, field, clean_text(data[field]))
    if "status" in data:
        v.status = svc.check_choice(data["status"], svc.VIEWING_STATUSES, "status", required=True)
    if "interest_level" in data:
        v.interest_level = svc.check_choice(data["interest_level"], svc.INTEREST_LEVELS, "interest level")


@router.post("/viewings", status_code=201)
async def create_viewing(body: ViewingCreate, db: DbSession, user: AdminUser):
    data = body.model_dump(exclude_unset=True)
    await ensure_exists(db, [(Property, data.get("property_id"), "Property"), (CrmLead, data.get("lead_id"), "Client"),
                             (CrmLandlord, data.get("landlord_id"), "Landlord")])
    if not data.get("property_id") and not data.get("lead_id"):
        raise HTTPException(status_code=400, detail="A viewing needs a property or a client.")
    v = CrmViewing(created_by_id=user.id, status="SCHEDULED")
    _apply_viewing(v, data)
    prop = await db.get(Property, v.property_id) if v.property_id else None
    lead = await db.get(CrmLead, v.lead_id) if v.lead_id else None
    if prop and not v.landlord_id:
        v.landlord_id = prop.landlord_id
    db.add(v)
    await db.flush()
    if prop and lead:
        await link_lead_property(db, lead, prop, user)
    if lead and lead.status in ("NEW", "CONTACTED", "SEARCHING"):
        old = lead.status
        lead.status = "VIEWING"
        svc.log_activity(db, Event.LEAD_STATUS_CHANGED, f"Client {lead.name}: {old} → VIEWING", user=user,
                         lead_id=lead.id, meta={"from": old, "to": "VIEWING"})
    when = v.scheduled_at.astimezone(svc.KIGALI_TZ).strftime("%d %b %Y %H:%M")
    svc.log_activity(
        db, Event.VIEWING_SCHEDULED,
        f"Viewing scheduled {when}: {prop.crm_ref if prop else 'property TBC'}" + (f" with {lead.name}" if lead else ""),
        user=user, note=v.notes, property_id=v.property_id, lead_id=v.lead_id, landlord_id=v.landlord_id,
    )
    await db.commit()
    return await _viewing_by_id(db, v.id)


@router.patch("/viewings/{viewing_id}")
async def update_viewing(viewing_id: UUID, body: ViewingUpdate, db: DbSession, user: AdminUser):
    v = await get_or_404(db, CrmViewing, viewing_id, "Viewing")
    data = body.model_dump(exclude_unset=True)
    await ensure_exists(db, [(Property, data.get("property_id"), "Property"), (CrmLead, data.get("lead_id"), "Client"),
                             (CrmLandlord, data.get("landlord_id"), "Landlord")])
    old_status = v.status
    _apply_viewing(v, data)
    if data:
        completed = v.status == "COMPLETED" and old_status != "COMPLETED"
        status_bit = f" ({old_status} → {v.status})" if v.status != old_status else ""
        svc.log_activity(
            db, Event.VIEWING_COMPLETED if completed else Event.VIEWING_UPDATED,
            ("Viewing completed" if completed else "Viewing updated") + status_bit,
            user=user, note=v.client_feedback if completed else None,
            property_id=v.property_id, lead_id=v.lead_id, landlord_id=v.landlord_id,
            meta={"interest_level": v.interest_level} if completed and v.interest_level else None,
        )
    await db.commit()
    return await _viewing_by_id(db, viewing_id)


@router.delete("/viewings/{viewing_id}", status_code=204)
async def delete_viewing(viewing_id: UUID, db: DbSession, user: AdminUser):
    v = await get_or_404(db, CrmViewing, viewing_id, "Viewing")
    await db.delete(v)
    await db.commit()


# --- Deals & commissions --------------------------------------------------------------


async def _recompute_commission(d: CrmDeal) -> None:
    d.commission_amount = svc.compute_commission_amount(d.commission_type, d.commission_value, d.rent_amount)
    if d.commission_type == "PERCENTAGE":
        d.commission_currency = d.currency
    d.commission_amount_usd = await svc.to_usd(d.commission_amount, d.commission_currency or d.currency)


async def _apply_deal(db: AsyncSession, d: CrmDeal, data: dict) -> None:
    await ensure_exists(db, [(Property, data.get("property_id"), "Property"), (CrmLead, data.get("lead_id"), "Client"),
                             (CrmLandlord, data.get("landlord_id"), "Landlord")])
    for field in ("property_id", "landlord_id", "lead_id", "rent_amount", "expected_move_in", "lease_start",
                  "lease_end", "contract_signed_on", "commission_value", "commission_due_date", "commission_paid_date"):
        if field in data:
            setattr(d, field, data[field])
    if "notes" in data:
        d.notes = clean_text(data["notes"])
    if "currency" in data:
        d.currency = svc.check_choice(data["currency"], svc.CURRENCIES, "currency") or "USD"
    if "commission_type" in data:
        d.commission_type = svc.check_choice(data["commission_type"], svc.COMMISSION_TYPES, "commission type")
    if "commission_currency" in data:
        d.commission_currency = svc.check_choice(data["commission_currency"], svc.CURRENCIES, "commission currency")


async def _fill_deal_defaults(db: AsyncSession, d: CrmDeal) -> None:
    """Default landlord/rent/commission from the property, then the landlord agreement."""
    prop = await db.get(Property, d.property_id) if d.property_id else None
    if prop:
        d.landlord_id = d.landlord_id or prop.landlord_id
        if d.rent_amount is None:
            d.rent_amount = prop.price
            d.currency = prop.currency or d.currency
    if d.commission_type is None:
        landlord = await db.get(CrmLandlord, d.landlord_id) if d.landlord_id else None
        for source in (prop, landlord):
            if source is not None and source.commission_type and source.commission_value is not None:
                d.commission_type = source.commission_type
                d.commission_value = source.commission_value
                d.commission_currency = source.commission_currency
                break


async def _on_deal_status_change(db: AsyncSession, d: CrmDeal, old: str | None, user: User, keep_availability: bool) -> None:
    if d.status == old:
        return
    svc.log_activity(
        db, Event.DEAL_COMPLETED if d.status == "COMPLETED" else Event.DEAL_STATUS_CHANGED,
        f"Deal {'completed' if d.status == 'COMPLETED' else f'{old} → {d.status}'}",
        user=user, deal_id=d.id, property_id=d.property_id, landlord_id=d.landlord_id, lead_id=d.lead_id,
        meta={"from": old, "to": d.status},
    )
    if d.status == "COMPLETED":
        d.completed_at = d.completed_at or svc.utcnow()
        if d.property_id and not keep_availability:
            prop = await db.get(Property, d.property_id)
            if prop:
                svc.set_availability(db, prop, "RENTED", user=user, reason="deal completed")
        if d.lead_id:
            lead = await db.get(CrmLead, d.lead_id)
            if lead and lead.status != "CONVERTED":
                prev = lead.status
                lead.status = "CONVERTED"
                svc.log_activity(db, Event.LEAD_STATUS_CHANGED, f"Client {lead.name}: {prev} → CONVERTED", user=user,
                                 lead_id=lead.id, meta={"from": prev, "to": "CONVERTED"})
    elif old == "COMPLETED":
        d.completed_at = None


def _on_commission_status_change(db: AsyncSession, d: CrmDeal, old: str | None, user: User) -> None:
    if d.commission_status == old:
        return
    if d.commission_status == "PAID":
        d.commission_paid_date = d.commission_paid_date or svc.kigali_today()
    amount = f" {d.commission_amount:,.2f} {d.commission_currency or d.currency}" if d.commission_amount is not None else ""
    svc.log_activity(
        db, Event.COMMISSION_PAID if d.commission_status == "PAID" else Event.COMMISSION_UPDATED,
        f"Commission{amount}: {old} → {d.commission_status}",
        user=user, deal_id=d.id, property_id=d.property_id, landlord_id=d.landlord_id, lead_id=d.lead_id,
        meta={"from": old, "to": d.commission_status},
    )


async def _deal_by_id(db: AsyncSession, deal_id: UUID) -> dict:
    row = (await db.execute(deal_select().where(CrmDeal.id == deal_id))).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal_dict(row, svc.kigali_today())


DEAL_SORTS = {"created": CrmDeal.created_at, "move_in": CrmDeal.expected_move_in, "rent": CrmDeal.rent_amount,
              "status": CrmDeal.status, "commission": CrmDeal.commission_amount_usd, "due": CrmDeal.commission_due_date}


@router.get("/deals")
async def list_deals(
    db: DbSession,
    status: str | None = None,
    open_only: bool = False,
    commission_status: str | None = None,
    property_id: UUID | None = None,
    landlord_id: UUID | None = None,
    lead_id: UUID | None = None,
    q: str | None = None,
    sort: str = "created",
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 25,
):
    stmt = deal_select()
    if status:
        stmt = stmt.where(CrmDeal.status == svc.check_choice(status, svc.DEAL_STATUSES, "status"))
    elif open_only:
        stmt = stmt.where(CrmDeal.status.in_(svc.OPEN_DEAL_STATUSES))
    if commission_status:
        stmt = stmt.where(CrmDeal.commission_status == svc.check_choice(commission_status, svc.COMMISSION_STATUSES, "commission status"))
    for col, value in ((CrmDeal.property_id, property_id), (CrmDeal.landlord_id, landlord_id), (CrmDeal.lead_id, lead_id)):
        if value:
            stmt = stmt.where(col == value)
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(Property.crm_ref.ilike(pattern), Property.title.ilike(pattern),
                              CrmLandlord.name.ilike(pattern), CrmLead.name.ilike(pattern)))
    sort_col = DEAL_SORTS.get(sort, CrmDeal.created_at)
    stmt = stmt.order_by(sort_col.asc().nulls_last() if order == "asc" else sort_col.desc().nulls_last(), CrmDeal.id)
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    today = svc.kigali_today()
    return page_payload([deal_dict(r, today) for r in rows], total, page, page_size)


@router.post("/deals", status_code=201)
async def create_deal(body: DealCreate, db: DbSession, user: AdminUser):
    data = body.model_dump(exclude_unset=True)
    keep = bool(data.pop("keep_property_availability", False))
    if not any(data.get(k) for k in ("property_id", "lead_id", "landlord_id")):
        raise HTTPException(status_code=400, detail="A deal needs a property, client or landlord.")
    d = CrmDeal(created_by_id=user.id, status="LEAD", commission_status="EXPECTED", currency="USD")
    await _apply_deal(db, d, data)
    await _fill_deal_defaults(db, d)
    status = svc.check_choice(data.get("status"), svc.DEAL_STATUSES, "status") or "LEAD"
    d.commission_status = svc.check_choice(data.get("commission_status"), svc.COMMISSION_STATUSES, "commission status") or "EXPECTED"
    await _recompute_commission(d)
    db.add(d)
    await db.flush()
    prop = await db.get(Property, d.property_id) if d.property_id else None
    lead = await db.get(CrmLead, d.lead_id) if d.lead_id else None
    if prop and lead:
        await link_lead_property(db, lead, prop, user)
    svc.log_activity(
        db, Event.DEAL_CREATED,
        f"Deal created: {prop.crm_ref if prop else 'no property'}" + (f" with {lead.name}" if lead else ""),
        user=user, deal_id=d.id, property_id=d.property_id, landlord_id=d.landlord_id, lead_id=d.lead_id,
    )
    d.status = "LEAD"
    if status != "LEAD":
        d.status = status
        await _on_deal_status_change(db, d, "LEAD", user, keep)
    if d.commission_status == "PAID":
        _on_commission_status_change(db, d, "EXPECTED", user)
    await db.commit()
    return await _deal_by_id(db, d.id)


@router.patch("/deals/{deal_id}")
async def update_deal(deal_id: UUID, body: DealUpdate, db: DbSession, user: AdminUser):
    d = await get_or_404(db, CrmDeal, deal_id, "Deal")
    data = body.model_dump(exclude_unset=True)
    keep = bool(data.pop("keep_property_availability", False))
    old_status, old_commission_status = d.status, d.commission_status
    await _apply_deal(db, d, data)
    if "status" in data:
        d.status = svc.check_choice(data["status"], svc.DEAL_STATUSES, "status", required=True)
    if "commission_status" in data:
        d.commission_status = svc.check_choice(data["commission_status"], svc.COMMISSION_STATUSES, "commission status", required=True)
    await _recompute_commission(d)
    await _on_deal_status_change(db, d, old_status, user, keep)
    _on_commission_status_change(db, d, old_commission_status, user)
    await db.commit()
    return await _deal_by_id(db, deal_id)


@router.delete("/deals/{deal_id}", status_code=204)
async def delete_deal(deal_id: UUID, db: DbSession, user: AdminUser):
    d = await get_or_404(db, CrmDeal, deal_id, "Deal")
    await db.delete(d)
    await db.commit()


@router.get("/commissions")
async def list_commissions(
    db: DbSession,
    status: str | None = None,
    overdue: bool = False,
    landlord_id: UUID | None = None,
    page: int = 1,
    page_size: int = 25,
):
    today = svc.kigali_today()
    base = CrmDeal.status != "CANCELLED"
    summary = (
        await db.execute(
            select(
                func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(
                    CrmDeal.commission_status == "EXPECTED", ~svc.overdue_condition(CrmDeal, today)), 0).label("expected"),
                func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(
                    CrmDeal.commission_status.in_(("INVOICED", "PENDING")), ~svc.overdue_condition(CrmDeal, today)), 0).label("pending"),
                func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(svc.overdue_condition(CrmDeal, today)), 0).label("overdue"),
                func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(CrmDeal.commission_status == "PAID"), 0).label("paid"),
                func.count(CrmDeal.id).filter(svc.overdue_condition(CrmDeal, today)).label("overdue_count"),
            ).where(base, CrmDeal.commission_type.is_not(None))
        )
    ).one()
    stmt = deal_select().where(base, CrmDeal.commission_type.is_not(None))
    if status:
        stmt = stmt.where(CrmDeal.commission_status == svc.check_choice(status, svc.COMMISSION_STATUSES, "commission status"))
    if overdue:
        stmt = stmt.where(svc.overdue_condition(CrmDeal, today))
    if landlord_id:
        stmt = stmt.where(CrmDeal.landlord_id == landlord_id)
    stmt = stmt.order_by(CrmDeal.commission_due_date.asc().nulls_last(), CrmDeal.created_at.desc())
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload(
        [deal_dict(r, today) for r in rows], total, page, page_size,
        summary={
            "expected_usd": round(float(summary.expected), 2),
            "pending_usd": round(float(summary.pending), 2),
            "overdue_usd": round(float(summary.overdue), 2),
            "paid_usd": round(float(summary.paid), 2),
            "overdue_count": summary.overdue_count,
        },
    )


# --- Follow-ups -----------------------------------------------------------------------

_Assignee = aliased(User)


def follow_up_select():
    return (
        select(
            CrmFollowUp,
            CrmLandlord.name.label("landlord_name"),
            CrmLead.name.label("lead_name"),
            Property.crm_ref.label("property_ref"),
            user_name_expr(_Assignee).label("assigned_to_name"),
        )
        .outerjoin(CrmLandlord, CrmLandlord.id == CrmFollowUp.landlord_id)
        .outerjoin(CrmLead, CrmLead.id == CrmFollowUp.lead_id)
        .outerjoin(Property, Property.id == CrmFollowUp.property_id)
        .outerjoin(_Assignee, _Assignee.id == CrmFollowUp.assigned_to_id)
    )


def follow_up_dict(row) -> dict:
    f: CrmFollowUp = row[0]
    now = svc.utcnow()
    return {
        "id": str(f.id),
        "title": f.title,
        "due_at": iso(f.due_at),
        "priority": f.priority,
        "status": f.status,
        "notes": f.notes,
        "overdue": f.status in svc.OPEN_FOLLOW_UP_STATUSES and f.due_at is not None and f.due_at < now,
        "landlord_id": str(f.landlord_id) if f.landlord_id else None,
        "landlord_name": row.landlord_name,
        "lead_id": str(f.lead_id) if f.lead_id else None,
        "lead_name": row.lead_name,
        "property_id": str(f.property_id) if f.property_id else None,
        "property_ref": row.property_ref,
        "deal_id": str(f.deal_id) if f.deal_id else None,
        "assigned_to_id": str(f.assigned_to_id) if f.assigned_to_id else None,
        "assigned_to_name": row.assigned_to_name if f.assigned_to_id else None,
        "completed_at": iso(f.completed_at),
        "created_at": iso(f.created_at),
    }


async def _sync_landlord_next_follow_up(db: AsyncSession, *landlord_ids: UUID | None) -> None:
    for lid in {i for i in landlord_ids if i}:
        await db.flush()
        nxt = (
            await db.execute(
                select(func.min(CrmFollowUp.due_at)).where(
                    CrmFollowUp.landlord_id == lid, CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES)
                )
            )
        ).scalar_one_or_none()
        ll = await db.get(CrmLandlord, lid)
        if ll:
            ll.next_follow_up_at = nxt


@router.get("/follow-ups")
async def list_follow_ups(
    db: DbSession,
    scope: Literal["open", "overdue", "today", "upcoming", "completed", "all"] = "open",
    priority: str | None = None,
    assigned_to_id: UUID | None = None,
    landlord_id: UUID | None = None,
    lead_id: UUID | None = None,
    property_id: UUID | None = None,
    deal_id: UUID | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    stmt = follow_up_select()
    day_start, day_end = svc.kigali_day_bounds()
    open_cond = CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES)
    if scope == "open":
        stmt = stmt.where(open_cond).order_by(CrmFollowUp.due_at.asc())
    elif scope == "overdue":
        stmt = stmt.where(open_cond, CrmFollowUp.due_at < svc.utcnow()).order_by(CrmFollowUp.due_at.asc())
    elif scope == "today":
        stmt = stmt.where(open_cond, CrmFollowUp.due_at >= day_start, CrmFollowUp.due_at < day_end).order_by(CrmFollowUp.due_at.asc())
    elif scope == "upcoming":
        stmt = stmt.where(open_cond, CrmFollowUp.due_at >= day_end).order_by(CrmFollowUp.due_at.asc())
    elif scope == "completed":
        stmt = stmt.where(CrmFollowUp.status == "COMPLETED").order_by(CrmFollowUp.completed_at.desc().nulls_last())
    else:
        stmt = stmt.order_by(CrmFollowUp.due_at.desc())
    if priority:
        stmt = stmt.where(CrmFollowUp.priority == svc.check_choice(priority, svc.FOLLOW_UP_PRIORITIES, "priority"))
    for col, value in ((CrmFollowUp.assigned_to_id, assigned_to_id), (CrmFollowUp.landlord_id, landlord_id),
                       (CrmFollowUp.lead_id, lead_id), (CrmFollowUp.property_id, property_id), (CrmFollowUp.deal_id, deal_id)):
        if value:
            stmt = stmt.where(col == value)
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(CrmFollowUp.title.ilike(pattern), CrmFollowUp.notes.ilike(pattern)))
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload([follow_up_dict(r) for r in rows], total, page, page_size)


async def _follow_up_by_id(db: AsyncSession, follow_up_id: UUID) -> dict:
    row = (await db.execute(follow_up_select().where(CrmFollowUp.id == follow_up_id))).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return follow_up_dict(row)


async def _apply_follow_up(db: AsyncSession, f: CrmFollowUp, data: dict) -> None:
    await ensure_exists(db, [(CrmLandlord, data.get("landlord_id"), "Landlord"), (CrmLead, data.get("lead_id"), "Client"),
                             (Property, data.get("property_id"), "Property"), (CrmDeal, data.get("deal_id"), "Deal"),
                             (User, data.get("assigned_to_id"), "User")])
    for field in ("landlord_id", "lead_id", "property_id", "deal_id", "assigned_to_id"):
        if field in data:
            setattr(f, field, data[field])
    if "title" in data:
        title = clean_text(data["title"])
        if not title:
            raise HTTPException(status_code=400, detail="Title is required.")
        f.title = title
    if data.get("due_at") is not None:
        f.due_at = svc.as_aware(data["due_at"])
    if "notes" in data:
        f.notes = clean_text(data["notes"])
    if "priority" in data:
        f.priority = svc.check_choice(data["priority"], svc.FOLLOW_UP_PRIORITIES, "priority", required=True)


@router.post("/follow-ups", status_code=201)
async def create_follow_up(body: FollowUpCreate, db: DbSession, user: AdminUser):
    data = body.model_dump(exclude_unset=True)
    f = CrmFollowUp(created_by_id=user.id, status="PENDING", priority="MEDIUM", assigned_to_id=user.id)
    await _apply_follow_up(db, f, data)
    if data.get("status"):
        f.status = svc.check_choice(data["status"], svc.FOLLOW_UP_STATUSES, "status", required=True)
    db.add(f)
    await db.flush()
    due = f.due_at.astimezone(svc.KIGALI_TZ).strftime("%d %b %Y %H:%M")
    svc.log_activity(db, Event.FOLLOW_UP_CREATED, f"Follow-up added: {f.title} (due {due})", user=user,
                     property_id=f.property_id, landlord_id=f.landlord_id, lead_id=f.lead_id, deal_id=f.deal_id)
    await _sync_landlord_next_follow_up(db, f.landlord_id)
    await db.commit()
    return await _follow_up_by_id(db, f.id)


@router.patch("/follow-ups/{follow_up_id}")
async def update_follow_up(follow_up_id: UUID, body: FollowUpUpdate, db: DbSession, user: AdminUser):
    f = await get_or_404(db, CrmFollowUp, follow_up_id, "Follow-up")
    data = body.model_dump(exclude_unset=True)
    old_landlord, old_status = f.landlord_id, f.status
    await _apply_follow_up(db, f, data)
    if "status" in data:
        f.status = svc.check_choice(data["status"], svc.FOLLOW_UP_STATUSES, "status", required=True)
        if f.status == "COMPLETED" and old_status != "COMPLETED":
            f.completed_at = svc.utcnow()
            svc.log_activity(db, Event.FOLLOW_UP_COMPLETED, f"Follow-up completed: {f.title}", user=user, note=f.notes,
                             property_id=f.property_id, landlord_id=f.landlord_id, lead_id=f.lead_id, deal_id=f.deal_id)
        elif f.status != "COMPLETED":
            f.completed_at = None
    await _sync_landlord_next_follow_up(db, old_landlord, f.landlord_id)
    await db.commit()
    return await _follow_up_by_id(db, follow_up_id)


@router.delete("/follow-ups/{follow_up_id}", status_code=204)
async def delete_follow_up(follow_up_id: UUID, db: DbSession, user: AdminUser):
    f = await get_or_404(db, CrmFollowUp, follow_up_id, "Follow-up")
    landlord_id = f.landlord_id
    await db.delete(f)
    await _sync_landlord_next_follow_up(db, landlord_id)
    await db.commit()


# --- Documents ------------------------------------------------------------------------

_Uploader = aliased(User)


def _document_select():
    return (
        select(
            CrmDocument,
            CrmLandlord.name.label("landlord_name"),
            CrmLead.name.label("lead_name"),
            Property.crm_ref.label("property_ref"),
            user_name_expr(_Uploader).label("uploaded_by_name"),
        )
        .outerjoin(CrmLandlord, CrmLandlord.id == CrmDocument.landlord_id)
        .outerjoin(CrmLead, CrmLead.id == CrmDocument.lead_id)
        .outerjoin(Property, Property.id == CrmDocument.property_id)
        .outerjoin(_Uploader, _Uploader.id == CrmDocument.uploaded_by_id)
    )


def _document_dict(row) -> dict:
    d: CrmDocument = row[0]
    return {
        "id": str(d.id),
        "title": d.title,
        "doc_type": d.doc_type,
        "storage": d.storage,
        "file_name": d.file_name,
        "file_format": d.file_format,
        "size_bytes": d.size_bytes,
        "notes": d.notes,
        "landlord_id": str(d.landlord_id) if d.landlord_id else None,
        "landlord_name": row.landlord_name,
        "lead_id": str(d.lead_id) if d.lead_id else None,
        "lead_name": row.lead_name,
        "property_id": str(d.property_id) if d.property_id else None,
        "property_ref": row.property_ref,
        "deal_id": str(d.deal_id) if d.deal_id else None,
        "uploaded_by_name": row.uploaded_by_name,
        "created_at": iso(d.created_at),
    }


async def document_rows(db: AsyncSession, *conditions, limit: int = 50) -> list[dict]:
    rows = (await db.execute(_document_select().where(*conditions).order_by(CrmDocument.created_at.desc()).limit(limit))).all()
    return [_document_dict(r) for r in rows]


@router.get("/documents")
async def list_documents(
    db: DbSession,
    doc_type: str | None = None,
    landlord_id: UUID | None = None,
    lead_id: UUID | None = None,
    property_id: UUID | None = None,
    deal_id: UUID | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    stmt = _document_select()
    if doc_type:
        stmt = stmt.where(CrmDocument.doc_type == svc.check_choice(doc_type, svc.DOCUMENT_TYPES, "document type"))
    for col, value in ((CrmDocument.landlord_id, landlord_id), (CrmDocument.lead_id, lead_id),
                       (CrmDocument.property_id, property_id), (CrmDocument.deal_id, deal_id)):
        if value:
            stmt = stmt.where(col == value)
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(CrmDocument.title.ilike(pattern), CrmDocument.file_name.ilike(pattern)))
    stmt = stmt.order_by(CrmDocument.created_at.desc())
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload([_document_dict(r) for r in rows], total, page, page_size,
                        storage_configured=docs.storage_configured())


def _log_document(db: AsyncSession, doc: CrmDocument, user: User, event: str = Event.DOCUMENT_ADDED) -> None:
    verb = "added" if event == Event.DOCUMENT_ADDED else "deleted"
    svc.log_activity(db, event, f"Document {verb}: {doc.title}", user=user, property_id=doc.property_id,
                     landlord_id=doc.landlord_id, lead_id=doc.lead_id, deal_id=doc.deal_id,
                     meta={"doc_type": doc.doc_type})


async def _document_by_id(db: AsyncSession, doc_id: UUID) -> dict:
    row = (await db.execute(_document_select().where(CrmDocument.id == doc_id))).one()
    return _document_dict(row)


@router.post("/documents", status_code=201)
async def upload_document(
    db: DbSession,
    user: AdminUser,
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    landlord_id: UUID | None = Form(default=None),
    lead_id: UUID | None = Form(default=None),
    property_id: UUID | None = Form(default=None),
    deal_id: UUID | None = Form(default=None),
):
    require_any_relation(landlord_id=landlord_id, lead_id=lead_id, property_id=property_id, deal_id=deal_id)
    await ensure_exists(db, [(CrmLandlord, landlord_id, "Landlord"), (CrmLead, lead_id, "Client"),
                             (Property, property_id, "Property"), (CrmDeal, deal_id, "Deal")])
    data = await file.read(docs.MAX_DOCUMENT_BYTES + 1)
    try:
        stored = await asyncio.to_thread(docs.upload_private_document, data, file.filename or "document")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    doc = CrmDocument(
        title=clean_text(title) or (file.filename or "Document"),
        doc_type=svc.check_choice(doc_type, svc.DOCUMENT_TYPES, "document type") or "OTHER",
        landlord_id=landlord_id, lead_id=lead_id, property_id=property_id, deal_id=deal_id,
        storage="cloudinary", storage_key=stored["storage_key"], resource_type=stored["resource_type"],
        file_format=stored["file_format"], file_name=(file.filename or "")[:255] or None,
        mime_type=(file.content_type or "")[:100] or None, size_bytes=stored["size_bytes"],
        notes=clean_text(notes), uploaded_by_id=user.id, created_at=svc.utcnow(),
    )
    db.add(doc)
    await db.flush()
    _log_document(db, doc, user)
    await db.commit()
    return await _document_by_id(db, doc.id)


@router.post("/documents/link", status_code=201)
async def add_document_link(body: DocumentLinkCreate, db: DbSession, user: AdminUser):
    require_any_relation(landlord_id=body.landlord_id, lead_id=body.lead_id, property_id=body.property_id, deal_id=body.deal_id)
    await ensure_exists(db, [(CrmLandlord, body.landlord_id, "Landlord"), (CrmLead, body.lead_id, "Client"),
                             (Property, body.property_id, "Property"), (CrmDeal, body.deal_id, "Deal")])
    parsed = urlparse(body.external_url.strip())
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Document links must be https URLs.")
    doc = CrmDocument(
        title=body.title.strip(), doc_type=svc.check_choice(body.doc_type, svc.DOCUMENT_TYPES, "document type") or "OTHER",
        landlord_id=body.landlord_id, lead_id=body.lead_id, property_id=body.property_id, deal_id=body.deal_id,
        storage="link", external_url=body.external_url.strip(), notes=clean_text(body.notes),
        uploaded_by_id=user.id, created_at=svc.utcnow(),
    )
    db.add(doc)
    await db.flush()
    _log_document(db, doc, user)
    await db.commit()
    return await _document_by_id(db, doc.id)


@router.get("/documents/{doc_id}/download")
async def document_download(doc_id: UUID, db: DbSession):
    doc = await get_or_404(db, CrmDocument, doc_id, "Document")
    if doc.storage == "link":
        return {"url": doc.external_url, "expires_in": None}
    if not doc.storage_key:
        raise HTTPException(status_code=404, detail="File missing")
    url = docs.signed_download_url(doc.storage_key, doc.resource_type)
    return {"url": url, "expires_in": docs.DOWNLOAD_URL_TTL_SECONDS}


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: UUID, db: DbSession, user: AdminUser):
    doc = await get_or_404(db, CrmDocument, doc_id, "Document")
    if doc.storage == "cloudinary" and doc.storage_key:
        await asyncio.to_thread(docs.delete_private_document, doc.storage_key, doc.resource_type)
    _log_document(db, doc, user, Event.DOCUMENT_DELETED)
    await db.delete(doc)
    await db.commit()
