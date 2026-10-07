"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { crmApi, type Activity, type CrmDocument, type Deal, type FollowUp, type Viewing } from "@/services/crm-api";
import {
  Card,
  EmptyRow,
  ErrorText,
  SmallButton,
  StatusBadge,
  fmtCommission,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtRelative,
  humanize,
  inputCls,
  linkCls,
  tableCls,
  tdCls,
  thCls,
  useCrmMutation,
} from "@/components/admin/crm/ui";
import { DealFormModal, DocumentFormModal, FollowUpFormModal, ViewingFormModal, type RelationDefaults } from "@/components/admin/crm/forms";
import type { Picked } from "@/components/admin/crm/entity-picker";
import { getApiErrorMessage } from "@/lib/utils";

const CRM = "/admin/property-crm";

export const propertyHref = (id: string) => `${CRM}/properties/${id}`;
export const landlordHref = (id: string) => `${CRM}/landlords/${id}`;
export const leadHref = (id: string) => `${CRM}/leads/${id}`;

export function RefLink({ id, label, kind }: { id: string | null; label: string | null; kind: "property" | "landlord" | "lead" }) {
  if (!id || !label) return <span className="text-gray-400">—</span>;
  const href = kind === "property" ? propertyHref(id) : kind === "landlord" ? landlordHref(id) : leadHref(id);
  return (
    <Link href={href} className={linkCls}>
      {label}
    </Link>
  );
}

// --- Availability -----------------------------------------------------------------------

const AVAILABILITY_ACTIONS = ["AVAILABLE", "VERIFY", "RESERVED", "RENTED", "UNAVAILABLE"] as const;

export function AvailabilityControl({
  property,
}: {
  property: {
    id: string;
    availability_status: string;
    availability_verified_at: string | null;
    availability_updated_at: string | null;
    availability_verified_by?: string | null;
    availability_note: string | null;
    verification_due: boolean;
    verify_after_days?: number;
  };
}) {
  const [note, setNote] = useState("");
  const setStatus = useCrmMutation((status: string) => crmApi.setAvailability(property.id, status, note), () => setNote(""));
  const confirm = useCrmMutation(() => crmApi.confirmAvailable(property.id, note), () => setNote(""));
  const busy = setStatus.isPending || confirm.isPending;

  return (
    <Card title="Availability" actions={<StatusBadge value={property.availability_status} className="text-xs" />}>
      <div className="space-y-2 text-[13px]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-gray-500">Last verified</dt>
          <dd>
            {fmtDateTime(property.availability_verified_at)}{" "}
            <span className="text-gray-400">({fmtRelative(property.availability_verified_at)})</span>
          </dd>
          <dt className="text-gray-500">Verified by</dt>
          <dd>{property.availability_verified_by || "—"}</dd>
          <dt className="text-gray-500">Status changed</dt>
          <dd>{fmtDateTime(property.availability_updated_at)}</dd>
          <dt className="text-gray-500">Note</dt>
          <dd className="whitespace-pre-wrap">{property.availability_note || "—"}</dd>
        </dl>
        {property.verification_due ? (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Needs verification{property.verify_after_days ? ` (not confirmed in the last ${property.verify_after_days} days)` : ""}.
          </p>
        ) : null}
        <input className={inputCls} placeholder="Optional note (e.g. confirmed by phone with landlord)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm.mutate(undefined)}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          CONFIRM AVAILABLE
        </button>
        <div className="flex flex-wrap gap-1">
          {AVAILABILITY_ACTIONS.filter((s) => s !== property.availability_status).map((s) => (
            <SmallButton key={s} disabled={busy} onClick={() => setStatus.mutate(s)}>
              Mark {humanize(s)}
            </SmallButton>
          ))}
        </div>
        <ErrorText error={setStatus.error || confirm.error} />
      </div>
    </Card>
  );
}

// --- Activity ---------------------------------------------------------------------------

export function ActivityList({ items, showLinks = true }: { items: Activity[]; showLinks?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ol className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="border-l-2 border-gold-500/60 pl-2 text-[13px]">
          <p className="text-navy-800 dark:text-white">{a.summary}</p>
          {a.note && !a.summary.startsWith("Note:") ? <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{a.note}</p> : null}
          {a.note && a.summary.startsWith("Note:") && a.note.length > 120 ? (
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{a.note}</p>
          ) : null}
          <p className="text-[11px] text-gray-500">
            {fmtDateTime(a.created_at)} · {a.user_name}
            {showLinks ? (
              <>
                {a.property_id && a.property_ref ? <> · <RefLink id={a.property_id} label={a.property_ref} kind="property" /></> : null}
                {a.landlord_id && a.landlord_name ? <> · <RefLink id={a.landlord_id} label={a.landlord_name} kind="landlord" /></> : null}
                {a.lead_id && a.lead_name ? <> · <RefLink id={a.lead_id} label={a.lead_name} kind="lead" /></> : null}
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ActivityPanel({ items, relation, title = "Activity" }: { items: Activity[]; relation: RelationDefaults; title?: string }) {
  const [note, setNote] = useState("");
  const m = useCrmMutation(
    () => crmApi.addNote({ note: note.trim(), property_id: relation.property_id, landlord_id: relation.landlord_id, lead_id: relation.lead_id, deal_id: relation.deal_id }),
    () => setNote(""),
  );
  return (
    <Card title={title}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) m.mutate(undefined);
        }}
      >
        <textarea className={`${inputCls} min-h-[38px]`} rows={1} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
        <SmallButton type="submit" variant="primary" disabled={m.isPending || !note.trim()}>
          Add
        </SmallButton>
      </form>
      <ErrorText error={m.error} />
      <ActivityList items={items} />
    </Card>
  );
}

// --- Viewings ---------------------------------------------------------------------------

export function ViewingsTable({ items, onEdit, hide = [] }: { items: Viewing[]; onEdit?: (v: Viewing) => void; hide?: ("property" | "lead")[] }) {
  const quick = useCrmMutation(({ id, status }: { id: string; status: string }) => crmApi.updateViewing(id, { status }));
  const cols = 6 - hide.length;
  return (
    <div className="overflow-x-auto">
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>When</th>
            {hide.includes("property") ? null : <th className={thCls}>Property</th>}
            {hide.includes("lead") ? null : <th className={thCls}>Client</th>}
            <th className={thCls}>Status</th>
            <th className={thCls}>Feedback</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow cols={cols} text="No viewings." /> : null}
          {items.map((v) => (
            <tr key={v.id}>
              <td className={`${tdCls} whitespace-nowrap`}>{fmtDateTime(v.scheduled_at)}</td>
              {hide.includes("property") ? null : (
                <td className={tdCls}>
                  <RefLink id={v.property_id} label={v.property_ref} kind="property" />
                  {v.property_title ? <span className="block text-[11px] text-gray-500 truncate max-w-[220px]">{v.property_title}</span> : null}
                </td>
              )}
              {hide.includes("lead") ? null : (
                <td className={tdCls}>
                  <RefLink id={v.lead_id} label={v.lead_name} kind="lead" />
                  {v.lead_phone ? <span className="block text-[11px] text-gray-500">{v.lead_phone}</span> : null}
                </td>
              )}
              <td className={tdCls}>
                <StatusBadge value={v.status} />
                {v.interest_level ? <span className="ml-1 text-[11px] text-gray-500">{humanize(v.interest_level)} interest</span> : null}
              </td>
              <td className={`${tdCls} max-w-[260px]`}>
                <span className="line-clamp-2">{v.client_feedback || v.notes || "—"}</span>
                {v.next_action ? <span className="block text-[11px] text-gray-500">Next: {v.next_action}</span> : null}
              </td>
              <td className={`${tdCls} whitespace-nowrap text-right`}>
                {["SCHEDULED", "RESCHEDULED"].includes(v.status) ? (
                  <SmallButton variant="ghost" onClick={() => quick.mutate({ id: v.id, status: "CONFIRMED" })}>Confirm</SmallButton>
                ) : null}
                {["SCHEDULED", "CONFIRMED", "RESCHEDULED"].includes(v.status) ? (
                  <SmallButton variant="ghost" onClick={() => onEdit?.({ ...v, status: "COMPLETED" })}>Complete</SmallButton>
                ) : null}
                {onEdit ? (
                  <SmallButton variant="ghost" onClick={() => onEdit(v)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></SmallButton>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ViewingsPanel({ items, defaults, hide }: { items: Viewing[]; defaults?: { property?: Picked; lead?: Picked }; hide?: ("property" | "lead")[] }) {
  const [editing, setEditing] = useState<Viewing | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <Card title="Viewings" actions={<SmallButton variant="primary" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" />Schedule</SmallButton>} bodyClassName="p-0">
      <ViewingsTable items={items} onEdit={setEditing} hide={hide} />
      {creating ? <ViewingFormModal defaults={defaults} onClose={() => setCreating(false)} /> : null}
      {editing ? <ViewingFormModal viewing={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

// --- Deals ------------------------------------------------------------------------------

export function DealsTable({ items, onEdit, hide = [] }: { items: Deal[]; onEdit?: (d: Deal) => void; hide?: ("property" | "lead" | "landlord")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className={tableCls}>
        <thead>
          <tr>
            {hide.includes("property") ? null : <th className={thCls}>Property</th>}
            {hide.includes("lead") ? null : <th className={thCls}>Client</th>}
            {hide.includes("landlord") ? null : <th className={thCls}>Landlord</th>}
            <th className={thCls}>Rent</th>
            <th className={thCls}>Stage</th>
            <th className={thCls}>Move-in</th>
            <th className={thCls}>Commission</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow cols={8 - hide.length} text="No deals." /> : null}
          {items.map((d) => (
            <tr key={d.id}>
              {hide.includes("property") ? null : (
                <td className={tdCls}>
                  <RefLink id={d.property_id} label={d.property_ref} kind="property" />
                  {d.property_title ? <span className="block text-[11px] text-gray-500 truncate max-w-[200px]">{d.property_title}</span> : null}
                </td>
              )}
              {hide.includes("lead") ? null : <td className={tdCls}><RefLink id={d.lead_id} label={d.lead_name} kind="lead" /></td>}
              {hide.includes("landlord") ? null : <td className={tdCls}><RefLink id={d.landlord_id} label={d.landlord_name} kind="landlord" /></td>}
              <td className={`${tdCls} whitespace-nowrap tabular-nums`}>{fmtMoney(d.rent_amount, d.currency)}</td>
              <td className={tdCls}><StatusBadge value={d.status} /></td>
              <td className={`${tdCls} whitespace-nowrap`}>{fmtDate(d.expected_move_in)}</td>
              <td className={tdCls}>
                <span className="tabular-nums">{fmtMoney(d.commission_amount, d.commission_currency || d.currency)}</span>{" "}
                <StatusBadge value={d.commission_overdue ? "OVERDUE" : d.commission_status} />
                <span className="block text-[11px] text-gray-500">{fmtCommission(d.commission_type, d.commission_value, d.commission_currency)}</span>
              </td>
              <td className={`${tdCls} text-right`}>
                {onEdit ? <SmallButton variant="ghost" onClick={() => onEdit(d)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></SmallButton> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DealsPanel({
  items,
  defaults,
  hide,
  title = "Deals",
}: {
  items: Deal[];
  defaults?: { property?: Picked; lead?: Picked; landlord_id?: string };
  hide?: ("property" | "lead" | "landlord")[];
  title?: string;
}) {
  const [editing, setEditing] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <Card title={title} actions={<SmallButton variant="primary" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" />New deal</SmallButton>} bodyClassName="p-0">
      <DealsTable items={items} onEdit={setEditing} hide={hide} />
      {creating ? <DealFormModal defaults={defaults} onClose={() => setCreating(false)} /> : null}
      {editing ? <DealFormModal deal={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

// --- Follow-ups -------------------------------------------------------------------------

export function FollowUpsTable({ items, onEdit, showRelated = true }: { items: FollowUp[]; onEdit?: (f: FollowUp) => void; showRelated?: boolean }) {
  const complete = useCrmMutation((id: string) => crmApi.updateFollowUp(id, { status: "COMPLETED" }));
  return (
    <div className="overflow-x-auto">
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>Due</th>
            <th className={thCls}>Task</th>
            <th className={thCls}>Priority</th>
            {showRelated ? <th className={thCls}>Related</th> : null}
            <th className={thCls}>Assigned</th>
            <th className={thCls}>Status</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow cols={showRelated ? 7 : 6} text="No follow-ups." /> : null}
          {items.map((f) => (
            <tr key={f.id} className={f.overdue ? "bg-red-50/60 dark:bg-red-900/10" : undefined}>
              <td className={`${tdCls} whitespace-nowrap ${f.overdue ? "text-red-700 font-semibold" : ""}`}>{fmtDateTime(f.due_at)}</td>
              <td className={`${tdCls} max-w-[280px]`}>
                <span className="font-medium">{f.title}</span>
                {f.notes ? <span className="block text-[11px] text-gray-500 line-clamp-2">{f.notes}</span> : null}
              </td>
              <td className={tdCls}><StatusBadge value={f.priority} /></td>
              {showRelated ? (
                <td className={`${tdCls} space-x-1.5 text-[12px]`}>
                  {f.property_id ? <RefLink id={f.property_id} label={f.property_ref} kind="property" /> : null}
                  {f.landlord_id ? <RefLink id={f.landlord_id} label={f.landlord_name} kind="landlord" /> : null}
                  {f.lead_id ? <RefLink id={f.lead_id} label={f.lead_name} kind="lead" /> : null}
                  {!f.property_id && !f.landlord_id && !f.lead_id ? <span className="text-gray-400">—</span> : null}
                </td>
              ) : null}
              <td className={`${tdCls} text-[12px]`}>{f.assigned_to_name || "—"}</td>
              <td className={tdCls}><StatusBadge value={f.status} /></td>
              <td className={`${tdCls} whitespace-nowrap text-right`}>
                {["PENDING", "IN_PROGRESS"].includes(f.status) ? (
                  <SmallButton variant="ghost" disabled={complete.isPending} onClick={() => complete.mutate(f.id)}>
                    <CheckCircle2 className="w-3.5 h-3.5" />Done
                  </SmallButton>
                ) : null}
                {onEdit ? <SmallButton variant="ghost" onClick={() => onEdit(f)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></SmallButton> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FollowUpsPanel({ items, defaults }: { items: FollowUp[]; defaults: RelationDefaults }) {
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <Card title="Follow-ups" actions={<SmallButton variant="primary" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" />Add</SmallButton>} bodyClassName="p-0">
      <FollowUpsTable items={items} onEdit={setEditing} showRelated={false} />
      {creating ? <FollowUpFormModal defaults={defaults} onClose={() => setCreating(false)} /> : null}
      {editing ? <FollowUpFormModal followUp={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

// --- Documents --------------------------------------------------------------------------

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function DocumentsTable({ items, showRelated = true }: { items: CrmDocument[]; showRelated?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const remove = useCrmMutation((id: string) => crmApi.deleteDocument(id));
  const open = async (id: string) => {
    setError(null);
    try {
      const { url } = await crmApi.documentUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not open document."));
    }
  };
  return (
    <div className="overflow-x-auto">
      {error ? <p className="px-2 py-1 text-sm text-red-600">{error}</p> : null}
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>Document</th>
            <th className={thCls}>Type</th>
            {showRelated ? <th className={thCls}>Related</th> : null}
            <th className={thCls}>Added</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow cols={showRelated ? 5 : 4} text="No documents." /> : null}
          {items.map((d) => (
            <tr key={d.id}>
              <td className={tdCls}>
                <span className="font-medium">{d.title}</span>
                <span className="block text-[11px] text-gray-500">
                  {d.storage === "link" ? "External link" : [d.file_name, fmtSize(d.size_bytes)].filter(Boolean).join(" · ")}
                </span>
              </td>
              <td className={tdCls}>{humanize(d.doc_type)}</td>
              {showRelated ? (
                <td className={`${tdCls} space-x-1.5 text-[12px]`}>
                  {d.property_id ? <RefLink id={d.property_id} label={d.property_ref} kind="property" /> : null}
                  {d.landlord_id ? <RefLink id={d.landlord_id} label={d.landlord_name} kind="landlord" /> : null}
                  {d.lead_id ? <RefLink id={d.lead_id} label={d.lead_name} kind="lead" /> : null}
                  {d.deal_id ? <span className="text-gray-500">Deal</span> : null}
                </td>
              ) : null}
              <td className={`${tdCls} whitespace-nowrap text-[12px]`}>
                {fmtDate(d.created_at)}
                {d.uploaded_by_name ? <span className="block text-gray-500">{d.uploaded_by_name}</span> : null}
              </td>
              <td className={`${tdCls} whitespace-nowrap text-right`}>
                <SmallButton variant="ghost" onClick={() => open(d.id)}><Download className="w-3.5 h-3.5" />Open</SmallButton>
                <SmallButton
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => {
                    if (confirm(`Delete "${d.title}"? This cannot be undone.`)) remove.mutate(d.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </SmallButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentsPanel({ items, defaults }: { items: CrmDocument[]; defaults: RelationDefaults }) {
  const [creating, setCreating] = useState(false);
  return (
    <Card title="Documents" actions={<SmallButton variant="primary" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" />Add</SmallButton>} bodyClassName="p-0">
      <DocumentsTable items={items} showRelated={false} />
      {creating ? <DocumentFormModal defaults={defaults} onClose={() => setCreating(false)} /> : null}
    </Card>
  );
}
