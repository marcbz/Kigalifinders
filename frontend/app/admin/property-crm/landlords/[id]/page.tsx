"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { crmApi, type LandlordDetail } from "@/services/crm-api";
import { Shimmer } from "@/components/ui/shimmer";
import {
  Card,
  ContactLinks,
  EmptyRow,
  ErrorText,
  KpiCard,
  SmallButton,
  StatusBadge,
  Tabs,
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
import { ActivityPanel, DealsPanel, DocumentsPanel, FollowUpsPanel, propertyHref } from "@/components/admin/crm/panels";
import { ContactLogModal, LandlordFormModal } from "@/components/admin/crm/forms";

type Tab = "overview" | "properties" | "deals" | "commission" | "follow-ups" | "activity" | "documents" | "notes";

function PropertiesTable({ l }: { l: LandlordDetail }) {
  const confirm = useCrmMutation((id: string) => crmApi.confirmAvailable(id));
  return (
    <div className="overflow-x-auto">
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>Ref</th>
            <th className={thCls}>Property</th>
            <th className={thCls}>Area</th>
            <th className={thCls}>Rent</th>
            <th className={thCls}>Availability</th>
            <th className={thCls}>Verified</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {l.properties.length === 0 ? <EmptyRow cols={7} text="No properties linked. Link one from a property page." /> : null}
          {l.properties.map((p) => (
            <tr key={p.id}>
              <td className={tdCls}><Link href={propertyHref(p.id)} className={linkCls}>{p.crm_ref}</Link></td>
              <td className={`${tdCls} max-w-[260px] truncate`}>{p.title}</td>
              <td className={`${tdCls} text-[12px]`}>{p.neighborhood_name || "—"}</td>
              <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{fmtMoney(p.price, p.currency)}</td>
              <td className={tdCls}><StatusBadge value={p.availability_status} /></td>
              <td className={`${tdCls} text-[12px] ${p.verification_due ? "text-amber-700" : ""}`}>{fmtRelative(p.availability_verified_at)}</td>
              <td className={`${tdCls} text-right`}>
                {p.availability_status !== "AVAILABLE" || p.verification_due ? (
                  <SmallButton disabled={confirm.isPending} onClick={() => confirm.mutate(p.id)}>✓ Available</SmallButton>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText error={confirm.error} />
    </div>
  );
}

function NotesTab({ l }: { l: LandlordDetail }) {
  const [notes, setNotes] = useState(l.notes ?? "");
  useEffect(() => setNotes(l.notes ?? ""), [l.notes]);
  const m = useCrmMutation(() => crmApi.updateLandlord(l.id, { notes }));
  return (
    <Card title="Notes">
      <textarea className={`${inputCls} min-h-[160px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="mt-1 flex items-center gap-2">
        <SmallButton variant="primary" disabled={m.isPending || notes === (l.notes ?? "")} onClick={() => m.mutate(undefined)}>Save notes</SmallButton>
        <ErrorText error={m.error} />
      </div>
    </Card>
  );
}

export default function CrmLandlordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<"edit" | "contact" | null>(null);
  const { data: l, isLoading, error } = useQuery({ queryKey: ["crm", "landlord", id], queryFn: () => crmApi.landlord(id) });
  const remove = useCrmMutation(() => crmApi.deleteLandlord(id), () => router.push("/admin/property-crm/landlords"));

  if (isLoading) return <Shimmer className="h-64 w-full" />;
  if (error || !l) return <ErrorText error={error || new Error("Landlord not found")} />;

  const relation = { landlord_id: l.id, label: l.name };
  const openFollowUps = l.follow_ups.filter((f) => f.status === "PENDING" || f.status === "IN_PROGRESS");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-800 dark:text-white">
            {l.name} <StatusBadge value={l.status} className="align-middle" />
          </h2>
          <ContactLinks phone={l.phone} whatsapp={l.whatsapp} email={l.email} />
          <p className="text-[11px] text-gray-500">
            Added {fmtDate(l.created_at)} · last contacted {fmtRelative(l.last_contacted_at)}
            {l.next_follow_up_at ? ` · next follow-up ${fmtDateTime(l.next_follow_up_at)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <SmallButton onClick={() => setModal("contact")}>Log contact</SmallButton>
          <SmallButton onClick={() => setModal("edit")}>Edit</SmallButton>
          <SmallButton
            variant="danger"
            onClick={() => {
              if (confirm(`Delete landlord ${l.name}?`)) remove.mutate(undefined);
            }}
          >
            Delete
          </SmallButton>
        </div>
      </div>
      <ErrorText error={remove.error} />

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "properties", label: "Properties", count: l.properties_total },
          { id: "deals", label: "Deals", count: l.deals.length },
          { id: "commission", label: "Commission" },
          { id: "follow-ups", label: "Follow-ups", count: openFollowUps.length },
          { id: "activity", label: "Activity" },
          { id: "documents", label: "Documents", count: l.documents.length },
          { id: "notes", label: "Notes" },
        ]}
      />

      {tab === "overview" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <KpiCard label="Properties" value={l.properties_total} />
            <KpiCard label="Active" value={l.properties_active} tone="good" />
            <KpiCard label="Rented" value={l.properties_rented} />
            <KpiCard label="Commission paid" value={fmtMoney(l.commission_summary.paid_usd, "USD")} />
            <KpiCard label="Commission pending" value={fmtMoney(l.commission_summary.pending_usd, "USD")} />
            <KpiCard label="Open follow-ups" value={openFollowUps.length} tone={openFollowUps.some((f) => f.overdue) ? "bad" : undefined} />
          </div>
          <div className="grid lg:grid-cols-2 gap-3">
            <Card title="Details">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-gray-500">Preferred contact</dt><dd>{humanize(l.preferred_contact)}</dd>
                <dt className="text-gray-500">Commission</dt><dd>{fmtCommission(l.commission_type, l.commission_value, l.commission_currency)}</dd>
                <dt className="text-gray-500">Agreement notes</dt><dd>{l.commission_notes || "—"}</dd>
                <dt className="text-gray-500">Notes</dt><dd className="whitespace-pre-wrap">{l.notes || "—"}</dd>
              </dl>
            </Card>
            <Card title="Properties" bodyClassName="p-0"><PropertiesTable l={l} /></Card>
          </div>
        </div>
      ) : null}
      {tab === "properties" ? <Card title="Properties" bodyClassName="p-0"><PropertiesTable l={l} /></Card> : null}
      {tab === "deals" ? <DealsPanel items={l.deals} defaults={{ landlord_id: l.id }} hide={["landlord"]} /> : null}
      {tab === "commission" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 max-w-xl">
            <KpiCard label="Paid" value={fmtMoney(l.commission_summary.paid_usd, "USD")} tone="good" />
            <KpiCard label="Pending" value={fmtMoney(l.commission_summary.pending_usd, "USD")} />
            <KpiCard label="Overdue" value={fmtMoney(l.commission_summary.overdue_usd, "USD")} tone={l.commission_summary.overdue_usd ? "bad" : undefined} />
          </div>
          <Card title="Agreement" actions={<SmallButton variant="ghost" onClick={() => setModal("edit")}>Edit</SmallButton>}>
            <p className="text-[13px]">{fmtCommission(l.commission_type, l.commission_value, l.commission_currency)}</p>
            {l.commission_notes ? <p className="text-[12px] text-gray-500">{l.commission_notes}</p> : null}
          </Card>
          <DealsPanel title="Commission by deal" items={l.deals.filter((d) => d.commission_type)} defaults={{ landlord_id: l.id }} hide={["landlord"]} />
        </div>
      ) : null}
      {tab === "follow-ups" ? <FollowUpsPanel items={l.follow_ups} defaults={relation} /> : null}
      {tab === "activity" ? <ActivityPanel items={l.activity} relation={relation} /> : null}
      {tab === "documents" ? <DocumentsPanel items={l.documents} defaults={relation} /> : null}
      {tab === "notes" ? <NotesTab l={l} /> : null}

      {modal === "edit" ? <LandlordFormModal landlord={l} onClose={() => setModal(null)} /> : null}
      {modal === "contact" ? (
        <ContactLogModal title={`Log contact · ${l.name}`} onSubmit={(b) => crmApi.landlordContacted(l.id, b)} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}
