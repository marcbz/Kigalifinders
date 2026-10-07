"""Internal Property CRM — core endpoints (admin-only, never public)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.crm_common import (
    activity_dict,
    activity_rows,
    clean_text,
    deal_dict,
    deal_select,
    ensure_exists,
    enum_value,
    get_or_404,
    iso,
    page_payload,
    paginate,
    public_property_url,
    search_pattern,
    user_name_expr,
)
from app.core.deps import STAFF_ROLES, require_admin
from app.database.session import get_db
from app.models import (
    CrmActivity,
    CrmDeal,
    CrmDocument,
    CrmFollowUp,
    CrmLandlord,
    CrmLead,
    CrmLeadProperty,
    CrmViewing,
    District,
    ListingType,
    Neighborhood,
    Property,
    PropertyImage,
    PropertyType,
    Role,
    User,
)
from app.schemas.crm import (
    ActivityNote,
    AvailabilityChange,
    AvailabilityConfirm,
    ContactLog,
    CrmSettingsUpdate,
    LandlordCreate,
    LandlordUpdate,
    LeadCreate,
    LeadPropertyLink,
    LeadUpdate,
    AddToCrm,
    PropertyCrmCreate,
    PropertyCrmUpdate,
    PropertyDetailsUpdate,
)
from app.services import crm as svc
from app.services.crm import Event

router = APIRouter(prefix="/admin/crm", tags=["Admin CRM"], dependencies=[Depends(require_admin)])

DbSession = Annotated[AsyncSession, Depends(get_db)]
AdminUser = Annotated[User, Depends(require_admin)]


# --- Settings & lookups ---------------------------------------------------------------


@router.get("/settings")
async def get_settings(db: DbSession):
    return await svc.get_crm_settings(db)


@router.put("/settings")
async def update_settings(body: CrmSettingsUpdate, db: DbSession, user: AdminUser):
    values = await svc.save_crm_settings(db, body.model_dump(exclude_unset=True))
    await db.commit()
    await svc.flag_stale_properties(db, force=True)
    return values


@router.get("/lookups")
async def lookups(db: DbSession):
    districts = (await db.execute(select(District.id, District.name).order_by(District.name))).all()
    neighborhoods = (
        await db.execute(select(Neighborhood.id, Neighborhood.name, Neighborhood.district_id).order_by(Neighborhood.name))
    ).all()
    types = (await db.execute(select(PropertyType.id, PropertyType.name).order_by(PropertyType.name))).all()
    users = (
        await db.execute(
            select(User.id, user_name_expr().label("name"))
            .join(Role, Role.id == User.role_id)
            .where(Role.name.in_(STAFF_ROLES), User.is_active.is_(True))
            .order_by(user_name_expr())
        )
    ).all()
    landlords = (
        await db.execute(select(CrmLandlord.id, CrmLandlord.name).order_by(CrmLandlord.name).limit(1000))
    ).all()
    return {
        "districts": [{"id": str(r.id), "name": r.name} for r in districts],
        "neighborhoods": [{"id": str(r.id), "name": r.name, "district_id": str(r.district_id)} for r in neighborhoods],
        "property_types": [{"id": str(r.id), "name": r.name} for r in types],
        "users": [{"id": str(r.id), "name": r.name} for r in users],
        "landlords": [{"id": str(r.id), "name": r.name} for r in landlords],
        "vocab": {
            "availability": svc.AVAILABILITY_STATUSES,
            "landlord_status": svc.LANDLORD_STATUSES,
            "contact_methods": svc.CONTACT_METHODS,
            "lead_status": svc.LEAD_STATUSES,
            "lead_source": svc.LEAD_SOURCES,
            "furnishing": svc.FURNISHING_OPTIONS,
            "viewing_status": svc.VIEWING_STATUSES,
            "interest_level": svc.INTEREST_LEVELS,
            "deal_status": svc.DEAL_STATUSES,
            "commission_type": svc.COMMISSION_TYPES,
            "commission_status": svc.COMMISSION_STATUSES,
            "follow_up_status": svc.FOLLOW_UP_STATUSES,
            "follow_up_priority": svc.FOLLOW_UP_PRIORITIES,
            "document_type": svc.DOCUMENT_TYPES,
            "currency": svc.CURRENCIES,
        },
    }


# --- Dashboard ------------------------------------------------------------------------


def _scalar(stmt):
    return stmt.scalar_subquery()


@router.get("/dashboard")
async def dashboard(db: DbSession):
    await svc.flag_stale_properties(db)
    day_start, day_end = svc.kigali_day_bounds()
    month_start = svc.kigali_month_start()
    today = svc.kigali_today()
    P = Property

    kpi_row = (
        await db.execute(
            select(
                _scalar(select(func.count(CrmLandlord.id))).label("landlords_total"),
                _scalar(select(func.count(CrmLandlord.id)).where(CrmLandlord.status == "ACTIVE")).label("landlords_active"),
                _scalar(select(func.count(CrmLead.id)).where(CrmLead.status.in_(svc.ACTIVE_LEAD_STATUSES))).label("leads_active"),
                _scalar(
                    select(func.count(CrmViewing.id)).where(
                        CrmViewing.scheduled_at >= day_start,
                        CrmViewing.scheduled_at < day_end,
                        CrmViewing.status.notin_(("CANCELLED",)),
                    )
                ).label("viewings_today"),
                _scalar(
                    select(func.count(CrmDeal.id)).where(CrmDeal.status == "COMPLETED", CrmDeal.completed_at >= month_start)
                ).label("deals_this_month"),
                _scalar(
                    select(func.coalesce(func.sum(CrmDeal.commission_amount_usd), 0)).where(CrmDeal.commission_status == "PAID")
                ).label("commission_earned_usd"),
                _scalar(
                    select(func.coalesce(func.sum(CrmDeal.commission_amount_usd), 0)).where(
                        CrmDeal.commission_status.in_(svc.UNPAID_COMMISSION_STATUSES),
                        CrmDeal.status != "CANCELLED",
                    )
                ).label("commission_pending_usd"),
                _scalar(
                    select(func.count(CrmFollowUp.id)).where(
                        CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES), CrmFollowUp.due_at < day_end
                    )
                ).label("follow_ups_due"),
                _scalar(
                    select(func.count(CrmFollowUp.id)).where(
                        CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES), CrmFollowUp.due_at < day_start
                    )
                ).label("follow_ups_overdue"),
            )
        )
    ).one()
    by_availability = dict(
        (
            await db.execute(
                select(P.availability_status, func.count(P.id)).where(P.in_crm.is_(True)).group_by(P.availability_status)
            )
        ).all()
    )

    verify_rows = (
        await db.execute(
            select(
                P.id, P.crm_ref, P.title, P.availability_verified_at, P.availability_updated_at,
                CrmLandlord.name.label("landlord_name"), Neighborhood.name.label("neighborhood_name"),
            )
            .outerjoin(CrmLandlord, CrmLandlord.id == P.landlord_id)
            .outerjoin(Neighborhood, Neighborhood.id == P.neighborhood_id)
            .where(P.in_crm.is_(True), P.availability_status == "VERIFY")
            .order_by(func.coalesce(P.availability_verified_at, P.created_at).asc())
            .limit(8)
        )
    ).all()

    follow_ups = await _follow_up_rows(
        db,
        CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES),
        CrmFollowUp.due_at < day_end,
        order=CrmFollowUp.due_at.asc(),
        limit=10,
    )
    upcoming_viewings = await _viewing_rows(
        db,
        CrmViewing.scheduled_at >= day_start,
        CrmViewing.scheduled_at < day_start + timedelta(days=7),
        CrmViewing.status.in_(svc.UPCOMING_VIEWING_STATUSES),
        order=CrmViewing.scheduled_at.asc(),
        limit=8,
    )
    recent_leads = (
        await db.execute(
            select(CrmLead.id, CrmLead.name, CrmLead.status, CrmLead.source, CrmLead.budget_max, CrmLead.currency, CrmLead.created_at)
            .order_by(CrmLead.created_at.desc())
            .limit(6)
        )
    ).all()
    recent_deals = (await db.execute(deal_select().order_by(CrmDeal.created_at.desc()).limit(6))).all()

    return {
        "kpis": {
            "landlords_total": kpi_row.landlords_total,
            "landlords_active": kpi_row.landlords_active,
            "properties_total": sum(by_availability.values()),
            "available": by_availability.get("AVAILABLE", 0),
            "verify": by_availability.get("VERIFY", 0),
            "reserved": by_availability.get("RESERVED", 0),
            "rented": by_availability.get("RENTED", 0),
            "unavailable": by_availability.get("UNAVAILABLE", 0),
            "leads_active": kpi_row.leads_active,
            "viewings_today": kpi_row.viewings_today,
            "deals_this_month": kpi_row.deals_this_month,
            "commission_earned_usd": round(float(kpi_row.commission_earned_usd or 0), 2),
            "commission_pending_usd": round(float(kpi_row.commission_pending_usd or 0), 2),
            "follow_ups_due": kpi_row.follow_ups_due,
            "follow_ups_overdue": kpi_row.follow_ups_overdue,
        },
        "needs_verification": [
            {
                "id": str(r.id), "crm_ref": r.crm_ref, "title": r.title, "landlord_name": r.landlord_name,
                "neighborhood_name": r.neighborhood_name, "availability_verified_at": iso(r.availability_verified_at),
            }
            for r in verify_rows
        ],
        "follow_ups": follow_ups,
        "upcoming_viewings": upcoming_viewings,
        "recent_leads": [
            {
                "id": str(r.id), "name": r.name, "status": r.status, "source": r.source,
                "budget_max": r.budget_max, "currency": r.currency, "created_at": iso(r.created_at),
            }
            for r in recent_leads
        ],
        "recent_deals": [deal_dict(r, today) for r in recent_deals],
        "recent_activity": await activity_rows(db, limit=12),
        "today": today.isoformat(),
    }


async def _follow_up_rows(db: AsyncSession, *conditions, order, limit: int) -> list[dict]:
    from app.api.v1.endpoints.crm_ops import follow_up_select, follow_up_dict

    rows = (await db.execute(follow_up_select().where(*conditions).order_by(order).limit(limit))).all()
    return [follow_up_dict(r) for r in rows]


async def _viewing_rows(db: AsyncSession, *conditions, order, limit: int) -> list[dict]:
    from app.api.v1.endpoints.crm_ops import viewing_dict, viewing_select

    rows = (await db.execute(viewing_select().where(*conditions).order_by(order).limit(limit))).all()
    return [viewing_dict(r) for r in rows]


# --- Properties -----------------------------------------------------------------------

PROPERTY_SORTS = {
    "ref": Property.crm_ref,
    "title": Property.title,
    "rent": func.coalesce(Property.usd_price, Property.price),
    "availability": Property.availability_status,
    "verified": Property.availability_verified_at,
    "updated": Property.availability_updated_at,
    "created": Property.created_at,
    "landlord": CrmLandlord.name,
    "location": Neighborhood.name,
    "bedrooms": Property.bedrooms,
}


def _property_list_select():
    P = Property
    return (
        select(
            P.id, P.crm_ref, P.slug, P.title, P.status, P.listing_type, P.price, P.currency, P.usd_price,
            P.price_period, P.bedrooms, P.bathrooms, P.is_furnished, P.availability_status,
            P.availability_updated_at, P.availability_verified_at, P.availability_note, P.landlord_id,
            P.created_at, P.commission_type, P.commission_value, P.commission_currency, P.in_crm,
            CrmLandlord.name.label("landlord_name"),
            District.name.label("district_name"),
            Neighborhood.name.label("neighborhood_name"),
            PropertyType.name.label("property_type_name"),
        )
        .outerjoin(CrmLandlord, CrmLandlord.id == P.landlord_id)
        .outerjoin(District, District.id == P.district_id)
        .outerjoin(Neighborhood, Neighborhood.id == P.neighborhood_id)
        .outerjoin(PropertyType, PropertyType.id == P.property_type_id)
    )


def _property_row(r, cutoff: datetime) -> dict:
    last_check = r.availability_verified_at or r.availability_updated_at or r.created_at
    return {
        "id": str(r.id),
        "crm_ref": r.crm_ref,
        "in_crm": r.in_crm,
        "slug": r.slug,
        "public_url": public_property_url(r.slug),
        "title": r.title,
        "published": enum_value(r.status) in ("published", "PUBLISHED"),
        "publication_status": enum_value(r.status),
        "listing_type": enum_value(r.listing_type),
        "price": r.price,
        "currency": r.currency,
        "usd_price": r.usd_price,
        "price_period": r.price_period,
        "bedrooms": r.bedrooms,
        "bathrooms": r.bathrooms,
        "is_furnished": r.is_furnished,
        "availability_status": r.availability_status,
        "availability_updated_at": iso(r.availability_updated_at),
        "availability_verified_at": iso(r.availability_verified_at),
        "availability_note": r.availability_note,
        "verification_due": r.availability_status == "VERIFY"
        or (r.availability_status == "AVAILABLE" and last_check is not None and last_check < cutoff),
        "landlord_id": str(r.landlord_id) if r.landlord_id else None,
        "landlord_name": r.landlord_name,
        "district_name": r.district_name,
        "neighborhood_name": r.neighborhood_name,
        "property_type_name": r.property_type_name,
        "commission_type": r.commission_type,
        "commission_value": r.commission_value,
        "commission_currency": r.commission_currency,
        "created_at": iso(r.created_at),
    }


@router.get("/properties")
async def list_properties(
    db: DbSession,
    q: str | None = None,
    district_id: UUID | None = None,
    neighborhood_id: UUID | None = None,
    availability: str | None = None,
    landlord_id: UUID | None = None,
    no_landlord: bool = False,
    property_type_id: UUID | None = None,
    bedrooms: int | None = Query(default=None, ge=0),
    min_rent: float | None = Query(default=None, ge=0),
    max_rent: float | None = Query(default=None, ge=0),
    published: bool | None = None,
    verification_due: bool = False,
    sort: str = "ref",
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 25,
):
    await svc.flag_stale_properties(db)
    cfg = await svc.get_crm_settings(db)
    cutoff = svc.verification_cutoff(int(cfg["verify_after_days"]))
    P = Property
    stmt = _property_list_select().where(P.in_crm.is_(True))
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(
            or_(
                P.title.ilike(pattern),
                P.crm_ref.ilike(pattern),
                P.slug.ilike(pattern),
                CrmLandlord.name.ilike(pattern),
                Neighborhood.name.ilike(pattern),
            )
        )
    if district_id:
        stmt = stmt.where(P.district_id == district_id)
    if neighborhood_id:
        stmt = stmt.where(P.neighborhood_id == neighborhood_id)
    if availability:
        stmt = stmt.where(P.availability_status == svc.check_choice(availability, svc.AVAILABILITY_STATUSES, "availability"))
    if landlord_id:
        stmt = stmt.where(P.landlord_id == landlord_id)
    elif no_landlord:
        stmt = stmt.where(P.landlord_id.is_(None))
    if property_type_id:
        stmt = stmt.where(P.property_type_id == property_type_id)
    if bedrooms is not None:
        stmt = stmt.where(P.bedrooms >= bedrooms) if bedrooms >= 5 else stmt.where(P.bedrooms == bedrooms)
    rent = func.coalesce(P.usd_price, P.price)
    if min_rent is not None:
        stmt = stmt.where(rent >= min_rent)
    if max_rent is not None:
        stmt = stmt.where(rent <= max_rent)
    if published is not None:
        from app.models import PropertyStatusEnum

        cond = P.status == PropertyStatusEnum.PUBLISHED
        stmt = stmt.where(cond if published else ~cond)
    if verification_due:
        stmt = stmt.where(or_(P.availability_status == "VERIFY", svc.stale_condition(cutoff)))

    sort_col = PROPERTY_SORTS.get(sort, P.crm_ref)
    stmt = stmt.order_by(sort_col.asc().nulls_last() if order == "asc" else sort_col.desc().nulls_last(), P.id)
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload(
        [_property_row(r, cutoff) for r in rows], total, page, page_size,
        verify_after_days=int(cfg["verify_after_days"]),
    )


@router.get("/properties/candidates")
async def property_candidates(db: DbSession, q: str | None = None, limit: int = Query(default=15, ge=1, le=50)):
    """Website listings that are not in the CRM yet, for the "add existing listing" picker."""
    P = Property
    stmt = (
        select(P.id, P.title, P.status, P.price, P.currency, P.bedrooms, Neighborhood.name.label("neighborhood_name"))
        .outerjoin(Neighborhood, Neighborhood.id == P.neighborhood_id)
        .where(P.in_crm.is_(False))
    )
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(P.title.ilike(pattern), P.slug.ilike(pattern), Neighborhood.name.ilike(pattern)))
    rows = (await db.execute(stmt.order_by(P.created_at.desc()).limit(limit))).all()
    return {
        "items": [
            {"id": str(r.id), "title": r.title, "publication_status": enum_value(r.status), "price": r.price,
             "currency": r.currency, "bedrooms": r.bedrooms, "neighborhood_name": r.neighborhood_name}
            for r in rows
        ]
    }


async def _apply_property_details(db: AsyncSession, prop: Property, data: dict) -> None:
    from slugify import slugify

    from app.api.v1.endpoints.properties import _resolve_property_types, _unique_slug
    from app.models import PropertyStatusEnum
    from app.services.fx import get_default_fx_provider, resolve_property_usd_fields, store_rate

    await ensure_exists(db, [
        (District, data.get("district_id"), "District"),
        (Neighborhood, data.get("neighborhood_id"), "Area"),
        (PropertyType, data.get("property_type_id"), "Property type"),
        (CrmLandlord, data.get("landlord_id"), "Landlord"),
    ])
    if "title" in data and data["title"]:
        prop.title = data["title"].strip()
        if prop.status != PropertyStatusEnum.PUBLISHED:
            prop.slug = await _unique_slug(db, slugify(prop.title), exclude_id=prop.id)
    if data.get("listing_type"):
        try:
            prop.listing_type = ListingType(data["listing_type"].lower())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid listing type.") from exc
    if data.get("price") is not None:
        prop.price = float(data["price"])
    if data.get("currency"):
        prop.currency = svc.check_choice(data["currency"], svc.CURRENCIES, "currency")
    if "price_period" in data:
        prop.price_period = clean_text(data["price_period"])
    for field in ("bedrooms", "bathrooms", "area_sqm", "district_id", "neighborhood_id", "landlord_id"):
        if field in data:
            setattr(prop, field, data[field])
    if "property_type_id" in data:
        prop.property_type_id, prop.property_type_ids = _resolve_property_types(data["property_type_id"], [])
    if "address" in data:
        prop.address = clean_text(data["address"])
    if data.get("is_furnished") is not None:
        prop.is_furnished = bool(data["is_furnished"])
    if "crm_notes" in data:
        prop.crm_notes = clean_text(data["crm_notes"])
    _apply_commission_fields(prop, data)
    if "price" in data or "currency" in data:
        fx = await get_default_fx_provider().get_rate("USD", "RWF")
        await store_rate(db, fx)
        for k, v in resolve_property_usd_fields(prop.price, prop.currency, fx).items():
            setattr(prop, k, v)


@router.post("/properties", status_code=201)
async def create_crm_property(body: PropertyCrmCreate, db: DbSession, user: AdminUser):
    """A new CRM property. It is saved as an unpublished draft, so it is not on the website until published."""
    from app.models import PropertyStatusEnum

    data = body.model_dump(exclude_unset=True)
    availability = data.pop("availability_status", None)
    prop = Property(
        title=data["title"].strip(), slug="", price=data["price"], currency="USD", price_period="month",
        status=PropertyStatusEnum.DRAFT, listing_type=ListingType.RENT, data_source_kind="verified_kigali_rent",
    )
    data.setdefault("currency", "USD")
    await _apply_property_details(db, prop, data)
    if not prop.slug:
        from slugify import slugify

        from app.api.v1.endpoints.properties import _unique_slug

        prop.slug = await _unique_slug(db, slugify(prop.title))
    db.add(prop)
    await db.flush()
    await svc.add_to_crm(db, prop, user=user, availability=availability)
    await db.commit()
    return await get_property(prop.id, db)


@router.patch("/properties/{property_id}/details")
async def update_property_details(property_id: UUID, body: PropertyDetailsUpdate, db: DbSession, user: AdminUser):
    prop = await get_or_404(db, Property, property_id, "Property")
    data = body.model_dump(exclude_unset=True)
    old_price, old_currency = prop.price, prop.currency
    await _apply_property_details(db, prop, data)
    if (prop.price, prop.currency) != (old_price, old_currency):
        svc.log_activity(
            db, Event.PRICE_CHANGED, f"{prop.crm_ref}: price {old_price:,.0f} {old_currency} → {prop.price:,.0f} {prop.currency}",
            user=user, property_id=prop.id, landlord_id=prop.landlord_id,
        )
    if data:
        svc.log_activity(db, Event.PROPERTY_UPDATED, f"{prop.crm_ref}: details updated", user=user,
                         property_id=prop.id, landlord_id=prop.landlord_id, meta={"fields": sorted(data.keys())})
    await db.commit()
    return await get_property(property_id, db)


@router.post("/properties/{property_id}/add")
async def add_property_to_crm(property_id: UUID, body: AddToCrm, db: DbSession, user: AdminUser):
    prop = await get_or_404(db, Property, property_id, "Property")
    await svc.add_to_crm(db, prop, user=user, availability=body.availability_status)
    await db.commit()
    return await get_property(property_id, db)


@router.post("/properties/{property_id}/remove")
async def remove_property_from_crm(property_id: UUID, db: DbSession, user: AdminUser):
    """Take a property out of the CRM. The listing itself (and any website page) is untouched."""
    prop = await get_or_404(db, Property, property_id, "Property")
    svc.remove_from_crm(db, prop, user=user)
    await db.commit()
    return {"ok": True}


@router.delete("/properties/{property_id}", status_code=204)
async def delete_crm_property(property_id: UUID, db: DbSession, user: AdminUser):
    """Permanently delete an unpublished property. Published listings must be unpublished or removed from the CRM instead."""
    from app.models import PropertyStatusEnum

    prop = await get_or_404(db, Property, property_id, "Property")
    if prop.status == PropertyStatusEnum.PUBLISHED:
        raise HTTPException(
            status_code=400,
            detail="This listing is live on the website. Remove it from the CRM, or unpublish it first if you really want to delete it.",
        )
    svc.log_activity(db, Event.PROPERTY_DELETED, f"{prop.crm_ref or prop.title}: property deleted ({prop.title})", user=user,
                     landlord_id=prop.landlord_id)
    await db.delete(prop)
    await db.commit()


@router.get("/properties/{property_id}")
async def get_property(property_id: UUID, db: DbSession):
    cfg = await svc.get_crm_settings(db)
    cutoff = svc.verification_cutoff(int(cfg["verify_after_days"]))
    P = Property
    row = (await db.execute(_property_list_select().where(P.id == property_id))).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Property not found")
    base = _property_row(row, cutoff)

    extra = (
        await db.execute(
            select(
                P.crm_notes, P.address, P.area_sqm, P.district_id, P.neighborhood_id, P.property_type_id,
                user_name_expr().label("verified_by_name"),
            )
            .outerjoin(User, User.id == P.availability_verified_by_id)
            .where(P.id == property_id)
        )
    ).one()
    image = (
        await db.execute(
            select(PropertyImage.url)
            .where(PropertyImage.property_id == property_id)
            .order_by(PropertyImage.is_primary.desc(), PropertyImage.sort_order)
            .limit(1)
        )
    ).scalar_one_or_none()
    landlord = None
    if row.landlord_id:
        ll = await db.get(CrmLandlord, row.landlord_id)
        if ll:
            landlord = _landlord_basic(ll)

    leads = (
        await db.execute(
            select(CrmLead.id, CrmLead.name, CrmLead.status, CrmLead.phone, CrmLeadProperty.note, CrmLeadProperty.created_at)
            .join(CrmLeadProperty, CrmLeadProperty.lead_id == CrmLead.id)
            .where(CrmLeadProperty.property_id == property_id)
            .order_by(CrmLeadProperty.created_at.desc())
            .limit(50)
        )
    ).all()
    from app.api.v1.endpoints.crm_ops import document_rows, follow_up_dict, follow_up_select, viewing_dict, viewing_select

    viewings = (
        await db.execute(viewing_select().where(CrmViewing.property_id == property_id).order_by(CrmViewing.scheduled_at.desc()).limit(25))
    ).all()
    deals = (await db.execute(deal_select().where(CrmDeal.property_id == property_id).order_by(CrmDeal.created_at.desc()).limit(25))).all()
    follow_ups = (
        await db.execute(
            follow_up_select().where(CrmFollowUp.property_id == property_id).order_by(CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES).desc(), CrmFollowUp.due_at).limit(25)
        )
    ).all()
    today = svc.kigali_today()
    return {
        **base,
        "crm_notes": extra.crm_notes,
        "address": extra.address,
        "area_sqm": extra.area_sqm,
        "district_id": str(extra.district_id) if extra.district_id else None,
        "neighborhood_id": str(extra.neighborhood_id) if extra.neighborhood_id else None,
        "property_type_id": str(extra.property_type_id) if extra.property_type_id else None,
        "availability_verified_by": extra.verified_by_name if base["availability_verified_at"] else None,
        "image_url": image,
        "verify_after_days": int(cfg["verify_after_days"]),
        "landlord": landlord,
        "effective_commission": _effective_commission(row, landlord),
        "leads": [
            {"id": str(r.id), "name": r.name, "status": r.status, "phone": r.phone, "note": r.note, "linked_at": iso(r.created_at)}
            for r in leads
        ],
        "viewings": [viewing_dict(r) for r in viewings],
        "deals": [deal_dict(r, today) for r in deals],
        "follow_ups": [follow_up_dict(r) for r in follow_ups],
        "documents": await document_rows(db, CrmDocument.property_id == property_id),
        "activity": await activity_rows(db, CrmActivity.property_id == property_id, limit=40),
    }


def _effective_commission(row, landlord: dict | None) -> dict | None:
    if row.commission_type and row.commission_value is not None:
        return {"type": row.commission_type, "value": row.commission_value, "currency": row.commission_currency, "source": "property"}
    if landlord and landlord.get("commission_type") and landlord.get("commission_value") is not None:
        return {
            "type": landlord["commission_type"], "value": landlord["commission_value"],
            "currency": landlord.get("commission_currency"), "source": "landlord",
        }
    return None


def _apply_commission_fields(obj, data: dict) -> None:
    if "commission_type" in data:
        obj.commission_type = svc.check_choice(data["commission_type"], svc.COMMISSION_TYPES, "commission type")
    if "commission_value" in data:
        obj.commission_value = data["commission_value"]
    if "commission_currency" in data:
        obj.commission_currency = svc.check_choice(data["commission_currency"], svc.CURRENCIES, "commission currency")


@router.patch("/properties/{property_id}")
async def update_property_crm(property_id: UUID, body: PropertyCrmUpdate, db: DbSession, user: AdminUser):
    prop = await get_or_404(db, Property, property_id, "Property")
    data = body.model_dump(exclude_unset=True)
    changes: list[str] = []
    if "landlord_id" in data and data["landlord_id"] != prop.landlord_id:
        await ensure_exists(db, [(CrmLandlord, data["landlord_id"], "Landlord")])
        prop.landlord_id = data["landlord_id"]
        changes.append("landlord")
    if any(k in data for k in ("commission_type", "commission_value", "commission_currency")):
        _apply_commission_fields(prop, data)
        changes.append("commission agreement")
    if "crm_notes" in data:
        prop.crm_notes = clean_text(data["crm_notes"])
        changes.append("notes")
    if changes:
        svc.log_activity(
            db, Event.PROPERTY_UPDATED, f"{prop.crm_ref}: updated {', '.join(changes)}",
            user=user, property_id=prop.id, landlord_id=prop.landlord_id,
        )
    await db.commit()
    return await get_property(property_id, db)


@router.post("/properties/{property_id}/availability")
async def change_availability(property_id: UUID, body: AvailabilityChange, db: DbSession, user: AdminUser):
    prop = await get_or_404(db, Property, property_id, "Property")
    svc.set_availability(db, prop, body.status, user=user, note=body.note)
    await db.commit()
    return await get_property(property_id, db)


@router.post("/properties/{property_id}/confirm-available")
async def confirm_property_available(property_id: UUID, body: AvailabilityConfirm, db: DbSession, user: AdminUser):
    prop = await get_or_404(db, Property, property_id, "Property")
    svc.confirm_available(db, prop, user=user, note=body.note)
    await db.commit()
    return await get_property(property_id, db)


# --- Landlords ------------------------------------------------------------------------


def _landlord_basic(ll: CrmLandlord) -> dict:
    return {
        "id": str(ll.id),
        "name": ll.name,
        "phone": ll.phone,
        "whatsapp": ll.whatsapp,
        "email": ll.email,
        "preferred_contact": ll.preferred_contact,
        "status": ll.status,
        "notes": ll.notes,
        "commission_type": ll.commission_type,
        "commission_value": ll.commission_value,
        "commission_currency": ll.commission_currency,
        "commission_notes": ll.commission_notes,
        "last_contacted_at": iso(ll.last_contacted_at),
        "next_follow_up_at": iso(ll.next_follow_up_at),
        "created_at": iso(ll.created_at),
    }


def _landlord_counts_subquery():
    P = Property
    return (
        select(
            P.landlord_id.label("lid"),
            func.count(P.id).label("properties_total"),
            func.count(P.id).filter(P.availability_status.in_(("AVAILABLE", "VERIFY", "RESERVED"))).label("properties_active"),
            func.count(P.id).filter(P.availability_status == "RENTED").label("properties_rented"),
        )
        .where(P.landlord_id.is_not(None), P.in_crm.is_(True))
        .group_by(P.landlord_id)
        .subquery()
    )


LANDLORD_SORTS = {"name": CrmLandlord.name, "created": CrmLandlord.created_at, "contacted": CrmLandlord.last_contacted_at, "follow_up": CrmLandlord.next_follow_up_at}


@router.get("/landlords")
async def list_landlords(
    db: DbSession,
    q: str | None = None,
    status: str | None = None,
    sort: str = "name",
    order: Literal["asc", "desc"] = "asc",
    page: int = 1,
    page_size: int = 25,
):
    counts = _landlord_counts_subquery()
    stmt = select(
        CrmLandlord,
        func.coalesce(counts.c.properties_total, 0).label("properties_total"),
        func.coalesce(counts.c.properties_active, 0).label("properties_active"),
        func.coalesce(counts.c.properties_rented, 0).label("properties_rented"),
    ).outerjoin(counts, counts.c.lid == CrmLandlord.id)
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(CrmLandlord.name.ilike(pattern), CrmLandlord.phone.ilike(pattern),
                              CrmLandlord.whatsapp.ilike(pattern), CrmLandlord.email.ilike(pattern)))
    if status:
        stmt = stmt.where(CrmLandlord.status == svc.check_choice(status, svc.LANDLORD_STATUSES, "status"))
    sort_col = LANDLORD_SORTS.get(sort, CrmLandlord.name)
    stmt = stmt.order_by(sort_col.asc().nulls_last() if order == "asc" else sort_col.desc().nulls_last(), CrmLandlord.id)
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload(
        [
            {**_landlord_basic(r[0]), "properties_total": r.properties_total,
             "properties_active": r.properties_active, "properties_rented": r.properties_rented}
            for r in rows
        ],
        total, page, page_size,
    )


def _apply_landlord(ll: CrmLandlord, data: dict) -> None:
    for field in ("name", "phone", "whatsapp", "email", "notes", "commission_notes"):
        if field in data:
            value = clean_text(data[field])
            if field == "name" and not value:
                raise HTTPException(status_code=400, detail="Name is required.")
            setattr(ll, field, value)
    if "preferred_contact" in data:
        ll.preferred_contact = svc.check_choice(data["preferred_contact"], svc.CONTACT_METHODS, "preferred contact")
    if "status" in data:
        ll.status = svc.check_choice(data["status"], svc.LANDLORD_STATUSES, "status", required=True)
    if "next_follow_up_at" in data:
        ll.next_follow_up_at = svc.as_aware(data["next_follow_up_at"])
    _apply_commission_fields(ll, data)


@router.post("/landlords", status_code=201)
async def create_landlord(body: LandlordCreate, db: DbSession, user: AdminUser):
    ll = CrmLandlord(created_by_id=user.id, status="ACTIVE")
    _apply_landlord(ll, body.model_dump(exclude_unset=True))
    db.add(ll)
    await db.flush()
    svc.log_activity(db, Event.LANDLORD_CREATED, f"Landlord added: {ll.name}", user=user, landlord_id=ll.id)
    await db.commit()
    return _landlord_basic(ll)


@router.get("/landlords/{landlord_id}")
async def get_landlord(landlord_id: UUID, db: DbSession):
    ll = await get_or_404(db, CrmLandlord, landlord_id, "Landlord")
    cfg = await svc.get_crm_settings(db)
    cutoff = svc.verification_cutoff(int(cfg["verify_after_days"]))
    properties = (
        await db.execute(
            _property_list_select()
            .where(Property.landlord_id == landlord_id, Property.in_crm.is_(True))
            .order_by(Property.crm_ref.desc())
        )
    ).all()
    property_items = [_property_row(r, cutoff) for r in properties]
    today = svc.kigali_today()
    deals = (await db.execute(deal_select().where(CrmDeal.landlord_id == landlord_id).order_by(CrmDeal.created_at.desc()).limit(50))).all()
    commission = (
        await db.execute(
            select(
                func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(CrmDeal.commission_status == "PAID"), 0).label("paid"),
                func.coalesce(
                    func.sum(CrmDeal.commission_amount_usd).filter(
                        CrmDeal.commission_status.in_(svc.UNPAID_COMMISSION_STATUSES), CrmDeal.status != "CANCELLED"
                    ),
                    0,
                ).label("pending"),
                func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(svc.overdue_condition(CrmDeal, today)), 0).label("overdue"),
            ).where(CrmDeal.landlord_id == landlord_id)
        )
    ).one()
    from app.api.v1.endpoints.crm_ops import document_rows, follow_up_dict, follow_up_select

    follow_ups = (
        await db.execute(
            follow_up_select().where(CrmFollowUp.landlord_id == landlord_id)
            .order_by(CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES).desc(), CrmFollowUp.due_at).limit(50)
        )
    ).all()
    return {
        **_landlord_basic(ll),
        "properties_total": len(property_items),
        "properties_active": sum(1 for p in property_items if p["availability_status"] in ("AVAILABLE", "VERIFY", "RESERVED")),
        "properties_rented": sum(1 for p in property_items if p["availability_status"] == "RENTED"),
        "properties": property_items,
        "deals": [deal_dict(r, today) for r in deals],
        "commission_summary": {
            "paid_usd": round(float(commission.paid), 2),
            "pending_usd": round(float(commission.pending), 2),
            "overdue_usd": round(float(commission.overdue), 2),
        },
        "follow_ups": [follow_up_dict(r) for r in follow_ups],
        "documents": await document_rows(db, CrmDocument.landlord_id == landlord_id),
        "activity": await activity_rows(
            db,
            or_(CrmActivity.landlord_id == landlord_id, CrmActivity.property_id.in_([r.id for r in properties])),
            limit=50,
        ),
    }


@router.patch("/landlords/{landlord_id}")
async def update_landlord(landlord_id: UUID, body: LandlordUpdate, db: DbSession, user: AdminUser):
    ll = await get_or_404(db, CrmLandlord, landlord_id, "Landlord")
    data = body.model_dump(exclude_unset=True)
    _apply_landlord(ll, data)
    if data:
        svc.log_activity(db, Event.LANDLORD_UPDATED, f"Landlord updated: {ll.name}", user=user, landlord_id=ll.id,
                         meta={"fields": sorted(data.keys())})
    await db.commit()
    return _landlord_basic(ll)


@router.post("/landlords/{landlord_id}/contacted")
async def landlord_contacted(landlord_id: UUID, body: ContactLog, db: DbSession, user: AdminUser):
    ll = await get_or_404(db, CrmLandlord, landlord_id, "Landlord")
    method = svc.check_choice(body.method, svc.CONTACT_METHODS, "contact method")
    ll.last_contacted_at = svc.utcnow()
    svc.log_activity(
        db, Event.LANDLORD_CONTACTED, f"Landlord contacted: {ll.name}" + (f" via {method.title()}" if method else ""),
        user=user, note=body.note, landlord_id=ll.id, meta={"method": method} if method else None,
    )
    await db.commit()
    return _landlord_basic(ll)


@router.delete("/landlords/{landlord_id}", status_code=204)
async def delete_landlord(landlord_id: UUID, db: DbSession, user: AdminUser):
    ll = await get_or_404(db, CrmLandlord, landlord_id, "Landlord")
    linked = (
        await db.execute(select(func.count(Property.id)).where(Property.landlord_id == landlord_id, Property.in_crm.is_(True)))
    ).scalar_one()
    if linked:
        raise HTTPException(
            status_code=400,
            detail=f"This landlord still has {linked} propert{'y' if linked == 1 else 'ies'} in the CRM. "
            "Remove, delete or re-assign them first.",
        )
    await db.execute(update(Property).where(Property.landlord_id == landlord_id).values(landlord_id=None))
    await db.delete(ll)
    await db.commit()


# --- Leads ----------------------------------------------------------------------------


def _lead_select():
    return (
        select(
            CrmLead,
            District.name.label("district_name"),
            Neighborhood.name.label("neighborhood_name"),
            PropertyType.name.label("property_type_name"),
            user_name_expr().label("assigned_to_name"),
        )
        .outerjoin(District, District.id == CrmLead.district_id)
        .outerjoin(Neighborhood, Neighborhood.id == CrmLead.neighborhood_id)
        .outerjoin(PropertyType, PropertyType.id == CrmLead.property_type_id)
        .outerjoin(User, User.id == CrmLead.assigned_to_id)
    )


def _lead_dict(row) -> dict:
    ld: CrmLead = row[0]
    return {
        "id": str(ld.id),
        "name": ld.name,
        "phone": ld.phone,
        "whatsapp": ld.whatsapp,
        "email": ld.email,
        "budget_min": ld.budget_min,
        "budget_max": ld.budget_max,
        "currency": ld.currency,
        "district_id": str(ld.district_id) if ld.district_id else None,
        "district_name": row.district_name,
        "neighborhood_id": str(ld.neighborhood_id) if ld.neighborhood_id else None,
        "neighborhood_name": row.neighborhood_name,
        "area_preference": ld.area_preference,
        "bedrooms": ld.bedrooms,
        "bathrooms": ld.bathrooms,
        "furnishing": ld.furnishing,
        "property_type_id": str(ld.property_type_id) if ld.property_type_id else None,
        "property_type_name": row.property_type_name,
        "move_in_date": iso(ld.move_in_date),
        "requirements": ld.requirements,
        "source": ld.source,
        "status": ld.status,
        "notes": ld.notes,
        "assigned_to_id": str(ld.assigned_to_id) if ld.assigned_to_id else None,
        "assigned_to_name": row.assigned_to_name if ld.assigned_to_id else None,
        "last_contacted_at": iso(ld.last_contacted_at),
        "created_at": iso(ld.created_at),
    }


LEAD_SORTS = {"created": CrmLead.created_at, "name": CrmLead.name, "status": CrmLead.status,
              "move_in": CrmLead.move_in_date, "budget": CrmLead.budget_max, "contacted": CrmLead.last_contacted_at}


@router.get("/leads")
async def list_leads(
    db: DbSession,
    q: str | None = None,
    status: str | None = None,
    active: bool = False,
    source: str | None = None,
    assigned_to_id: UUID | None = None,
    sort: str = "created",
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 25,
):
    stmt = _lead_select()
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(CrmLead.name.ilike(pattern), CrmLead.phone.ilike(pattern), CrmLead.whatsapp.ilike(pattern),
                              CrmLead.email.ilike(pattern), CrmLead.requirements.ilike(pattern)))
    if status:
        stmt = stmt.where(CrmLead.status == svc.check_choice(status, svc.LEAD_STATUSES, "status"))
    elif active:
        stmt = stmt.where(CrmLead.status.in_(svc.ACTIVE_LEAD_STATUSES))
    if source:
        stmt = stmt.where(CrmLead.source == svc.check_choice(source, svc.LEAD_SOURCES, "source"))
    if assigned_to_id:
        stmt = stmt.where(CrmLead.assigned_to_id == assigned_to_id)
    sort_col = LEAD_SORTS.get(sort, CrmLead.created_at)
    stmt = stmt.order_by(sort_col.asc().nulls_last() if order == "asc" else sort_col.desc().nulls_last(), CrmLead.id)
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload([_lead_dict(r) for r in rows], total, page, page_size)


async def _apply_lead(db: AsyncSession, ld: CrmLead, data: dict) -> None:
    await ensure_exists(db, [
        (District, data.get("district_id"), "District"),
        (Neighborhood, data.get("neighborhood_id"), "Area"),
        (PropertyType, data.get("property_type_id"), "Property type"),
        (User, data.get("assigned_to_id"), "User"),
    ])
    for field in ("name", "phone", "whatsapp", "email", "area_preference", "requirements", "notes"):
        if field in data:
            value = clean_text(data[field])
            if field == "name" and not value:
                raise HTTPException(status_code=400, detail="Name is required.")
            setattr(ld, field, value)
    for field in ("budget_min", "budget_max", "district_id", "neighborhood_id", "bedrooms", "bathrooms",
                  "property_type_id", "move_in_date", "assigned_to_id"):
        if field in data:
            setattr(ld, field, data[field])
    if "currency" in data:
        ld.currency = svc.check_choice(data["currency"], svc.CURRENCIES, "currency") or "USD"
    if "furnishing" in data:
        ld.furnishing = svc.check_choice(data["furnishing"], svc.FURNISHING_OPTIONS, "furnishing")
    if "source" in data:
        ld.source = svc.check_choice(data["source"], svc.LEAD_SOURCES, "source")
    if ld.budget_min is not None and ld.budget_max is not None and ld.budget_min > ld.budget_max:
        raise HTTPException(status_code=400, detail="Budget minimum cannot exceed budget maximum.")


def _set_lead_status(db: AsyncSession, ld: CrmLead, status: str, user: User | None) -> None:
    new_status = svc.check_choice(status, svc.LEAD_STATUSES, "status", required=True)
    if new_status == ld.status:
        return
    old = ld.status
    ld.status = new_status
    svc.log_activity(db, Event.LEAD_STATUS_CHANGED, f"Client {ld.name}: {old} → {new_status}", user=user,
                     lead_id=ld.id, meta={"from": old, "to": new_status})


@router.post("/leads", status_code=201)
async def create_lead(body: LeadCreate, db: DbSession, user: AdminUser):
    data = body.model_dump(exclude_unset=True)
    ld = CrmLead(created_by_id=user.id, status="NEW", currency="USD")
    await _apply_lead(db, ld, data)
    if data.get("status"):
        ld.status = svc.check_choice(data["status"], svc.LEAD_STATUSES, "status", required=True)
    db.add(ld)
    await db.flush()
    svc.log_activity(db, Event.LEAD_CREATED, f"New client: {ld.name}" + (f" ({ld.source.title()})" if ld.source else ""),
                     user=user, lead_id=ld.id)
    await db.commit()
    return await get_lead(ld.id, db)


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: UUID, db: DbSession):
    row = (await db.execute(_lead_select().where(CrmLead.id == lead_id))).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Client not found")
    cfg = await svc.get_crm_settings(db)
    cutoff = svc.verification_cutoff(int(cfg["verify_after_days"]))
    linked = (
        await db.execute(
            _property_list_select()
            .add_columns(CrmLeadProperty.note.label("link_note"), CrmLeadProperty.created_at.label("linked_at"))
            .join(CrmLeadProperty, CrmLeadProperty.property_id == Property.id)
            .where(CrmLeadProperty.lead_id == lead_id, Property.in_crm.is_(True))
            .order_by(CrmLeadProperty.created_at.desc())
        )
    ).all()
    from app.api.v1.endpoints.crm_ops import document_rows, follow_up_dict, follow_up_select, viewing_dict, viewing_select

    viewings = (await db.execute(viewing_select().where(CrmViewing.lead_id == lead_id).order_by(CrmViewing.scheduled_at.desc()).limit(50))).all()
    deals = (await db.execute(deal_select().where(CrmDeal.lead_id == lead_id).order_by(CrmDeal.created_at.desc()).limit(25))).all()
    follow_ups = (
        await db.execute(
            follow_up_select().where(CrmFollowUp.lead_id == lead_id)
            .order_by(CrmFollowUp.status.in_(svc.OPEN_FOLLOW_UP_STATUSES).desc(), CrmFollowUp.due_at).limit(50)
        )
    ).all()
    today = svc.kigali_today()
    return {
        **_lead_dict(row),
        "properties": [{**_property_row(r, cutoff), "link_note": r.link_note, "linked_at": iso(r.linked_at)} for r in linked],
        "viewings": [viewing_dict(r) for r in viewings],
        "deals": [deal_dict(r, today) for r in deals],
        "follow_ups": [follow_up_dict(r) for r in follow_ups],
        "documents": await document_rows(db, CrmDocument.lead_id == lead_id),
        "activity": await activity_rows(db, CrmActivity.lead_id == lead_id, limit=50),
    }


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: UUID, body: LeadUpdate, db: DbSession, user: AdminUser):
    ld = await get_or_404(db, CrmLead, lead_id, "Client")
    data = body.model_dump(exclude_unset=True)
    status = data.pop("status", None)
    await _apply_lead(db, ld, data)
    if status:
        _set_lead_status(db, ld, status, user)
    if data:
        svc.log_activity(db, Event.LEAD_UPDATED, f"Client updated: {ld.name}", user=user, lead_id=ld.id,
                         meta={"fields": sorted(data.keys())})
    await db.commit()
    return await get_lead(lead_id, db)


@router.delete("/leads/{lead_id}", status_code=204)
async def delete_lead(lead_id: UUID, db: DbSession, user: AdminUser):
    ld = await get_or_404(db, CrmLead, lead_id, "Client")
    await db.delete(ld)
    await db.commit()


@router.post("/leads/{lead_id}/contacted")
async def lead_contacted(lead_id: UUID, body: ContactLog, db: DbSession, user: AdminUser):
    ld = await get_or_404(db, CrmLead, lead_id, "Client")
    method = svc.check_choice(body.method, svc.CONTACT_METHODS, "contact method")
    ld.last_contacted_at = svc.utcnow()
    if ld.status == "NEW":
        _set_lead_status(db, ld, "CONTACTED", user)
    svc.log_activity(db, Event.LEAD_CONTACTED, f"Client contacted: {ld.name}" + (f" via {method.title()}" if method else ""),
                     user=user, note=body.note, lead_id=ld.id)
    await db.commit()
    return await get_lead(lead_id, db)


async def link_lead_property(db: AsyncSession, lead: CrmLead, prop: Property, user: User | None, note: str | None = None) -> bool:
    exists = await db.get(CrmLeadProperty, (lead.id, prop.id))
    if exists:
        return False
    db.add(CrmLeadProperty(lead_id=lead.id, property_id=prop.id, note=clean_text(note), created_at=svc.utcnow()))
    svc.log_activity(db, Event.LEAD_PROPERTY_LINKED, f"{prop.crm_ref} linked to client {lead.name}", user=user,
                     lead_id=lead.id, property_id=prop.id, landlord_id=prop.landlord_id)
    return True


@router.post("/leads/{lead_id}/properties")
async def add_lead_property(lead_id: UUID, body: LeadPropertyLink, db: DbSession, user: AdminUser):
    ld = await get_or_404(db, CrmLead, lead_id, "Client")
    prop = await get_or_404(db, Property, body.property_id, "Property")
    await link_lead_property(db, ld, prop, user, body.note)
    await db.commit()
    return await get_lead(lead_id, db)


@router.delete("/leads/{lead_id}/properties/{property_id}")
async def remove_lead_property(lead_id: UUID, property_id: UUID, db: DbSession, user: AdminUser):
    await db.execute(delete(CrmLeadProperty).where(CrmLeadProperty.lead_id == lead_id, CrmLeadProperty.property_id == property_id))
    await db.commit()
    return await get_lead(lead_id, db)


@router.get("/leads/{lead_id}/matches")
async def lead_matches(lead_id: UUID, db: DbSession, limit: int = Query(default=10, ge=1, le=30)):
    """Available properties that fit the client's budget and preferences, excluding ones already linked."""
    ld = await get_or_404(db, CrmLead, lead_id, "Client")
    cfg = await svc.get_crm_settings(db)
    cutoff = svc.verification_cutoff(int(cfg["verify_after_days"]))
    P = Property
    linked = select(CrmLeadProperty.property_id).where(CrmLeadProperty.lead_id == lead_id)
    stmt = _property_list_select().where(
        P.in_crm.is_(True),
        P.availability_status.in_(("AVAILABLE", "VERIFY")),
        P.listing_type != ListingType.SALE,
        P.id.notin_(linked),
    )
    rent = func.coalesce(P.usd_price, P.price)
    budget_max = await svc.to_usd(ld.budget_max, ld.currency)
    budget_min = await svc.to_usd(ld.budget_min, ld.currency)
    if budget_max:
        stmt = stmt.where(rent <= budget_max * 1.1)
    if budget_min:
        stmt = stmt.where(rent >= budget_min * 0.8)
    if ld.bedrooms:
        stmt = stmt.where(P.bedrooms >= ld.bedrooms)
    if ld.bathrooms:
        stmt = stmt.where(P.bathrooms >= ld.bathrooms)
    if ld.neighborhood_id:
        stmt = stmt.where(P.neighborhood_id == ld.neighborhood_id)
    elif ld.district_id:
        stmt = stmt.where(P.district_id == ld.district_id)
    if ld.furnishing == "FURNISHED":
        stmt = stmt.where(P.is_furnished.is_(True))
    elif ld.furnishing == "UNFURNISHED":
        stmt = stmt.where(P.is_furnished.is_(False))
    if ld.property_type_id:
        stmt = stmt.where(P.property_type_id == ld.property_type_id)
    stmt = stmt.order_by(case((P.availability_status == "AVAILABLE", 0), else_=1), P.availability_verified_at.desc().nulls_last()).limit(limit)
    rows = (await db.execute(stmt)).all()
    return {"items": [_property_row(r, cutoff) for r in rows]}


# --- Activity -------------------------------------------------------------------------


@router.get("/activity")
async def list_activity(
    db: DbSession,
    event: str | None = None,
    property_id: UUID | None = None,
    landlord_id: UUID | None = None,
    lead_id: UUID | None = None,
    deal_id: UUID | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    stmt = (
        select(
            CrmActivity.id, CrmActivity.event, CrmActivity.summary, CrmActivity.note, CrmActivity.meta,
            CrmActivity.created_at, CrmActivity.property_id, CrmActivity.landlord_id, CrmActivity.lead_id,
            CrmActivity.deal_id, user_name_expr().label("user_name"), Property.crm_ref.label("property_ref"),
            CrmLandlord.name.label("landlord_name"), CrmLead.name.label("lead_name"),
        )
        .outerjoin(User, User.id == CrmActivity.user_id)
        .outerjoin(Property, Property.id == CrmActivity.property_id)
        .outerjoin(CrmLandlord, CrmLandlord.id == CrmActivity.landlord_id)
        .outerjoin(CrmLead, CrmLead.id == CrmActivity.lead_id)
    )
    if event:
        stmt = stmt.where(CrmActivity.event == event)
    for col, value in ((CrmActivity.property_id, property_id), (CrmActivity.landlord_id, landlord_id),
                       (CrmActivity.lead_id, lead_id), (CrmActivity.deal_id, deal_id)):
        if value:
            stmt = stmt.where(col == value)
    pattern = search_pattern(q)
    if pattern:
        stmt = stmt.where(or_(CrmActivity.summary.ilike(pattern), CrmActivity.note.ilike(pattern)))
    stmt = stmt.order_by(CrmActivity.created_at.desc())
    rows, total, page, page_size = await paginate(db, stmt, page, page_size)
    return page_payload([activity_dict(r) for r in rows], total, page, page_size)


@router.post("/activity", status_code=201)
async def add_note(body: ActivityNote, db: DbSession, user: AdminUser):
    await ensure_exists(db, [(Property, body.property_id, "Property"), (CrmLandlord, body.landlord_id, "Landlord"),
                             (CrmLead, body.lead_id, "Client"), (CrmDeal, body.deal_id, "Deal")])
    first_line = body.note.strip().splitlines()[0][:120]
    svc.log_activity(db, Event.NOTE_ADDED, f"Note: {first_line}", user=user, note=body.note.strip(),
                     property_id=body.property_id, landlord_id=body.landlord_id, lead_id=body.lead_id, deal_id=body.deal_id)
    await db.commit()
    return {"ok": True}


# --- Reports --------------------------------------------------------------------------


@router.get("/reports")
async def reports(db: DbSession, date_from: date | None = None, date_to: date | None = None):
    today = svc.kigali_today()
    date_to = date_to or today
    date_from = date_from or (date_to - timedelta(days=29))
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must be on or before date_to.")
    start, _ = svc.kigali_day_bounds(date_from)
    _, end = svc.kigali_day_bounds(date_to)
    P = Property
    in_range = lambda col: and_(col >= start, col < end)  # noqa: E731

    totals = (
        await db.execute(
            select(
                _scalar(select(func.count(P.id)).where(P.in_crm.is_(True), in_range(P.created_at))).label("properties_added"),
                _scalar(
                    select(func.count(func.distinct(CrmActivity.property_id))).where(
                        CrmActivity.event == Event.AVAILABILITY_CHANGED,
                        CrmActivity.meta["to"].astext == "RENTED",
                        in_range(CrmActivity.created_at),
                    )
                ).label("properties_rented"),
                _scalar(select(func.count(CrmLandlord.id)).where(CrmLandlord.status == "ACTIVE")).label("landlords_active"),
                _scalar(select(func.count(CrmLandlord.id)).where(in_range(CrmLandlord.created_at))).label("landlords_added"),
                _scalar(select(func.count(CrmLead.id)).where(in_range(CrmLead.created_at))).label("leads_new"),
                _scalar(select(func.count(CrmViewing.id)).where(in_range(CrmViewing.scheduled_at))).label("viewings_total"),
                _scalar(
                    select(func.count(CrmViewing.id)).where(in_range(CrmViewing.scheduled_at), CrmViewing.status == "COMPLETED")
                ).label("viewings_completed"),
                _scalar(select(func.count(CrmDeal.id)).where(CrmDeal.status == "COMPLETED", in_range(CrmDeal.completed_at))).label("deals_completed"),
                _scalar(
                    select(func.coalesce(func.sum(CrmDeal.commission_amount_usd), 0)).where(
                        CrmDeal.status == "COMPLETED", in_range(CrmDeal.completed_at), CrmDeal.commission_status.notin_(("WAIVED", "CANCELLED"))
                    )
                ).label("commission_earned_usd"),
                _scalar(
                    select(func.coalesce(func.sum(CrmDeal.commission_amount_usd), 0)).where(
                        CrmDeal.commission_status == "PAID", CrmDeal.commission_paid_date >= date_from, CrmDeal.commission_paid_date <= date_to
                    )
                ).label("commission_paid_usd"),
                _scalar(
                    select(func.coalesce(func.sum(CrmDeal.commission_amount_usd), 0)).where(
                        CrmDeal.commission_status.in_(svc.UNPAID_COMMISSION_STATUSES), CrmDeal.status != "CANCELLED"
                    )
                ).label("commission_pending_usd"),
            )
        )
    ).one()

    by_availability = [
        {"status": s, "count": c}
        for s, c in (
            await db.execute(select(P.availability_status, func.count(P.id)).where(P.in_crm.is_(True)).group_by(P.availability_status))
        ).all()
    ]
    by_district = (
        await db.execute(
            select(
                func.coalesce(District.name, "Unassigned").label("district"),
                func.count(P.id).label("total"),
                func.count(P.id).filter(P.availability_status == "AVAILABLE").label("available"),
                func.count(P.id).filter(P.availability_status == "RENTED").label("rented"),
            )
            .outerjoin(District, District.id == P.district_id)
            .where(P.in_crm.is_(True))
            .group_by(District.name)
            .order_by(func.count(P.id).desc())
        )
    ).all()
    leads_by_source = (
        await db.execute(
            select(func.coalesce(CrmLead.source, "UNKNOWN"), func.count(CrmLead.id))
            .where(in_range(CrmLead.created_at)).group_by(CrmLead.source).order_by(func.count(CrmLead.id).desc())
        )
    ).all()

    counts = _landlord_counts_subquery()
    deal_stats = (
        select(
            CrmDeal.landlord_id.label("lid"),
            func.count(CrmDeal.id).filter(CrmDeal.status == "COMPLETED", in_range(CrmDeal.completed_at)).label("deals_completed"),
            func.coalesce(func.sum(CrmDeal.commission_amount_usd).filter(CrmDeal.commission_status == "PAID"), 0).label("commission_paid_usd"),
        )
        .where(CrmDeal.landlord_id.is_not(None))
        .group_by(CrmDeal.landlord_id)
        .subquery()
    )
    performance = (
        await db.execute(
            select(
                CrmLandlord.id, CrmLandlord.name, CrmLandlord.status,
                func.coalesce(counts.c.properties_total, 0).label("properties_total"),
                func.coalesce(counts.c.properties_active, 0).label("properties_active"),
                func.coalesce(counts.c.properties_rented, 0).label("properties_rented"),
                func.coalesce(deal_stats.c.deals_completed, 0).label("deals_completed"),
                func.coalesce(deal_stats.c.commission_paid_usd, 0).label("commission_paid_usd"),
            )
            .outerjoin(counts, counts.c.lid == CrmLandlord.id)
            .outerjoin(deal_stats, deal_stats.c.lid == CrmLandlord.id)
            .order_by(func.coalesce(deal_stats.c.commission_paid_usd, 0).desc(), func.coalesce(counts.c.properties_total, 0).desc())
            .limit(25)
        )
    ).all()

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "totals": {k: (round(float(v), 2) if k.endswith("_usd") else v) for k, v in totals._mapping.items()},
        "by_availability": by_availability,
        "by_district": [dict(r._mapping) for r in by_district],
        "leads_by_source": [{"source": s, "count": c} for s, c in leads_by_source],
        "landlord_performance": [
            {**{k: v for k, v in r._mapping.items() if k != "id"}, "id": str(r.id),
             "commission_paid_usd": round(float(r.commission_paid_usd), 2)}
            for r in performance
        ],
    }
