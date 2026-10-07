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
  ManagerTag,
  StatusBadge,
  fmtCommission,
  fmtDateTime,
  fmtRelative,
  inputCls,
  linkCls,
  tableCls,
  tdCls,
  thCls,
  useDebounced,
  useLookups,
} from "@/components/admin/crm/ui";
import { landlordHref } from "@/components/admin/crm/panels";
import { LandlordFormModal } from "@/components/admin/crm/forms";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["q", "status", "contact_type", "sort", "order"] as const;

function LandlordsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [q, setQ] = useState(f.q);
  const debouncedQ = useDebounced(q);
  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const [creating, setCreating] = useState<string | null>(null);
  const page = Number(f.page) || 1;
  const params = { ...f, sort: f.sort || "name", order: f.order || "asc", page, page_size: 30 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "landlords", params],
    queryFn: () => crmApi.landlords(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Landlords & property managers"
        subtitle="Owners and the property managers who handle properties on their behalf."
        actions={
          <>
            <SmallButton onClick={() => setCreating("PROPERTY_MANAGER")}>+ Property manager</SmallButton>
            <SmallButton variant="primary" onClick={() => setCreating("OWNER")}>+ New landlord</SmallButton>
          </>
        }
      />
      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search name, company, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChoiceSelect
          className="max-w-[180px]"
          value={f.contact_type}
          onChange={(v) => setF({ contact_type: v })}
          options={[{ id: "OWNER", name: "Landlords (owners)" }, { id: "PROPERTY_MANAGER", name: "Property managers" }]}
          blank="Landlords & managers"
        />
        <ChoiceSelect className="max-w-[180px]" value={f.status} onChange={(v) => setF({ status: v })} options={lookups?.vocab.landlord_status ?? []} blank="Any status" />
        <ChoiceSelect
          className="max-w-[200px]"
          value={f.sort}
          onChange={(v) => setF({ sort: v, order: v === "name" ? "asc" : v === "follow_up" ? "asc" : "desc" })}
          options={[{ id: "name", name: "Sort: name" }, { id: "created", name: "Sort: newest" }, { id: "contacted", name: "Sort: last contacted" }, { id: "follow_up", name: "Sort: next follow-up" }]}
          blank={null}
        />
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 overflow-x-auto ${isFetching ? "opacity-70" : ""}`}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Name</th>
              <th className={thCls}>Contact</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Properties</th>
              <th className={thCls}>Commission</th>
              <th className={thCls}>Last contacted</th>
              <th className={thCls}>Next follow-up</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 ? <EmptyRow cols={7} text="No landlords or property managers yet." /> : null}
            {data?.items.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/40">
                <td className={tdCls}>
                  <Link href={landlordHref(l.id)} className={linkCls}>{l.name}</Link>
                  <ManagerTag type={l.contact_type} company={l.company} />
                  {l.preferred_contact ? <span className="block text-[11px] text-gray-500">Prefers {l.preferred_contact.toLowerCase()}</span> : null}
                </td>
                <td className={tdCls}><ContactLinks phone={l.phone} whatsapp={l.whatsapp} email={l.email} /></td>
                <td className={tdCls}><StatusBadge value={l.status} /></td>
                <td className={`${tdCls} tabular-nums text-[12px]`}>
                  {l.properties_total} total · {l.properties_active} active · {l.properties_rented} rented
                </td>
                <td className={`${tdCls} text-[12px]`}>{fmtCommission(l.commission_type, l.commission_value, l.commission_currency)}</td>
                <td className={`${tdCls} text-[12px] whitespace-nowrap`}>{fmtRelative(l.last_contacted_at)}</td>
                <td className={`${tdCls} text-[12px] whitespace-nowrap ${l.next_follow_up_at && new Date(l.next_follow_up_at) < new Date() ? "text-red-700 font-semibold" : ""}`}>
                  {l.next_follow_up_at ? fmtDateTime(l.next_follow_up_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} contacts</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
      {creating ? <LandlordFormModal defaultType={creating} onClose={() => setCreating(null)} /> : null}
    </div>
  );
}

export default function CrmLandlordsPage() {
  return (
    <Suspense fallback={null}>
      <LandlordsInner />
    </Suspense>
  );
}
