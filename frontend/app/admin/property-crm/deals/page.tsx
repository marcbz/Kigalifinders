"use client";

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi, type Deal } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import { ChoiceSelect, ErrorText, PageHeader, SmallButton, inputCls, useDebounced, useLookups } from "@/components/admin/crm/ui";
import { DealsTable } from "@/components/admin/crm/panels";
import { DealFormModal } from "@/components/admin/crm/forms";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["q", "status", "open_only", "commission_status", "landlord_id", "sort", "order"] as const;

function DealsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [q, setQ] = useState(f.q);
  const debouncedQ = useDebounced(q);
  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const page = Number(f.page) || 1;
  const params = { ...f, open_only: f.open_only === "1", sort: f.sort || "created", order: f.order || "desc", page, page_size: 30 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "deals", params],
    queryFn: () => crmApi.deals(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Deals"
        subtitle="Completing a deal marks the property Rented unless you choose to keep its availability."
        actions={<SmallButton variant="primary" onClick={() => setCreating(true)}>+ New deal</SmallButton>}
      />
      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search ref, property, client, landlord…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChoiceSelect className="max-w-[160px]" value={f.status} onChange={(v) => setF({ status: v })} options={lookups?.vocab.deal_status ?? []} blank="Any stage" />
        <ChoiceSelect className="max-w-[180px]" value={f.commission_status} onChange={(v) => setF({ commission_status: v })} options={lookups?.vocab.commission_status ?? []} blank="Any commission" />
        <ChoiceSelect className="max-w-[180px]" value={f.landlord_id} onChange={(v) => setF({ landlord_id: v })} options={lookups?.landlords ?? []} blank="Any landlord" />
        <ChoiceSelect
          className="max-w-[180px]"
          value={f.sort}
          onChange={(v) => setF({ sort: v, order: v === "move_in" || v === "due" ? "asc" : "desc" })}
          options={[{ id: "created", name: "Sort: newest" }, { id: "move_in", name: "Sort: move-in" }, { id: "rent", name: "Sort: rent" }, { id: "commission", name: "Sort: commission" }, { id: "due", name: "Sort: commission due" }]}
          blank={null}
        />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={f.open_only === "1"} onChange={(e) => setF({ open_only: e.target.checked ? "1" : "" })} />
          Open only
        </label>
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 ${isFetching ? "opacity-70" : ""}`}>
        <DealsTable items={data?.items ?? []} onEdit={setEditing} />
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} deals</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
      {creating ? <DealFormModal onClose={() => setCreating(false)} /> : null}
      {editing ? <DealFormModal deal={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

export default function CrmDealsPage() {
  return (
    <Suspense fallback={null}>
      <DealsInner />
    </Suspense>
  );
}
