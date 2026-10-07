"use client";

import { Suspense, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi, type Deal } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import { ChoiceSelect, ErrorText, KpiCard, PageHeader, fmtMoney, useLookups } from "@/components/admin/crm/ui";
import { DealsTable } from "@/components/admin/crm/panels";
import { DealFormModal } from "@/components/admin/crm/forms";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["status", "overdue", "landlord_id"] as const;

function CommissionsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [editing, setEditing] = useState<Deal | null>(null);
  const page = Number(f.page) || 1;
  const params = { ...f, overdue: f.overdue === "1", page, page_size: 30 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "commissions", params],
    queryFn: () => crmApi.commissions(params),
    placeholderData: keepPreviousData,
  });
  const s = data?.summary;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Commissions"
        subtitle="Commission is tracked per deal. Rates come from the deal, else the property, else the landlord agreement. Totals shown in USD."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="Expected" value={s ? fmtMoney(s.expected_usd, "USD") : "…"} />
        <KpiCard label="Invoiced / pending" value={s ? fmtMoney(s.pending_usd, "USD") : "…"} tone="warn" />
        <KpiCard label="Overdue" value={s ? fmtMoney(s.overdue_usd, "USD") : "…"} tone={s?.overdue_usd ? "bad" : undefined} hint={s ? `${s.overdue_count} deals` : undefined} />
        <KpiCard label="Paid" value={s ? fmtMoney(s.paid_usd, "USD") : "…"} tone="good" />
      </div>
      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 flex flex-wrap items-center gap-2">
        <ChoiceSelect className="max-w-[180px]" value={f.status} onChange={(v) => setF({ status: v })} options={lookups?.vocab.commission_status ?? []} blank="Any status" />
        <ChoiceSelect className="max-w-[200px]" value={f.landlord_id} onChange={(v) => setF({ landlord_id: v })} options={lookups?.landlords ?? []} blank="Any landlord" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={f.overdue === "1"} onChange={(e) => setF({ overdue: e.target.checked ? "1" : "" })} />
          Overdue only
        </label>
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 ${isFetching ? "opacity-70" : ""}`}>
        <DealsTable items={data?.items ?? []} onEdit={setEditing} />
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} deals with commission</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
      {editing ? <DealFormModal deal={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

export default function CrmCommissionsPage() {
  return (
    <Suspense fallback={null}>
      <CommissionsInner />
    </Suspense>
  );
}
