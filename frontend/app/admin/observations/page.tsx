"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";

type ObservationRow = {
  id: string;
  source: string;
  source_url?: string | null;
  neighborhood?: string | null;
  bedrooms?: number | null;
  property_type?: string | null;
  asking_price: number;
  currency: string;
  usd_price?: number | null;
  observation_status: string;
  observed_at?: string | null;
  data_label?: string;
};

type SourceRow = {
  source_id: string;
  name: string;
  collection_method: string;
  policy_notes?: string | null;
  last_import_at?: string | null;
  observation_count: number;
  last_error?: string | null;
};

type ImportResult = {
  rows_processed?: number;
  imported?: number;
  new_observations?: number;
  updated?: number;
  updated_observations?: number;
  duplicates?: number;
  invalid_rows?: number;
  errors?: string[];
  research?: Record<string, unknown>;
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export default function AdminObservationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-observations", status, sourceFilter],
    queryFn: () =>
      adminService.listObservations({
        page: 1,
        page_size: 100,
        status: status || undefined,
        source: sourceFilter || undefined,
      }) as Promise<{ items: ObservationRow[]; total: number }>,
  });
  const sources = useQuery({
    queryKey: ["admin-market-sources"],
    queryFn: () =>
      adminService.marketSources() as Promise<{
        policy: string;
        sources: SourceRow[];
        required_columns: string[];
        recommended_columns: string[];
      }>,
  });

  const items = data?.items || [];
  const sourceRows = sources.data?.sources || [];
  const visibleIds = items.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-observations"] });
    qc.invalidateQueries({ queryKey: ["admin-market-sources"] });
  };

  const importCsv = useMutation({
    mutationFn: ({ file, sourceId }: { file: File; sourceId?: string }) =>
      adminService.importObservationsCsv(file, sourceId) as Promise<ImportResult>,
    onSuccess: (res) => {
      setLastImport(res);
      invalidate();
    },
  });
  const bulk = useMutation({
    mutationFn: (action: string) => adminService.bulkObservations(Array.from(selected), action),
    onSuccess: () => {
      setSelected(new Set());
      invalidate();
    },
  });

  const runBulk = (action: string, destructive = false) => {
    if (!selected.size && action !== "reprocess") return;
    if (destructive && !window.confirm(`Apply “${action}” to ${selected.size} observation(s)?`)) return;
    bulk.mutate(action);
  };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of items) c[row.observation_status] = (c[row.observation_status] || 0) + 1;
    return c;
  }, [items]);

  const downloadTemplate = () => {
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    // Prefer API helper path via admin token cookie/header through axios isn't available as download —
    // use adminService wrapper if present, else construct blob from known template columns.
    void adminService.downloadObservationsCsvTemplate().then((blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "external-observations-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => {
      const csv =
        "source,source_url,source_listing_id,observed_at,property_type,bedrooms,bathrooms,neighborhood,neighborhood_slug,asking_price,currency,is_furnished,amenities,observation_status,notes\n";
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "external-observations-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
    void base;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">External Market Observations</h2>
          <p className="text-sm text-gray-500 mt-1">
            CSV/manual import only — completely separate from KigaliRent Verified inventory. Disappeared listings are
            never assumed rented.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="px-4 py-2 text-sm rounded-lg border" onClick={downloadTemplate}>
            Download CSV template
          </button>
          <label className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white cursor-pointer h-fit">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                importCsv.mutate({ file: f });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {sources.data?.policy && (
        <div className="text-xs text-gray-600 border rounded-xl p-4 bg-white dark:bg-navy-800 space-y-2">
          <p>{sources.data.policy}</p>
          <p>
            <strong>Required columns:</strong> {(sources.data.required_columns || []).join(", ")}
          </p>
          <p>
            <strong>Recommended columns:</strong> {(sources.data.recommended_columns || []).join(", ")}
          </p>
        </div>
      )}

      {lastImport && (
        <div className="border rounded-xl p-4 bg-white dark:bg-navy-800 text-sm space-y-2">
          <p className="font-medium text-navy-800 dark:text-white">Last import result</p>
          <dl className="grid sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
            <div>
              <dt className="text-gray-500">Rows processed</dt>
              <dd className="font-medium">{lastImport.rows_processed ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">New</dt>
              <dd className="font-medium">{lastImport.new_observations ?? lastImport.imported ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Updated</dt>
              <dd className="font-medium">{lastImport.updated_observations ?? lastImport.updated ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Duplicates</dt>
              <dd className="font-medium">{lastImport.duplicates ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Invalid</dt>
              <dd className="font-medium">{lastImport.invalid_rows ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Imported total</dt>
              <dd className="font-medium">{lastImport.imported ?? 0}</dd>
            </div>
          </dl>
          {(lastImport.errors || []).length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-5">
              {lastImport.errors!.slice(0, 12).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {lastImport.research && (
            <p className="text-xs text-gray-500">
              Research rebuilt automatically (snapshots / charts / search intents).
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white">External Sources</h3>
        <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-900 text-left">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Method</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Last import</th>
                <th className="p-3">Count</th>
                <th className="p-3">Import</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map((s) => (
                <tr key={s.source_id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[10px] text-gray-400">{s.source_id}</div>
                  </td>
                  <td className="p-3">{s.collection_method}</td>
                  <td className="p-3 text-xs text-gray-500 max-w-[280px]">{s.policy_notes || "—"}</td>
                  <td className="p-3 text-xs">{fmtDate(s.last_import_at)}</td>
                  <td className="p-3">{s.observation_count}</td>
                  <td className="p-3">
                    <label className="underline cursor-pointer text-xs">
                      Import CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          importCsv.mutate({ file: f, sourceId: s.source_id });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Observation rows</h3>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <select className="border rounded px-2 py-1" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            {sourceRows.map((s) => (
              <option key={s.source_id} value={s.source_id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active_observed">active_observed</option>
            <option value="not_found">not_found</option>
            <option value="price_changed">price_changed</option>
            <option value="unknown">unknown</option>
            <option value="invalid">invalid</option>
          </select>
          <span className="text-gray-500">
            {selected.size} selected · {data?.total ?? 0} total
          </span>
          <button type="button" className="underline" onClick={() => setSelected(new Set(visibleIds))}>
            Select all
          </button>
          <button type="button" className="underline" onClick={() => setSelected(new Set())}>
            Unselect all
          </button>
          <button type="button" className="underline" onClick={() => setSelected(new Set(visibleIds))}>
            Select visible
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_active")}>
            Mark Active
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_not_found", true)}>
            Mark Not Found
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_unknown")}>
            Mark Unknown
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_invalid", true)}>
            Mark Invalid
          </button>
          <button type="button" className="underline" onClick={() => runBulk("hide", true)}>
            Hide
          </button>
          <button type="button" className="underline" onClick={() => runBulk("reprocess")}>
            Reprocess
          </button>
        </div>

        {bulk.data && (
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">{JSON.stringify(bulk.data, null, 2)}</pre>
        )}

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">Failed to load observations.</p>}

        <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-900 text-left">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))}
                    aria-label="Select visible"
                  />
                </th>
                <th className="p-3">Source</th>
                <th className="p-3">Area</th>
                <th className="p-3">Type / beds</th>
                <th className="p-3">USD</th>
                <th className="p-3">Status</th>
                <th className="p-3">Observed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select observation ${row.id}`}
                    />
                  </td>
                  <td className="p-3">
                    <div>{row.source}</div>
                    {row.source_url && (
                      <a href={row.source_url} target="_blank" rel="noreferrer" className="text-xs text-gold-600 underline">
                        URL
                      </a>
                    )}
                    <div className="text-[10px] text-gray-400">{row.data_label}</div>
                  </td>
                  <td className="p-3">{row.neighborhood || "—"}</td>
                  <td className="p-3">
                    {row.property_type || "—"}
                    {row.bedrooms != null ? ` · ${row.bedrooms} bed` : ""}
                  </td>
                  <td className="p-3">
                    {row.usd_price != null ? `$${row.usd_price.toLocaleString()}` : "—"}
                    <div className="text-[10px] text-gray-400">
                      {row.asking_price} {row.currency}
                    </div>
                  </td>
                  <td className="p-3 text-xs uppercase">{row.observation_status}</td>
                  <td className="p-3 text-xs">{row.observed_at ? new Date(row.observed_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {!items.length && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-gray-500">
                    No observations yet. Download the CSV template, fill required columns (source, source_url,
                    asking_price, currency), then Import CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">Visible status mix: {JSON.stringify(statusCounts)}</p>
      </section>
    </div>
  );
}
