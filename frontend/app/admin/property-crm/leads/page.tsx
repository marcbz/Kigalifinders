"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import {
  ChoiceSelect,
  ContactLinks,
  EmptyRow,
  ErrorText,
  PageHeader,
  SmallButton,
  StatusBadge,
  fmtDate,
  fmtMoney,
  fmtRelative,
  humanize,
  inputCls,
  linkCls,
  tableCls,
  tdCls,
  thCls,
  useDebounced,
  useLookups,
} from "@/components/admin/crm/ui";
import { leadHref } from "@/components/admin/crm/panels";
import { LeadFormModal } from "@/components/admin/crm/forms";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["q", "status", "active", "source", "assigned_to_id", "sort", "order"] as const;

function budget(min: number | null, max: number | null, currency: string) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${fmtMoney(min, currency)} – ${fmtMoney(max, currency)}`;
  return max != null ? `up to ${fmtMoney(max, currency)}` : `from ${fmtMoney(min, currency)}`;
}

function LeadsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [q, setQ] = useState(f.q);
  const debouncedQ = useDebounced(q);
  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const [creating, setCreating] = useState(false);
  const page = Number(f.page) || 1;
  const params = { ...f, active: f.active === "1", sort: f.sort || "created", order: f.order || "desc", page, page_size: 30 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "leads", params],
    queryFn: () => crmApi.leads(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader title="Clients" subtitle="Tenants and buyers looking for a property." actions={<SmallButton variant="primary" onClick={() => setCreating(true)}>+ New client</SmallButton>} />
      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search name, phone, email, requirements…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChoiceSelect className="max-w-[170px]" value={f.status} onChange={(v) => setF({ status: v })} options={lookups?.vocab.lead_status ?? []} blank="Any status" />
        <ChoiceSelect className="max-w-[170px]" value={f.source} onChange={(v) => setF({ source: v })} options={lookups?.vocab.lead_source ?? []} blank="Any source" />
        <ChoiceSelect className="max-w-[170px]" value={f.assigned_to_id} onChange={(v) => setF({ assigned_to_id: v })} options={lookups?.users ?? []} blank="Anyone" />
        <ChoiceSelect
          className="max-w-[180px]"
          value={f.sort}
          onChange={(v) => setF({ sort: v, order: v === "name" || v === "move_in" ? "asc" : "desc" })}
          options={[{ id: "created", name: "Sort: newest" }, { id: "name", name: "Sort: name" }, { id: "move_in", name: "Sort: move-in" }, { id: "budget", name: "Sort: budget" }, { id: "contacted", name: "Sort: last contacted" }]}
          blank={null}
        />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={f.active === "1"} onChange={(e) => setF({ active: e.target.checked ? "1" : "" })} />
          Active only
        </label>
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 overflow-x-auto ${isFetching ? "opacity-70" : ""}`}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Client</th>
              <th className={thCls}>Contact</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Budget</th>
              <th className={thCls}>Looking for</th>
              <th className={thCls}>Move-in</th>
              <th className={thCls}>Source</th>
              <th className={thCls}>Assigned</th>
              <th className={thCls}>Last contact</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 ? <EmptyRow cols={9} text="No clients match." /> : null}
            {data?.items.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/40">
                <td className={tdCls}>
                  <Link href={leadHref(l.id)} className={linkCls}>{l.name}</Link>
                  <span className="block text-[11px] text-gray-500">Added {fmtDate(l.created_at)}</span>
                </td>
                <td className={tdCls}><ContactLinks phone={l.phone} whatsapp={l.whatsapp} email={l.email} /></td>
                <td className={tdCls}><StatusBadge value={l.status} /></td>
                <td className={`${tdCls} text-[12px] whitespace-nowrap tabular-nums`}>{budget(l.budget_min, l.budget_max, l.currency)}</td>
                <td className={`${tdCls} text-[12px] max-w-[220px]`}>
                  {[l.bedrooms != null ? `${l.bedrooms}+ bed` : null, l.property_type_name, l.neighborhood_name || l.district_name || l.area_preference,
                    l.furnishing && l.furnishing !== "ANY" ? humanize(l.furnishing) : null].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className={`${tdCls} text-[12px] whitespace-nowrap`}>{fmtDate(l.move_in_date)}</td>
                <td className={`${tdCls} text-[12px]`}>{humanize(l.source)}</td>
                <td className={`${tdCls} text-[12px]`}>{l.assigned_to_name || "—"}</td>
                <td className={`${tdCls} text-[12px] whitespace-nowrap`}>{fmtRelative(l.last_contacted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} clients</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
      {creating ? <LeadFormModal onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

export default function CrmLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsInner />
    </Suspense>
  );
}
