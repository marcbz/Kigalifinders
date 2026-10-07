"use client";

import { Suspense, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi, type Viewing } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import { ChoiceSelect, ErrorText, PageHeader, SmallButton, Tabs, inputCls, useLookups } from "@/components/admin/crm/ui";
import { ViewingsTable } from "@/components/admin/crm/panels";
import { ViewingFormModal } from "@/components/admin/crm/forms";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["scope", "status", "date_from", "date_to"] as const;
type Scope = "upcoming" | "today" | "past" | "all";

function ViewingsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Viewing | null>(null);
  const scope = (f.scope || "upcoming") as Scope;
  const page = Number(f.page) || 1;
  const params = { ...f, scope, page, page_size: 30 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "viewings", params],
    queryFn: () => crmApi.viewings(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader title="Viewings" actions={<SmallButton variant="primary" onClick={() => setCreating(true)}>+ Schedule viewing</SmallButton>} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Tabs<Scope>
          active={scope}
          onChange={(s) => setF({ scope: s })}
          tabs={[{ id: "upcoming", label: "Upcoming" }, { id: "today", label: "Today" }, { id: "past", label: "Past" }, { id: "all", label: "All" }]}
        />
        <div className="flex gap-2">
          <ChoiceSelect className="w-40" value={f.status} onChange={(v) => setF({ status: v })} options={lookups?.vocab.viewing_status ?? []} blank="Any status" />
          <input className={`${inputCls} w-36`} type="date" value={f.date_from} onChange={(e) => setF({ date_from: e.target.value })} title="From" />
          <input className={`${inputCls} w-36`} type="date" value={f.date_to} onChange={(e) => setF({ date_to: e.target.value })} title="To" />
        </div>
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 ${isFetching ? "opacity-70" : ""}`}>
        <ViewingsTable items={data?.items ?? []} onEdit={setEditing} />
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} viewings</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
      {creating ? <ViewingFormModal onClose={() => setCreating(false)} /> : null}
      {editing ? <ViewingFormModal viewing={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

export default function CrmViewingsPage() {
  return (
    <Suspense fallback={null}>
      <ViewingsInner />
    </Suspense>
  );
}
