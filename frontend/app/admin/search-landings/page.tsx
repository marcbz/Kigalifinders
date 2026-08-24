"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { SearchIntentAdmin } from "@/types/market";

export default function AdminSearchLandingsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-search-intents"],
    queryFn: () => adminService.searchIntents() as Promise<SearchIntentAdmin[]>,
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => adminService.regenerateSearchIntent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] }),
  });
  const approve = useMutation({
    mutationFn: (id: string) => adminService.approveSearchIntent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] }),
  });
  const noindex = useMutation({
    mutationFn: (id: string) => adminService.noindexSearchIntent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] }),
  });
  const rebuild = useMutation({
    mutationFn: () => adminService.rebuildResearch(),
  });
  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Search Landing Pages</h2>
          <p className="text-sm text-gray-500 mt-1">
            Curated rental intents only — approve before indexing. Quality score gates weak pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => rebuild.mutate()}
            className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white"
          >
            {rebuild.isPending ? "Rebuilding…" : "Rebuild research"}
          </button>
          <label className="px-4 py-2 text-sm rounded-lg border cursor-pointer">
            Import observations CSV
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
      </div>

      {(rebuild.data || importCsv.data) && (
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
          {JSON.stringify(rebuild.data || importCsv.data, null, 2)}
        </pre>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load intents.</p>}

      <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-navy-900 text-left">
            <tr>
              <th className="p-3">Page</th>
              <th className="p-3">Matches</th>
              <th className="p-3">Quality</th>
              <th className="p-3">Index</th>
              <th className="p-3">GSC</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">
                  <Link href={row.path} className="text-gold-600 underline" target="_blank">
                    {row.path}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">{row.h1}</div>
                </td>
                <td className="p-3">{row.match_count}</td>
                <td className="p-3">{row.quality_score}</td>
                <td className="p-3">
                  <span className="uppercase text-xs tracking-wide">{row.index_status}</span>
                </td>
                <td className="p-3 text-xs text-gray-500">
                  {row.gsc_impressions != null
                    ? `${row.gsc_impressions} imp / ${row.gsc_clicks ?? 0} clk`
                    : "—"}
                </td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button type="button" className="text-xs underline" onClick={() => regenerate.mutate(row.id)}>
                    Regenerate
                  </button>
                  <button type="button" className="text-xs underline" onClick={() => approve.mutate(row.id)}>
                    Approve
                  </button>
                  <button type="button" className="text-xs underline" onClick={() => noindex.mutate(row.id)}>
                    Noindex
                  </button>
                </td>
              </tr>
            ))}
            {!data.length && !isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-gray-500">
                  No intents yet. Run <code>python -m scripts.seed_search_intents</code> on the API, then rebuild research.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
