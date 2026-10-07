"use client";

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import { ChoiceSelect, ErrorText, PageHeader, inputCls, useDebounced, useLookups } from "@/components/admin/crm/ui";
import { DocumentsTable } from "@/components/admin/crm/panels";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["q", "doc_type"] as const;

function DocumentsInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [q, setQ] = useState(f.q);
  const debouncedQ = useDebounced(q);
  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = Number(f.page) || 1;
  const params = { ...f, page, page_size: 50 };
  const { data, error, isFetching } = useQuery({
    queryKey: ["crm", "documents", params],
    queryFn: () => crmApi.documents(params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3">
      <PageHeader
        title="Documents"
        subtitle="Files are stored privately and opened through short-lived signed links. Add documents from a landlord, property or client page."
      />
      {data && !data.storage_configured ? (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          File storage is not configured on the server, so only links can be added. Set the Cloudinary credentials to enable private uploads.
        </p>
      ) : null}
      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search title or file name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChoiceSelect className="max-w-[220px]" value={f.doc_type} onChange={(v) => setF({ doc_type: v })} options={lookups?.vocab.document_type ?? []} blank="Any type" />
      </div>
      <ErrorText error={error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 ${isFetching ? "opacity-70" : ""}`}>
        <DocumentsTable items={data?.items ?? []} />
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} documents</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CrmDocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsInner />
    </Suspense>
  );
}
