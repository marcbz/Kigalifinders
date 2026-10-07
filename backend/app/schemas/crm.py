"""Request bodies for the internal Property CRM (admin-only)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class _Body(BaseModel):
    model_config = {"extra": "forbid"}


class CrmSettingsUpdate(_Body):
    verify_after_days: Optional[int] = Field(default=None, ge=1, le=365)


class CommissionFields(_Body):
    commission_type: Optional[str] = None
    commission_value: Optional[float] = Field(default=None, ge=0)
    commission_currency: Optional[str] = None


class PropertyCrmUpdate(CommissionFields):
    landlord_id: Optional[UUID] = None
    crm_notes: Optional[str] = None


class PropertyDetailsUpdate(CommissionFields):
    title: Optional[str] = Field(default=None, min_length=3, max_length=255)
    listing_type: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    price_period: Optional[str] = Field(default=None, max_length=20)
    bedrooms: Optional[int] = Field(default=None, ge=0, le=50)
    bathrooms: Optional[int] = Field(default=None, ge=0, le=50)
    area_sqm: Optional[float] = Field(default=None, ge=0)
    district_id: Optional[UUID] = None
    neighborhood_id: Optional[UUID] = None
    property_type_id: Optional[UUID] = None
    address: Optional[str] = Field(default=None, max_length=500)
    is_furnished: Optional[bool] = None
    landlord_id: Optional[UUID] = None
    crm_notes: Optional[str] = None


class PropertyCrmCreate(PropertyDetailsUpdate):
    title: str = Field(min_length=3, max_length=255)
    price: float = Field(ge=0)
    availability_status: Optional[str] = None


class AddToCrm(_Body):
    availability_status: Optional[str] = None


class AvailabilityChange(_Body):
    status: str
    note: Optional[str] = Field(default=None, max_length=2000)


class AvailabilityConfirm(_Body):
    note: Optional[str] = Field(default=None, max_length=2000)


class LandlordBase(CommissionFields):
    name: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=255)
    preferred_contact: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    commission_notes: Optional[str] = None
    next_follow_up_at: Optional[datetime] = None


class LandlordCreate(LandlordBase):
    name: str = Field(min_length=1, max_length=200)


class LandlordUpdate(LandlordBase):
    pass


class ContactLog(_Body):
    method: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=2000)


class LeadBase(_Body):
    name: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=255)
    budget_min: Optional[float] = Field(default=None, ge=0)
    budget_max: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    district_id: Optional[UUID] = None
    neighborhood_id: Optional[UUID] = None
    area_preference: Optional[str] = Field(default=None, max_length=255)
    bedrooms: Optional[int] = Field(default=None, ge=0, le=20)
    bathrooms: Optional[int] = Field(default=None, ge=0, le=20)
    furnishing: Optional[str] = None
    property_type_id: Optional[UUID] = None
    move_in_date: Optional[date] = None
    requirements: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to_id: Optional[UUID] = None


class LeadCreate(LeadBase):
    name: str = Field(min_length=1, max_length=200)


class LeadUpdate(LeadBase):
    pass


class LeadPropertyLink(_Body):
    property_id: UUID
    note: Optional[str] = Field(default=None, max_length=500)


class ViewingBase(_Body):
    property_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    landlord_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    client_feedback: Optional[str] = None
    interest_level: Optional[str] = None
    next_action: Optional[str] = Field(default=None, max_length=500)


class ViewingCreate(ViewingBase):
    scheduled_at: datetime


class ViewingUpdate(ViewingBase):
    pass


class DealBase(CommissionFields):
    property_id: Optional[UUID] = None
    landlord_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    rent_amount: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    status: Optional[str] = None
    expected_move_in: Optional[date] = None
    lease_start: Optional[date] = None
    lease_end: Optional[date] = None
    contract_signed_on: Optional[date] = None
    commission_status: Optional[str] = None
    commission_due_date: Optional[date] = None
    commission_paid_date: Optional[date] = None
    notes: Optional[str] = None
    # When completing a deal, the property is marked RENTED unless this is true.
    keep_property_availability: bool = False


class DealCreate(DealBase):
    pass


class DealUpdate(DealBase):
    pass


class FollowUpBase(_Body):
    title: Optional[str] = Field(default=None, max_length=255)
    due_at: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    landlord_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    property_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    assigned_to_id: Optional[UUID] = None


class FollowUpCreate(FollowUpBase):
    title: str = Field(min_length=1, max_length=255)
    due_at: datetime


class FollowUpUpdate(FollowUpBase):
    pass


class DocumentLinkCreate(_Body):
    title: str = Field(min_length=1, max_length=255)
    doc_type: Optional[str] = None
    external_url: str = Field(min_length=8, max_length=2000)
    notes: Optional[str] = None
    landlord_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    property_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None


class ActivityNote(_Body):
    note: str = Field(min_length=1, max_length=4000)
    property_id: Optional[UUID] = None
    landlord_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
