"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { crmApi, type LeadDetail } from "@/services/crm-api";
import { Shimmer } from "@/components/ui/shimmer";
import {
  Card,
  ChoiceSelect,
  ContactLinks,
  EmptyRow,
  ErrorText,
  SmallButton,
  StatusBadge,
  fmtDate,
  fmtMoney,
  fmtRelative,
  humanize,
  linkCls,
  tableCls,
  tdCls,
  thCls,
  useCrmMutation,
  useLookups,
} from "@/components/admin/crm/ui";
import { ActivityPanel, DealsPanel, DocumentsPanel, FollowUpsPanel, ViewingsPanel, propertyHref } from "@/components/admin/crm/panels";
import { ContactLogModal, LeadFormModal } from "@/components/admin/crm/forms";
import { PropertyPicker, type Picked } from "@/components/admin/crm/entity-picker";

function LinkedProperties({ lead }: { lead: LeadDetail }) {
  const [prop, setProp] = useState<Picked | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const link = useCrmMutation((propertyId: string) => crmApi.linkLeadProperty(lead.id, propertyId), () => setProp(null));
  const unlink = useCrmMutation((propertyId: string) => crmApi.unlinkLeadProperty(lead.id, propertyId));
  const matches = useQuery({ queryKey: ["crm", "lead-matches", lead.id], queryFn: () => crmApi.leadMatches(lead.id), enabled: showMatches });

  return (
    <Card
      title={`Properties (${lead.properties.length})`}
      actions={<SmallButton variant="ghost" onClick={() => setShowMatches((v) => !v)}>{showMatches ? "Hide matches" : "Suggest matches"}</SmallButton>}
      bodyClassName="p-0"
    >
      <div className="flex gap-2 p-2 border-b">
        <div className="flex-1"><PropertyPicker value={prop} onChange={setProp} /></div>
        <SmallButton variant="primary" disabled={!prop || link.isPending} onClick={() => prop && link.mutate(prop.id)}>Link property</SmallButton>
      </div>
      <ErrorText error={link.error || unlink.error} />
      {showMatches ? (
        <div className="border-b bg-amber-50/50 dark:bg-navy-900 p-2">
          <p className="text-xs font-semibold text-gray-600 mb-1">Available properties matching budget & preferences</p>
          {matches.isLoading ? <Shimmer className="h-10 w-full" /> : null}
          {matches.data?.items.length === 0 ? <p className="text-xs text-gray-500">No matches. Try widening the client&apos;s preferences.</p> : null}
          <ul className="divide-y text-[13px]">
            {matches.data?.items.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                <span className="min-w-0 truncate">
                  <Link href={propertyHref(p.id)} className={linkCls}>{p.crm_ref}</Link> {p.title}
                  <span className="text-[11px] text-gray-500"> · {p.neighborhood_name} · {fmtMoney(p.price, p.currency)} · {p.bedrooms ?? "?"} bed</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <StatusBadge value={p.availability_status} />
                  <SmallButton disabled={link.isPending} onClick={() => link.mutate(p.id)}>Link</SmallButton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>Ref</th>
            <th className={thCls}>Property</th>
            <th className={thCls}>Rent</th>
            <th className={thCls}>Availability</th>
            <th className={thCls}>Linked</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {lead.properties.length === 0 ? <EmptyRow cols={6} text="No properties linked yet." /> : null}
          {lead.properties.map((p) => (
            <tr key={p.id}>
              <td className={tdCls}><Link href={propertyHref(p.id)} className={linkCls}>{p.crm_ref}</Link></td>
              <td className={`${tdCls} max-w-[260px]`}>
                <span className="line-clamp-1">{p.title}</span>
                <span className="text-[11px] text-gray-500">{p.neighborhood_name}{p.link_note ? ` · ${p.link_note}` : ""}</span>
              </td>
              <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{fmtMoney(p.price, p.currency)}</td>
              <td className={tdCls}><StatusBadge value={p.availability_status} /></td>
              <td className={`${tdCls} text-[12px] whitespace-nowrap`}>{fmtDate(p.linked_at)}</td>
              <td className={`${tdCls} text-right`}>
                <SmallButton variant="ghost" aria-label="Unlink" onClick={() => unlink.mutate(p.id)}><X className="w-3.5 h-3.5" /></SmallButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function CrmLeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lookups } = useLookups();
  const [modal, setModal] = useState<"edit" | "contact" | null>(null);
  const { data: lead, isLoading, error } = useQuery({ queryKey: ["crm", "lead", id], queryFn: () => crmApi.lead(id) });
  const setStatus = useCrmMutation((status: string) => crmApi.updateLead(id, { status }));
  const remove = useCrmMutation(() => crmApi.deleteLead(id), () => router.push("/admin/property-crm/leads"));

  if (isLoading) return <Shimmer className="h-64 w-full" />;
  if (error || !lead) return <ErrorText error={error || new Error("Client not found")} />;

  const picked: Picked = { id: lead.id, label: lead.name };
  const relation = { lead_id: lead.id, label: lead.name };
  const prefs: [string, React.ReactNode][] = [
    ["Budget", lead.budget_min != null || lead.budget_max != null
      ? `${lead.budget_min != null ? fmtMoney(lead.budget_min, lead.currency) : "…"} – ${lead.budget_max != null ? fmtMoney(lead.budget_max, lead.currency) : "…"}`
      : "—"],
    ["Location", [lead.neighborhood_name, lead.district_name].filter(Boolean).join(", ") || "Any"],
    ["Area preference", lead.area_preference || "—"],
    ["Bedrooms", lead.bedrooms != null ? `${lead.bedrooms}+` : "Any"],
    ["Bathrooms", lead.bathrooms != null ? `${lead.bathrooms}+` : "Any"],
    ["Furnishing", humanize(lead.furnishing)],
    ["Property type", lead.property_type_name || "Any"],
    ["Move-in", fmtDate(lead.move_in_date)],
    ["Source", humanize(lead.source)],
    ["Assigned to", lead.assigned_to_name || "—"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-800 dark:text-white">{lead.name}</h2>
          <ContactLinks phone={lead.phone} whatsapp={lead.whatsapp} email={lead.email} />
          <p className="text-[11px] text-gray-500">Added {fmtDate(lead.created_at)} · last contacted {fmtRelative(lead.last_contacted_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ChoiceSelect className="w-40 py-1 text-xs" value={lead.status} onChange={(v) => setStatus.mutate(v)} options={lookups?.vocab.lead_status ?? []} blank={null} />
          <SmallButton onClick={() => setModal("contact")}>Log contact</SmallButton>
          <SmallButton onClick={() => setModal("edit")}>Edit</SmallButton>
          <SmallButton variant="danger" onClick={() => confirm(`Delete client ${lead.name}?`) && remove.mutate(undefined)}>Delete</SmallButton>
        </div>
      </div>
      <ErrorText error={setStatus.error || remove.error} />

      <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <LinkedProperties lead={lead} />
          <ViewingsPanel items={lead.viewings} defaults={{ lead: picked }} hide={["lead"]} />
          <DealsPanel items={lead.deals} defaults={{ lead: picked }} hide={["lead"]} />
          <FollowUpsPanel items={lead.follow_ups} defaults={relation} />
          <DocumentsPanel items={lead.documents} defaults={relation} />
          <ActivityPanel items={lead.activity} relation={relation} />
        </div>
        <div className="space-y-4">
          <Card title="Requirements" actions={<StatusBadge value={lead.status} />}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              {prefs.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-gray-500">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {lead.requirements ? <p className="mt-2 text-[13px] whitespace-pre-wrap border-t pt-2">{lead.requirements}</p> : null}
          </Card>
          <Card title="Notes">
            <p className="text-[13px] whitespace-pre-wrap">{lead.notes || <span className="text-gray-500">No notes.</span>}</p>
          </Card>
        </div>
      </div>

      {modal === "edit" ? <LeadFormModal lead={lead} onClose={() => setModal(null)} /> : null}
      {modal === "contact" ? (
        <ContactLogModal title={`Log contact · ${lead.name}`} onSubmit={(b) => crmApi.leadContacted(lead.id, b)} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}
