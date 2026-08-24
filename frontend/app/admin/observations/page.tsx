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

export default function AdminObservationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-observations", status],
    queryFn: () =>
      adminService.listObservations({ page: 1, page_size: 100, status: status || undefined }) as Promise<{
        items: ObservationRow[];
        total: number;
      }>,
  });
  const items = data?.items || [];
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

  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-observations"] }),
  });
  const bulk = useMutation({
    mutationFn: (action: string) => adminService.bulkObservations(Array.from(selected), action),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-observations"] });
    },
  });
  const sources = useQuery({
    queryKey: ["admin-market-sources"],
    queryFn: () => adminService.marketSources(),
  });

  const runBulk = (action: string, destructive = false) => {
    if (!selected.size) return;
    if (destructive && !window.confirm(`Apply “${action}” to ${selected.size} observation(s)?`)) return;
    bulk.mutate(action);
  };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of items) c[row.observation_status] = (c[row.observation_status] || 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">External Market Observations</h2>
          <p className="text-sm text-gray-500 mt-1">
            Separate from KigaliRent Verified inventory. Disappeared listings are never assumed rented.
          </p>
        </div>
        <label className="px-4 py-2 text-sm rounded-lg border cursor-pointer h-fit">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv.mutate(f);
            }}
          />
        </label>
      </div>

      {sources.data && (
        <div className="text-xs text-gray-600 border rounded-xl p-4 bg-white dark:bg-navy-800 space-y-2">
          <p className="font-medium text-navy-800 dark:text-white">Source policy</p>
          <p>{sources.data.policy}</p>
          <ul className="list-disc pl-5">
            {(sources.data.sources || []).map((s: { id: string; name: string; preferred_ingest: string; notes: string }) => (
              <li key={s.id}>
                <strong>{s.name}</strong> — prefer {s.preferred_ingest}. {s.notes}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active_observed">active_observed</option>
          <option value="not_found">not_found</option>
          <option value="price_changed">price_changed</option>
          <option value="unknown">unknown</option>
          <option value="invalid">invalid</option>
        </select>
        <span className="text-gray-500">{selected.size} selected · {data?.total ?? 0} total</span>
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
          Mark active
        </button>
        <button type="button" className="underline" onClick={() => runBulk("mark_not_found", true)}>
          Mark not found
        </button>
        <button type="button" className="underline" onClick={() => runBulk("mark_unknown")}>
          Mark unknown
        </button>
        <button type="button" className="underline" onClick={() => runBulk("mark_invalid", true)}>
          Mark invalid
        </button>
        <button type="button" className="underline" onClick={() => runBulk("reprocess", true)}>
          Reprocess
        </button>
      </div>

      {(importCsv.data || bulk.data) && (
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
          {JSON.stringify(importCsv.data || bulk.data, null, 2)}
        </pre>
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
                  onChange={() =>
                    setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))
                  }
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
                <td className="p-3 text-xs">
                  {row.observed_at ? new Date(row.observed_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {!items.length && !isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-gray-500">
                  No observations yet. Import a CSV (see backend/data/sample_observations.csv). Crawlers stay disabled
                  until source policy review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Visible status mix: {JSON.stringify(statusCounts)}</p>
    </div>
  );
}
