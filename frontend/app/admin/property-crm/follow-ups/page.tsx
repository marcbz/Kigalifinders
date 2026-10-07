"use client";

import { Suspense, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi, type FollowUp } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import { ChoiceSelect, ErrorText, PageHeader, SmallButton, Tabs, useLookups } from "@/components/admin/crm/ui";
import { FollowUpsTable } from "@/components/admin/crm/panels";
import { FollowUpFormModal } from "@/components/admin/crm/forms";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["scope", "priority", "assigned_to_id"] as const;
type Scope = "open" | "overdue" | "today" | "upcoming" | "completed" | "all";

function FollowUpsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const scope = (f.scope || "open") as Scope;
  const page = Number(f.page) || 1;
  const params = { ...f, scope, page, page_size: 50 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "follow-ups", params],
    queryFn: () => crmApi.followUps(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader title="Follow-ups" actions={<SmallButton variant="primary" onClick={() => setCreating(true)}>+ New follow-up</SmallButton>} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Tabs<Scope>
          active={scope}
          onChange={(s) => setF({ scope: s })}
          tabs={[
            { id: "open", label: "Open" },
            { id: "overdue", label: "Overdue" },
            { id: "today", label: "Today" },
            { id: "upcoming", label: "Upcoming" },
            { id: "completed", label: "Completed" },
            { id: "all", label: "All" },
          ]}
        />
        <div className="flex gap-2">
          <ChoiceSelect className="w-36" value={f.priority} onChange={(v) => setF({ priority: v })} options={lookups?.vocab.follow_up_priority ?? []} blank="Any priority" />
          <ChoiceSelect className="w-44" value={f.assigned_to_id} onChange={(v) => setF({ assigned_to_id: v })} options={lookups?.users ?? []} blank="Anyone" />
        </div>
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 ${isFetching ? "opacity-70" : ""}`}>
        <FollowUpsTable items={data?.items ?? []} onEdit={setEditing} />
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} follow-ups</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
      {creating ? <FollowUpFormModal onClose={() => setCreating(false)} /> : null}
      {editing ? <FollowUpFormModal followUp={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

export default function CrmFollowUpsPage() {
  return (
    <Suspense fallback={null}>
      <FollowUpsInner />
    </Suspense>
  );
}
