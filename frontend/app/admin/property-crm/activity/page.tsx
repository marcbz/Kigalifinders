"use client";

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import { Card, ChoiceSelect, ErrorText, PageHeader, inputCls, useDebounced } from "@/components/admin/crm/ui";
import { ActivityList } from "@/components/admin/crm/panels";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["q", "event"] as const;

const EVENTS = [
  "property_created", "property_updated", "price_changed", "availability_changed", "availability_confirmed", "availability_flagged",
  "landlord_created", "landlord_updated", "landlord_contacted", "lead_created", "lead_updated", "lead_status_changed", "lead_contacted",
  "lead_property_linked", "viewing_scheduled", "viewing_updated", "viewing_completed", "deal_created", "deal_status_changed",
  "deal_completed", "commission_updated", "commission_paid", "follow_up_created", "follow_up_completed", "document_added",
  "document_deleted", "note_added",
];

function ActivityInner() {
  const [f, setF] = useUrlFilters(KEYS);
  const [q, setQ] = useState(f.q);
  const debouncedQ = useDebounced(q);
  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = Number(f.page) || 1;
  const params = { ...f, page, page_size: 50 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "activity", params],
    queryFn: () => crmApi.activity(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader title="Activity log" subtitle="Every CRM change, who made it and when. Entries cannot be edited." />
      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search summaries and notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChoiceSelect className="max-w-[240px]" value={f.event} onChange={(v) => setF({ event: v })} options={EVENTS} blank="All events" />
      </div>
      <ErrorText error={error} />
      <Card className={isFetching ? "opacity-70" : ""}>
        <ActivityList items={data?.items ?? []} />
        {data ? (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{data.total} entries</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default function CrmActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityInner />
    </Suspense>
  );
}
