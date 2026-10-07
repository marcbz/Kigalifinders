"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { crmApi, type CrmPropertyDetail } from "@/services/crm-api";
import { Shimmer } from "@/components/ui/shimmer";
import {
  Card,
  ContactLinks,
  ErrorText,
  SmallButton,
  StatusBadge,
  fmtCommission,
  fmtDate,
  fmtMoney,
  inputCls,
  linkCls,
  tableCls,
  tdCls,
  thCls,
  EmptyRow,
  ManagerTag,
  useCrmMutation,
} from "@/components/admin/crm/ui";
import {
  ActivityPanel,
  AvailabilityControl,
  DealsPanel,
  DocumentsPanel,
  FollowUpsPanel,
  ViewingsPanel,
  landlordHref,
  leadHref,
} from "@/components/admin/crm/panels";
import { CommissionInputs, PropertyFormModal, commissionBody, commissionState } from "@/components/admin/crm/forms";
import { LandlordSelect, LeadPicker, type Picked } from "@/components/admin/crm/entity-picker";

function LandlordCard({ p }: { p: CrmPropertyDetail }) {
  const [editing, setEditing] = useState(false);
  const [landlordId, setLandlordId] = useState(p.landlord_id ?? "");
  const m = useCrmMutation(() => crmApi.updateProperty(p.id, { landlord_id: landlordId || null }), () => setEditing(false));
  const ll = p.landlord;
  return (
    <Card title={ll?.contact_type === "PROPERTY_MANAGER" ? "Property manager" : "Landlord / manager"} actions={<SmallButton variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : ll ? "Change" : "Link"}</SmallButton>}>
      {editing ? (
        <div className="space-y-2">
          <LandlordSelect value={landlordId} onChange={setLandlordId} />
          <SmallButton variant="primary" disabled={m.isPending} onClick={() => m.mutate(undefined)}>Save</SmallButton>
          <ErrorText error={m.error} />
        </div>
      ) : ll ? (
        <div className="text-[13px] space-y-1">
          <Link href={landlordHref(ll.id)} className={linkCls}>{ll.name}</Link> <StatusBadge value={ll.status} />
          <ManagerTag type={ll.contact_type} company={ll.company} />
          <div><ContactLinks phone={ll.phone} whatsapp={ll.whatsapp} email={ll.email} /></div>
          {ll.preferred_contact ? <p className="text-[11px] text-gray-500">Prefers {ll.preferred_contact.toLowerCase()}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No landlord or property manager linked.</p>
      )}
    </Card>
  );
}

function CommissionCard({ p }: { p: CrmPropertyDetail }) {
  const [editing, setEditing] = useState(false);
  const [c, setC] = useState(commissionState(p));
  useEffect(() => {
    if (!editing) setC(commissionState(p));
  }, [p.commission_type, p.commission_value, p.commission_currency, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useCrmMutation(() => crmApi.updateProperty(p.id, commissionBody(c)), () => setEditing(false));
  const eff = p.effective_commission;
  return (
    <Card title="Commission agreement" actions={<SmallButton variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</SmallButton>}>
      {editing ? (
        <div className="space-y-2">
          <CommissionInputs value={c} onChange={setC} />
          <p className="text-[11px] text-gray-500">Leave empty to fall back to the landlord&apos;s agreement.</p>
          <SmallButton variant="primary" disabled={m.isPending} onClick={() => m.mutate(undefined)}>Save</SmallButton>
          <ErrorText error={m.error} />
        </div>
      ) : eff ? (
        <p className="text-[13px]">
          {fmtCommission(eff.type, eff.value, eff.currency)}
          <span className="block text-[11px] text-gray-500">{eff.source === "property" ? "Set on this property" : "From landlord agreement"}</span>
        </p>
      ) : (
        <p className="text-sm text-gray-500">No agreement set.</p>
      )}
    </Card>
  );
}

function NotesCard({ p }: { p: CrmPropertyDetail }) {
  const [notes, setNotes] = useState(p.crm_notes ?? "");
  useEffect(() => setNotes(p.crm_notes ?? ""), [p.crm_notes]);
  const m = useCrmMutation(() => crmApi.updateProperty(p.id, { crm_notes: notes }));
  return (
    <Card title="Internal notes">
      <textarea className={`${inputCls} min-h-[80px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private notes — never shown on the website" />
      <div className="mt-1 flex items-center gap-2">
        <SmallButton variant="primary" disabled={m.isPending || notes === (p.crm_notes ?? "")} onClick={() => m.mutate(undefined)}>Save notes</SmallButton>
        <ErrorText error={m.error} />
      </div>
    </Card>
  );
}

function LinkedClients({ p }: { p: CrmPropertyDetail }) {
  const [lead, setLead] = useState<Picked | null>(null);
  const m = useCrmMutation(() => crmApi.linkLeadProperty(lead!.id, p.id), () => setLead(null));
  return (
    <Card title="Interested clients" bodyClassName="p-0">
      <div className="flex gap-2 p-2 border-b">
        <div className="flex-1"><LeadPicker value={lead} onChange={setLead} /></div>
        <SmallButton variant="primary" disabled={!lead || m.isPending} onClick={() => m.mutate(undefined)}>Link client</SmallButton>
      </div>
      <ErrorText error={m.error} />
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>Client</th>
            <th className={thCls}>Status</th>
            <th className={thCls}>Note</th>
            <th className={thCls}>Linked</th>
          </tr>
        </thead>
        <tbody>
          {p.leads.length === 0 ? <EmptyRow cols={4} text="No clients linked." /> : null}
          {p.leads.map((l) => (
            <tr key={l.id}>
              <td className={tdCls}>
                <Link href={leadHref(l.id)} className={linkCls}>{l.name}</Link>
                {l.phone ? <span className="block text-[11px] text-gray-500">{l.phone}</span> : null}
              </td>
              <td className={tdCls}><StatusBadge value={l.status} /></td>
              <td className={`${tdCls} text-[12px]`}>{l.note || "—"}</td>
              <td className={`${tdCls} text-[12px] whitespace-nowrap`}>{fmtDate(l.linked_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AddBackButton({ id }: { id: string }) {
  const m = useCrmMutation(() => crmApi.addPropertyToCrm(id));
  return (
    <span className="flex items-center gap-2">
      <ErrorText error={m.error} />
      <SmallButton variant="primary" disabled={m.isPending} onClick={() => m.mutate(undefined)}>Add to CRM</SmallButton>
    </span>
  );
}

function PropertyActions({ p }: { p: CrmPropertyDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const remove = useCrmMutation(() => crmApi.removePropertyFromCrm(p.id), () => router.push("/admin/property-crm/properties"));
  const destroy = useCrmMutation(() => crmApi.deleteProperty(p.id), () => router.push("/admin/property-crm/properties"));
  return (
    <>
      <SmallButton onClick={() => setEditing(true)}>Edit details</SmallButton>
      {p.in_crm ? (
        <SmallButton
          variant="ghost"
          disabled={remove.isPending}
          onClick={() => window.confirm(`Remove ${p.crm_ref} from the CRM? The listing itself is not changed.`) && remove.mutate(undefined)}
        >
          Remove from CRM
        </SmallButton>
      ) : null}
      {!p.published ? (
        <SmallButton
          variant="danger"
          disabled={destroy.isPending}
          onClick={() => window.confirm(`Permanently delete ${p.crm_ref ?? p.title}? This cannot be undone.`) && destroy.mutate(undefined)}
        >
          Delete
        </SmallButton>
      ) : null}
      <Link href="/admin/properties" className="rounded-md border px-2 py-1 hover:border-navy-800">Photos &amp; publishing</Link>
      <ErrorText error={remove.error || destroy.error} />
      {editing ? <PropertyFormModal property={p} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

export default function CrmPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, error } = useQuery({ queryKey: ["crm", "property", id], queryFn: () => crmApi.property(id) });

  if (isLoading) return <Shimmer className="h-64 w-full" />;
  if (error || !p) return <ErrorText error={error || new Error("Property not found")} />;

  const picked: Picked = { id: p.id, label: p.crm_ref ? `${p.crm_ref} · ${p.title}` : p.title };
  const relation = { property_id: p.id, landlord_id: p.landlord_id ?? undefined, label: p.crm_ref ?? p.title };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image_url} alt="" className="h-16 w-24 rounded object-cover border" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-mono text-gray-500">{p.crm_ref}</p>
            <h2 className="text-lg font-bold text-navy-800 dark:text-white truncate">{p.title}</h2>
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              {[p.property_type_name, p.neighborhood_name, p.district_name].filter(Boolean).join(" · ")}
              {" · "}
              <span className="tabular-nums font-semibold">{fmtMoney(p.price, p.currency)}</span>
              {p.price_period ? `/${p.price_period === "month" ? "mo" : p.price_period}` : ""}
              {p.bedrooms != null ? ` · ${p.bedrooms} bed` : ""}
              {p.bathrooms != null ? ` · ${p.bathrooms} bath` : ""}
              {p.area_sqm ? ` · ${p.area_sqm} m²` : ""}
              {p.is_furnished ? " · Furnished" : ""}
            </p>
            {p.address ? <p className="text-[11px] text-gray-500">{p.address}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={p.published ? "text-emerald-700" : "text-gray-500"}>
            {p.published ? "Published" : `Not published (${p.publication_status})`}
          </span>
          {p.published && p.public_url ? (
            <a href={p.public_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-navy-800">
              Public page <ExternalLink className="w-3 h-3" />
            </a>
          ) : null}
          <PropertyActions p={p} />
        </div>
      </div>
      {!p.in_crm ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 flex flex-wrap items-center justify-between gap-2">
          <span>This listing is not in the CRM, so it is hidden from CRM lists, reports and matching.</span>
          <AddBackButton id={p.id} />
        </div>
      ) : null}

      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <LinkedClients p={p} />
          <ViewingsPanel items={p.viewings} defaults={{ property: picked }} hide={["property"]} />
          <DealsPanel items={p.deals} defaults={{ property: picked }} hide={["property", "landlord"]} />
          <FollowUpsPanel items={p.follow_ups} defaults={relation} />
          <DocumentsPanel items={p.documents} defaults={relation} />
          <ActivityPanel items={p.activity} relation={relation} />
        </div>
        <div className="space-y-4">
          <AvailabilityControl property={p} />
          <LandlordCard p={p} />
          <CommissionCard p={p} />
          <NotesCard p={p} />
          <Card title="Record">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
              <dt className="text-gray-500">Internal ID</dt><dd className="font-mono">{p.crm_ref}</dd>
              <dt className="text-gray-500">Public slug</dt><dd className="truncate">{p.slug}</dd>
              <dt className="text-gray-500">Listing type</dt><dd className="capitalize">{p.listing_type}</dd>
              <dt className="text-gray-500">Created</dt><dd>{fmtDate(p.created_at)}</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
