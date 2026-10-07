"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { crmApi, type Body, type CrmPropertyDetail, type Deal, type FollowUp, type Landlord, type Lead, type Viewing } from "@/services/crm-api";
import {
  ChoiceSelect,
  ErrorText,
  Field,
  Modal,
  SmallButton,
  inputCls,
  kigaliInputNow,
  numOrNull,
  strOrNull,
  toKigaliInput,
  useCrmMutation,
  useDebounced,
  useLookups,
} from "@/components/admin/crm/ui";
import { LandlordSelect, LeadPicker, PropertyPicker, UserSelect, type Picked } from "@/components/admin/crm/entity-picker";

function FormActions({ pending, onCancel, label = "Save" }: { pending: boolean; onCancel: () => void; label?: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <SmallButton onClick={onCancel}>Cancel</SmallButton>
      <SmallButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : label}
      </SmallButton>
    </div>
  );
}

export interface CommissionState {
  commission_type: string;
  commission_value: string;
  commission_currency: string;
}

export function commissionState(src?: { commission_type?: string | null; commission_value?: number | null; commission_currency?: string | null } | null): CommissionState {
  return {
    commission_type: src?.commission_type || "",
    commission_value: src?.commission_value != null ? String(src.commission_value) : "",
    commission_currency: src?.commission_currency || "USD",
  };
}

export function commissionBody(c: CommissionState): Body {
  if (!c.commission_type) return { commission_type: null, commission_value: null, commission_currency: null };
  return {
    commission_type: c.commission_type,
    commission_value: numOrNull(c.commission_value),
    commission_currency: c.commission_type === "FIXED" ? c.commission_currency || "USD" : null,
  };
}

export function CommissionInputs({ value, onChange }: { value: CommissionState; onChange: (v: CommissionState) => void }) {
  const { data } = useLookups();
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field label="Commission type">
        <ChoiceSelect value={value.commission_type} onChange={(v) => onChange({ ...value, commission_type: v })} options={data?.vocab.commission_type ?? []} blank="None" />
      </Field>
      <Field label={value.commission_type === "PERCENTAGE" ? "% of monthly rent" : "Amount"}>
        <input className={inputCls} type="number" min={0} step="any" value={value.commission_value} disabled={!value.commission_type}
          onChange={(e) => onChange({ ...value, commission_value: e.target.value })} />
      </Field>
      <Field label="Currency">
        <ChoiceSelect value={value.commission_currency} onChange={(v) => onChange({ ...value, commission_currency: v })} options={data?.vocab.currency ?? []}
          blank={null} className={value.commission_type !== "FIXED" ? "opacity-50" : ""} />
      </Field>
    </div>
  );
}

// --- Landlord ---------------------------------------------------------------------------

export function LandlordFormModal({ landlord, onClose, onSaved }: { landlord?: Landlord; onClose: () => void; onSaved?: (l: Landlord) => void }) {
  const { data } = useLookups();
  const [f, setF] = useState({
    name: landlord?.name ?? "",
    phone: landlord?.phone ?? "",
    whatsapp: landlord?.whatsapp ?? "",
    email: landlord?.email ?? "",
    preferred_contact: landlord?.preferred_contact ?? "",
    status: landlord?.status ?? "ACTIVE",
    notes: landlord?.notes ?? "",
    commission_notes: landlord?.commission_notes ?? "",
  });
  const [c, setC] = useState(commissionState(landlord));
  const m = useCrmMutation(
    (body: Body) => (landlord ? crmApi.updateLandlord(landlord.id, body) : crmApi.createLandlord(body)),
    (r) => {
      onSaved?.(r);
      onClose();
    },
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={landlord ? "Edit landlord" : "New landlord"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({
            name: f.name.trim(),
            phone: strOrNull(f.phone),
            whatsapp: strOrNull(f.whatsapp),
            email: strOrNull(f.email),
            preferred_contact: f.preferred_contact || null,
            status: f.status,
            notes: strOrNull(f.notes),
            commission_notes: strOrNull(f.commission_notes),
            ...commissionBody(c),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name *"><input className={inputCls} required value={f.name} onChange={set("name")} /></Field>
          <Field label="Status">
            <ChoiceSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={data?.vocab.landlord_status ?? []} blank={null} />
          </Field>
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
          <Field label="WhatsApp"><input className={inputCls} value={f.whatsapp} onChange={set("whatsapp")} placeholder="+250…" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Preferred contact">
            <ChoiceSelect value={f.preferred_contact} onChange={(v) => setF({ ...f, preferred_contact: v })} options={data?.vocab.contact_methods ?? []} />
          </Field>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1">Default commission agreement</p>
          <CommissionInputs value={c} onChange={setC} />
          <Field label="Agreement notes" className="mt-2">
            <input className={inputCls} value={f.commission_notes} onChange={set("commission_notes")} placeholder="e.g. paid on lease signing" />
          </Field>
        </div>
        <Field label="Notes"><textarea className={`${inputCls} min-h-[70px]`} value={f.notes} onChange={set("notes")} /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// --- Lead -------------------------------------------------------------------------------

export function LeadFormModal({ lead, onClose, onSaved }: { lead?: Lead; onClose: () => void; onSaved?: (l: Lead) => void }) {
  const { data } = useLookups();
  const [f, setF] = useState({
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    whatsapp: lead?.whatsapp ?? "",
    email: lead?.email ?? "",
    budget_min: lead?.budget_min != null ? String(lead.budget_min) : "",
    budget_max: lead?.budget_max != null ? String(lead.budget_max) : "",
    currency: lead?.currency ?? "USD",
    district_id: lead?.district_id ?? "",
    neighborhood_id: lead?.neighborhood_id ?? "",
    area_preference: lead?.area_preference ?? "",
    bedrooms: lead?.bedrooms != null ? String(lead.bedrooms) : "",
    bathrooms: lead?.bathrooms != null ? String(lead.bathrooms) : "",
    furnishing: lead?.furnishing ?? "",
    property_type_id: lead?.property_type_id ?? "",
    move_in_date: lead?.move_in_date ?? "",
    requirements: lead?.requirements ?? "",
    source: lead?.source ?? "",
    status: lead?.status ?? "NEW",
    notes: lead?.notes ?? "",
    assigned_to_id: lead?.assigned_to_id ?? "",
  });
  const m = useCrmMutation(
    (body: Body) => (lead ? crmApi.updateLead(lead.id, body) : crmApi.createLead(body)),
    (r) => {
      onSaved?.(r);
      onClose();
    },
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const neighborhoods = (data?.neighborhoods ?? []).filter((n) => !f.district_id || n.district_id === f.district_id);

  return (
    <Modal title={lead ? "Edit client" : "New client"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({
            name: f.name.trim(),
            phone: strOrNull(f.phone),
            whatsapp: strOrNull(f.whatsapp),
            email: strOrNull(f.email),
            budget_min: numOrNull(f.budget_min),
            budget_max: numOrNull(f.budget_max),
            currency: f.currency,
            district_id: f.district_id || null,
            neighborhood_id: f.neighborhood_id || null,
            area_preference: strOrNull(f.area_preference),
            bedrooms: numOrNull(f.bedrooms),
            bathrooms: numOrNull(f.bathrooms),
            furnishing: f.furnishing || null,
            property_type_id: f.property_type_id || null,
            move_in_date: f.move_in_date || null,
            requirements: strOrNull(f.requirements),
            source: f.source || null,
            status: f.status,
            notes: strOrNull(f.notes),
            assigned_to_id: f.assigned_to_id || null,
          });
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <Field label="Name *"><input className={inputCls} required value={f.name} onChange={set("name")} /></Field>
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
          <Field label="WhatsApp"><input className={inputCls} value={f.whatsapp} onChange={set("whatsapp")} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Source">
            <ChoiceSelect value={f.source} onChange={(v) => setF({ ...f, source: v })} options={data?.vocab.lead_source ?? []} />
          </Field>
          <Field label="Status">
            <ChoiceSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={data?.vocab.lead_status ?? []} blank={null} />
          </Field>
          <Field label="Budget min"><input className={inputCls} type="number" min={0} value={f.budget_min} onChange={set("budget_min")} /></Field>
          <Field label="Budget max"><input className={inputCls} type="number" min={0} value={f.budget_max} onChange={set("budget_max")} /></Field>
          <Field label="Currency">
            <ChoiceSelect value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={data?.vocab.currency ?? []} blank={null} />
          </Field>
          <Field label="District">
            <ChoiceSelect value={f.district_id} onChange={(v) => setF({ ...f, district_id: v, neighborhood_id: "" })} options={data?.districts ?? []} blank="Any" />
          </Field>
          <Field label="Area">
            <ChoiceSelect value={f.neighborhood_id} onChange={(v) => setF({ ...f, neighborhood_id: v })} options={neighborhoods} blank="Any" />
          </Field>
          <Field label="Other area preference"><input className={inputCls} value={f.area_preference} onChange={set("area_preference")} /></Field>
          <Field label="Bedrooms (min)"><input className={inputCls} type="number" min={0} value={f.bedrooms} onChange={set("bedrooms")} /></Field>
          <Field label="Bathrooms (min)"><input className={inputCls} type="number" min={0} value={f.bathrooms} onChange={set("bathrooms")} /></Field>
          <Field label="Furnishing">
            <ChoiceSelect value={f.furnishing} onChange={(v) => setF({ ...f, furnishing: v })} options={data?.vocab.furnishing ?? []} />
          </Field>
          <Field label="Property type">
            <ChoiceSelect value={f.property_type_id} onChange={(v) => setF({ ...f, property_type_id: v })} options={data?.property_types ?? []} blank="Any" />
          </Field>
          <Field label="Move-in date"><input className={inputCls} type="date" value={f.move_in_date} onChange={set("move_in_date")} /></Field>
          <Field label="Assigned to">
            <UserSelect value={f.assigned_to_id} onChange={(v) => setF({ ...f, assigned_to_id: v })} />
          </Field>
        </div>
        <Field label="Requirements"><textarea className={`${inputCls} min-h-[60px]`} value={f.requirements} onChange={set("requirements")} /></Field>
        <Field label="Notes"><textarea className={`${inputCls} min-h-[60px]`} value={f.notes} onChange={set("notes")} /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// --- Viewing ----------------------------------------------------------------------------

export function ViewingFormModal({
  viewing,
  defaults,
  onClose,
}: {
  viewing?: Viewing;
  defaults?: { property?: Picked | null; lead?: Picked | null };
  onClose: () => void;
}) {
  const { data } = useLookups();
  const [property, setProperty] = useState<Picked | null>(
    viewing?.property_id ? { id: viewing.property_id, label: `${viewing.property_ref} · ${viewing.property_title}` } : defaults?.property ?? null,
  );
  const [lead, setLead] = useState<Picked | null>(viewing?.lead_id ? { id: viewing.lead_id, label: viewing.lead_name || "Client" } : defaults?.lead ?? null);
  const [f, setF] = useState({
    scheduled_at: viewing ? toKigaliInput(viewing.scheduled_at) : kigaliInputNow(24).slice(0, 11) + "10:00",
    status: viewing?.status ?? "SCHEDULED",
    notes: viewing?.notes ?? "",
    client_feedback: viewing?.client_feedback ?? "",
    interest_level: viewing?.interest_level ?? "",
    next_action: viewing?.next_action ?? "",
  });
  const m = useCrmMutation((body: Body) => (viewing ? crmApi.updateViewing(viewing.id, body) : crmApi.createViewing(body)), () => onClose());
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={viewing ? "Edit viewing" : "Schedule viewing"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({
            property_id: property?.id ?? null,
            lead_id: lead?.id ?? null,
            scheduled_at: f.scheduled_at,
            status: f.status,
            notes: strOrNull(f.notes),
            client_feedback: strOrNull(f.client_feedback),
            interest_level: f.interest_level || null,
            next_action: strOrNull(f.next_action),
          });
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Property"><PropertyPicker value={property} onChange={setProperty} /></Field>
          <Field label="Client"><LeadPicker value={lead} onChange={setLead} /></Field>
          <Field label="Date & time (Kigali) *">
            <input className={inputCls} type="datetime-local" required value={f.scheduled_at} onChange={set("scheduled_at")} />
          </Field>
          <Field label="Status">
            <ChoiceSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={data?.vocab.viewing_status ?? []} blank={null} />
          </Field>
        </div>
        <Field label="Notes"><textarea className={`${inputCls} min-h-[50px]`} value={f.notes} onChange={set("notes")} /></Field>
        {viewing ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Client feedback" className="col-span-2">
              <textarea className={`${inputCls} min-h-[50px]`} value={f.client_feedback} onChange={set("client_feedback")} />
            </Field>
            <Field label="Interest level">
              <ChoiceSelect value={f.interest_level} onChange={(v) => setF({ ...f, interest_level: v })} options={data?.vocab.interest_level ?? []} />
            </Field>
            <Field label="Next action"><input className={inputCls} value={f.next_action} onChange={set("next_action")} /></Field>
          </div>
        ) : null}
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} label={viewing ? "Save" : "Schedule"} />
      </form>
    </Modal>
  );
}

// --- Deal -------------------------------------------------------------------------------

export function DealFormModal({
  deal,
  defaults,
  onClose,
}: {
  deal?: Deal;
  defaults?: { property?: Picked | null; lead?: Picked | null; landlord_id?: string };
  onClose: () => void;
}) {
  const { data } = useLookups();
  const [property, setProperty] = useState<Picked | null>(
    deal?.property_id ? { id: deal.property_id, label: `${deal.property_ref} · ${deal.property_title}` } : defaults?.property ?? null,
  );
  const [lead, setLead] = useState<Picked | null>(deal?.lead_id ? { id: deal.lead_id, label: deal.lead_name || "Client" } : defaults?.lead ?? null);
  const [f, setF] = useState({
    landlord_id: deal?.landlord_id ?? defaults?.landlord_id ?? "",
    rent_amount: deal?.rent_amount != null ? String(deal.rent_amount) : "",
    currency: deal?.currency ?? "USD",
    status: deal?.status ?? "LEAD",
    expected_move_in: deal?.expected_move_in ?? "",
    lease_start: deal?.lease_start ?? "",
    lease_end: deal?.lease_end ?? "",
    contract_signed_on: deal?.contract_signed_on ?? "",
    commission_status: deal?.commission_status ?? "EXPECTED",
    commission_due_date: deal?.commission_due_date ?? "",
    commission_paid_date: deal?.commission_paid_date ?? "",
    notes: deal?.notes ?? "",
    keep_property_availability: false,
  });
  const [c, setC] = useState(commissionState(deal));
  const m = useCrmMutation((body: Body) => (deal ? crmApi.updateDeal(deal.id, body) : crmApi.createDeal(body)), () => onClose());
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const completing = f.status === "COMPLETED" && deal?.status !== "COMPLETED";

  return (
    <Modal title={deal ? "Edit deal" : "New deal"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body: Body = {
            property_id: property?.id ?? null,
            lead_id: lead?.id ?? null,
            landlord_id: f.landlord_id || null,
            currency: f.currency,
            status: f.status,
            expected_move_in: f.expected_move_in || null,
            lease_start: f.lease_start || null,
            lease_end: f.lease_end || null,
            contract_signed_on: f.contract_signed_on || null,
            commission_status: f.commission_status,
            commission_due_date: f.commission_due_date || null,
            commission_paid_date: f.commission_paid_date || null,
            notes: strOrNull(f.notes),
            keep_property_availability: f.keep_property_availability,
          };
          const rent = numOrNull(f.rent_amount);
          if (deal || rent !== null) body.rent_amount = rent;
          if (deal || c.commission_type) Object.assign(body, commissionBody(c));
          if (!deal && !body.landlord_id) delete body.landlord_id;
          m.mutate(body);
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <Field label="Property" className="col-span-2"><PropertyPicker value={property} onChange={setProperty} /></Field>
          <Field label="Status">
            <ChoiceSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={data?.vocab.deal_status ?? []} blank={null} />
          </Field>
          <Field label="Client"><LeadPicker value={lead} onChange={setLead} /></Field>
          <Field label="Landlord">
            <LandlordSelect value={f.landlord_id} onChange={(v) => setF({ ...f, landlord_id: v })} blank={deal ? "No landlord" : "From property"} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Monthly rent"><input className={inputCls} type="number" min={0} step="any" value={f.rent_amount} onChange={set("rent_amount")}
              placeholder={deal ? "" : "From property"} /></Field>
            <Field label="Currency">
              <ChoiceSelect value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={data?.vocab.currency ?? []} blank={null} />
            </Field>
          </div>
          <Field label="Expected move-in"><input className={inputCls} type="date" value={f.expected_move_in} onChange={set("expected_move_in")} /></Field>
          <Field label="Lease start"><input className={inputCls} type="date" value={f.lease_start} onChange={set("lease_start")} /></Field>
          <Field label="Lease end"><input className={inputCls} type="date" value={f.lease_end} onChange={set("lease_end")} /></Field>
          <Field label="Contract signed"><input className={inputCls} type="date" value={f.contract_signed_on} onChange={set("contract_signed_on")} /></Field>
        </div>
        <div className="rounded-md border p-2 space-y-2">
          <p className="text-xs font-semibold text-gray-600">
            Commission {deal ? "" : <span className="font-normal text-gray-500">(leave empty to use the property or landlord agreement)</span>}
          </p>
          <CommissionInputs value={c} onChange={setC} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="Commission status">
              <ChoiceSelect value={f.commission_status} onChange={(v) => setF({ ...f, commission_status: v })} options={data?.vocab.commission_status ?? []} blank={null} />
            </Field>
            <Field label="Due date"><input className={inputCls} type="date" value={f.commission_due_date} onChange={set("commission_due_date")} /></Field>
            <Field label="Paid date"><input className={inputCls} type="date" value={f.commission_paid_date} onChange={set("commission_paid_date")} /></Field>
          </div>
        </div>
        {completing ? (
          <label className="flex items-center gap-2 text-xs rounded-md bg-amber-50 text-amber-900 px-2 py-1.5">
            <input type="checkbox" checked={f.keep_property_availability} onChange={(e) => setF({ ...f, keep_property_availability: e.target.checked })} />
            Completing this deal marks the property <b>Rented</b>. Tick to keep its current availability instead.
          </label>
        ) : null}
        <Field label="Notes"><textarea className={`${inputCls} min-h-[50px]`} value={f.notes} onChange={set("notes")} /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// --- Follow-up --------------------------------------------------------------------------

export interface RelationDefaults {
  landlord_id?: string;
  lead_id?: string;
  property_id?: string;
  deal_id?: string;
  label?: string;
}

export function FollowUpFormModal({ followUp, defaults, onClose }: { followUp?: FollowUp; defaults?: RelationDefaults; onClose: () => void }) {
  const { data } = useLookups();
  const [f, setF] = useState({
    title: followUp?.title ?? "",
    due_at: followUp ? toKigaliInput(followUp.due_at) : kigaliInputNow(24).slice(0, 11) + "09:00",
    priority: followUp?.priority ?? "MEDIUM",
    status: followUp?.status ?? "PENDING",
    notes: followUp?.notes ?? "",
    assigned_to_id: followUp?.assigned_to_id ?? "",
    landlord_id: followUp?.landlord_id ?? defaults?.landlord_id ?? "",
  });
  const [property, setProperty] = useState<Picked | null>(
    followUp?.property_id ? { id: followUp.property_id, label: followUp.property_ref || "Property" } : null,
  );
  const [lead, setLead] = useState<Picked | null>(followUp?.lead_id ? { id: followUp.lead_id, label: followUp.lead_name || "Client" } : null);
  const fixed = !followUp && defaults && (defaults.property_id || defaults.lead_id || defaults.deal_id);
  const m = useCrmMutation((body: Body) => (followUp ? crmApi.updateFollowUp(followUp.id, body) : crmApi.createFollowUp(body)), () => onClose());
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={followUp ? "Edit follow-up" : "New follow-up"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body: Body = {
            title: f.title.trim(),
            due_at: f.due_at,
            priority: f.priority,
            status: f.status,
            notes: strOrNull(f.notes),
            landlord_id: f.landlord_id || null,
          };
          if (f.assigned_to_id || followUp) body.assigned_to_id = f.assigned_to_id || null;
          if (fixed) {
            Object.assign(body, {
              property_id: defaults?.property_id ?? null,
              lead_id: defaults?.lead_id ?? null,
              deal_id: defaults?.deal_id ?? null,
            });
          } else {
            body.property_id = property?.id ?? null;
            body.lead_id = lead?.id ?? null;
          }
          m.mutate(body);
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <Field label="Title *" className="col-span-3">
            <input className={inputCls} required value={f.title} onChange={set("title")} placeholder="Call landlord to confirm availability" />
          </Field>
          <Field label="Due (Kigali) *"><input className={inputCls} type="datetime-local" required value={f.due_at} onChange={set("due_at")} /></Field>
          <Field label="Priority">
            <ChoiceSelect value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={data?.vocab.follow_up_priority ?? []} blank={null} />
          </Field>
          <Field label="Status">
            <ChoiceSelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={data?.vocab.follow_up_status ?? []} blank={null} />
          </Field>
          <Field label="Assigned to"><UserSelect value={f.assigned_to_id} onChange={(v) => setF({ ...f, assigned_to_id: v })} blank={followUp ? "Unassigned" : "Me"} /></Field>
          <Field label="Landlord"><LandlordSelect value={f.landlord_id} onChange={(v) => setF({ ...f, landlord_id: v })} blank="None" /></Field>
          {fixed ? (
            <Field label="Related to"><div className={`${inputCls} bg-gray-50 truncate`}>{defaults?.label || "This record"}</div></Field>
          ) : (
            <>
              <Field label="Property"><PropertyPicker value={property} onChange={setProperty} /></Field>
              <Field label="Client" className="col-span-2"><LeadPicker value={lead} onChange={setLead} /></Field>
            </>
          )}
        </div>
        <Field label="Notes"><textarea className={`${inputCls} min-h-[50px]`} value={f.notes} onChange={set("notes")} /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// --- Documents --------------------------------------------------------------------------

export function DocumentFormModal({ defaults, onClose }: { defaults: RelationDefaults; onClose: () => void }) {
  const { data } = useLookups();
  const [mode, setMode] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("OTHER");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const relation = {
    landlord_id: defaults.landlord_id,
    lead_id: defaults.lead_id,
    property_id: defaults.property_id,
    deal_id: defaults.deal_id,
  };
  const m = useCrmMutation(async () => {
    if (mode === "link") {
      return crmApi.addDocumentLink({ title: title.trim(), doc_type: docType, external_url: url.trim(), notes: strOrNull(notes), ...relation });
    }
    if (!file) throw new Error("Choose a file to upload.");
    const form = new FormData();
    form.append("file", file);
    form.append("title", title.trim() || file.name);
    form.append("doc_type", docType);
    if (notes.trim()) form.append("notes", notes.trim());
    for (const [k, v] of Object.entries(relation)) if (v) form.append(k, v);
    return crmApi.uploadDocument(form);
  }, () => onClose());

  return (
    <Modal title={`Add document${defaults.label ? ` · ${defaults.label}` : ""}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(undefined);
        }}
      >
        <div className="flex gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="radio" checked={mode === "file"} onChange={() => setMode("file")} /> Upload file (private)</label>
          <label className="flex items-center gap-1"><input type="radio" checked={mode === "link"} onChange={() => setMode("link")} /> Link (e.g. Google Drive)</label>
        </div>
        <Field label={mode === "link" ? "Title *" : "Title"}>
          <input className={inputCls} required={mode === "link"} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Type">
          <ChoiceSelect value={docType} onChange={setDocType} options={data?.vocab.document_type ?? []} blank={null} />
        </Field>
        {mode === "file" ? (
          <Field label="File * (PDF, image, Office, max 10 MB)">
            <input className="text-sm" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
        ) : (
          <Field label="HTTPS URL *"><input className={inputCls} type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        )}
        <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} label={mode === "file" ? "Upload" : "Add link"} />
      </form>
    </Modal>
  );
}

// --- Contact log ------------------------------------------------------------------------

export function ContactLogModal({ title, onSubmit, onClose }: { title: string; onSubmit: (body: { method?: string; note?: string }) => Promise<unknown>; onClose: () => void }) {
  const { data } = useLookups();
  const [method, setMethod] = useState("PHONE");
  const [note, setNote] = useState("");
  const m = useCrmMutation(() => onSubmit({ method: method || undefined, note: note.trim() || undefined }), () => onClose());
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(undefined);
        }}
      >
        <Field label="Method"><ChoiceSelect value={method} onChange={setMethod} options={data?.vocab.contact_methods ?? []} /></Field>
        <Field label="Outcome / note"><textarea className={`${inputCls} min-h-[70px]`} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} label="Log contact" />
      </form>
    </Modal>
  );
}

// --- Property ---------------------------------------------------------------------------

const LISTING_TYPES = ["rent", "sale", "furnished"] as const;

/** Create a new CRM property (saved as an unpublished draft) or edit an existing one's details. */
export function PropertyFormModal({ property, onClose, onSaved }: { property?: CrmPropertyDetail; onClose: () => void; onSaved?: (p: CrmPropertyDetail) => void }) {
  const { data } = useLookups();
  const num = (v: number | null | undefined) => (v != null ? String(v) : "");
  const [f, setF] = useState({
    title: property?.title ?? "",
    listing_type: property?.listing_type ?? "rent",
    price: num(property?.price),
    currency: property?.currency ?? "USD",
    price_period: property?.price_period ?? "month",
    bedrooms: num(property?.bedrooms),
    bathrooms: num(property?.bathrooms),
    area_sqm: num(property?.area_sqm),
    district_id: property?.district_id ?? "",
    neighborhood_id: property?.neighborhood_id ?? "",
    property_type_id: property?.property_type_id ?? "",
    address: property?.address ?? "",
    is_furnished: property?.is_furnished ?? false,
    landlord_id: property?.landlord_id ?? "",
    availability_status: "AVAILABLE",
    crm_notes: property?.crm_notes ?? "",
  });
  const [c, setC] = useState(commissionState(property));
  const m = useCrmMutation(
    (body: Body) => (property ? crmApi.updatePropertyDetails(property.id, body) : crmApi.createProperty(body)),
    (r) => {
      onSaved?.(r);
      onClose();
    },
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const neighborhoods = (data?.neighborhoods ?? []).filter((n) => !f.district_id || n.district_id === f.district_id);

  return (
    <Modal title={property ? `Edit ${property.crm_ref ?? "property"}` : "New CRM property"} onClose={onClose} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({
            title: f.title.trim(),
            listing_type: f.listing_type,
            price: Number(f.price),
            currency: f.currency,
            price_period: strOrNull(f.price_period),
            bedrooms: numOrNull(f.bedrooms),
            bathrooms: numOrNull(f.bathrooms),
            area_sqm: numOrNull(f.area_sqm),
            district_id: f.district_id || null,
            neighborhood_id: f.neighborhood_id || null,
            property_type_id: f.property_type_id || null,
            address: strOrNull(f.address),
            is_furnished: f.is_furnished,
            landlord_id: f.landlord_id || null,
            crm_notes: strOrNull(f.crm_notes),
            ...(property ? {} : { availability_status: f.availability_status }),
            ...commissionBody(c),
          });
        }}
      >
        {!property ? (
          <p className="text-[12px] text-gray-500">
            The ID is generated from district, area and type (e.g. <b>GKH-0001</b> for a house in Kibagabaga, Gasabo). New properties are
            saved as unpublished drafts — they only appear on the website if you publish them from Admin → Properties.
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Title *" className="col-span-3"><input className={inputCls} required value={f.title} onChange={set("title")} placeholder="3 bedroom house for rent in Kibagabaga" /></Field>
          <Field label="District">
            <ChoiceSelect value={f.district_id} onChange={(v) => setF({ ...f, district_id: v, neighborhood_id: "" })} options={data?.districts ?? []} />
          </Field>
          <Field label="Area / neighborhood">
            <ChoiceSelect value={f.neighborhood_id} onChange={(v) => setF({ ...f, neighborhood_id: v })} options={neighborhoods} />
          </Field>
          <Field label="Property type">
            <ChoiceSelect value={f.property_type_id} onChange={(v) => setF({ ...f, property_type_id: v })} options={data?.property_types ?? []} />
          </Field>
          <Field label="Listing type">
            <ChoiceSelect value={f.listing_type} onChange={(v) => setF({ ...f, listing_type: v })} options={LISTING_TYPES} blank={null} />
          </Field>
          <Field label="Price *"><input className={inputCls} type="number" min={0} step="any" required value={f.price} onChange={set("price")} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Currency">
              <ChoiceSelect value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={data?.vocab.currency ?? []} blank={null} />
            </Field>
            <Field label="Per">
              <ChoiceSelect value={f.price_period} onChange={(v) => setF({ ...f, price_period: v })} options={["month", "night", "year"]} blank="—" />
            </Field>
          </div>
          <Field label="Bedrooms"><input className={inputCls} type="number" min={0} value={f.bedrooms} onChange={set("bedrooms")} /></Field>
          <Field label="Bathrooms"><input className={inputCls} type="number" min={0} value={f.bathrooms} onChange={set("bathrooms")} /></Field>
          <Field label="Area (m²)"><input className={inputCls} type="number" min={0} step="any" value={f.area_sqm} onChange={set("area_sqm")} /></Field>
          <Field label="Address / directions" className="col-span-2"><input className={inputCls} value={f.address} onChange={set("address")} /></Field>
          <label className="flex items-center gap-1.5 text-xs pt-5">
            <input type="checkbox" checked={f.is_furnished} onChange={(e) => setF({ ...f, is_furnished: e.target.checked })} /> Furnished
          </label>
          <Field label="Landlord"><LandlordSelect value={f.landlord_id} onChange={(v) => setF({ ...f, landlord_id: v })} /></Field>
          {!property ? (
            <Field label="Availability">
              <ChoiceSelect value={f.availability_status} onChange={(v) => setF({ ...f, availability_status: v })} options={data?.vocab.availability ?? []} blank={null} />
            </Field>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1">Commission (leave empty to use the landlord&apos;s agreement)</p>
          <CommissionInputs value={c} onChange={setC} />
        </div>
        <Field label="Internal notes"><textarea className={`${inputCls} min-h-[60px]`} value={f.crm_notes} onChange={set("crm_notes")} placeholder="Private — never shown on the website" /></Field>
        <ErrorText error={m.error} />
        <FormActions pending={m.isPending} onCancel={onClose} label={property ? "Save" : "Add to CRM"} />
      </form>
    </Modal>
  );
}

/** Pull an existing website listing (published or draft) into the CRM. */
export function AddExistingPropertyModal({ onClose, onAdded }: { onClose: () => void; onAdded?: (p: CrmPropertyDetail) => void }) {
  const { data: lookups } = useLookups();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [availability, setAvailability] = useState("AVAILABLE");
  const { data, isFetching, error } = useQuery({
    queryKey: ["crm", "property-candidates", debouncedQ],
    queryFn: () => crmApi.propertyCandidates(debouncedQ),
  });
  const m = useCrmMutation((id: string) => crmApi.addPropertyToCrm(id, availability), (r) => {
    onAdded?.(r);
    onClose();
  });
  return (
    <Modal title="Add an existing listing to the CRM" onClose={onClose} wide>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className={inputCls} autoFocus placeholder="Search listings not yet in the CRM…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="w-40">
            <ChoiceSelect value={availability} onChange={setAvailability} options={lookups?.vocab.availability ?? []} blank={null} />
          </div>
        </div>
        <ErrorText error={error || m.error} />
        <ul className={`divide-y rounded-md border max-h-[50vh] overflow-y-auto ${isFetching ? "opacity-70" : ""}`}>
          {data && data.items.length === 0 ? <li className="p-3 text-sm text-gray-500">No matching listings outside the CRM.</li> : null}
          {data?.items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-[11px] text-gray-500">
                  <span className="capitalize">{c.publication_status}</span>
                  {c.neighborhood_name ? ` · ${c.neighborhood_name}` : ""}
                  {c.bedrooms != null ? ` · ${c.bedrooms} bed` : ""}
                  {` · ${c.currency} ${Math.round(c.price).toLocaleString()}`}
                </p>
              </div>
              <SmallButton variant="primary" disabled={m.isPending} onClick={() => m.mutate(c.id)}>Add</SmallButton>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
