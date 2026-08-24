"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { SearchIntentAdmin } from "@/types/market";

const TABS = [
  { id: "all", label: "All" },
  { id: "discovered", label: "Discovered" },
  { id: "draft", label: "Draft" },
  { id: "indexable", label: "Indexable / Published" },
  { id: "noindex", label: "Noindex" },
  { id: "disabled", label: "Disabled" },
] as const;

export default function AdminSearchLandingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-search-intents"],
    queryFn: () => adminService.searchIntents() as Promise<SearchIntentAdmin[]>,
  });

  const filtered = useMemo(() => {
    if (tab === "all") return data;
    if (tab === "indexable") return data.filter((r) => r.index_status === "indexable");
    return data.filter((r) => r.index_status === tab);
  }, [data, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.length };
    for (const row of data) {
      c[row.index_status] = (c[row.index_status] || 0) + 1;
    }
    return c;
  }, [data]);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] }),
  });
  const discover = useMutation({
    mutationFn: () => adminService.runDiscovery(true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] }),
  });
  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
  });
  const lock = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => adminService.lockSearchIntent(id, locked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] }),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Search Landing Pages</h2>
          <p className="text-sm text-gray-500 mt-1">
            Auto-discovered from inventory + optional seed bootstrap. Indexable pages must pass quality gates.
            Manual approve/noindex locks automation for that intent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => discover.mutate()}
            className="px-4 py-2 text-sm rounded-lg border"
          >
            {discover.isPending ? "Discovering…" : "Run discovery"}
          </button>
          <button
            type="button"
            onClick={() => rebuild.mutate()}
            className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white"
          >
            {rebuild.isPending ? "Running…" : "Rebuild research + automation"}
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

      {(rebuild.data || importCsv.data || discover.data) && (
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-48">
          {JSON.stringify(rebuild.data || importCsv.data || discover.data, null, 2)}
        </pre>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs rounded-full border ${
              tab === t.id ? "bg-navy-800 text-white border-navy-800" : "bg-white"
            }`}
          >
            {t.label}
            <span className="ml-1 opacity-70">
              ({t.id === "all" ? counts.all || 0 : t.id === "indexable" ? counts.indexable || 0 : counts[t.id] || 0})
            </span>
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load intents.</p>}

      <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-navy-900 text-left">
            <tr>
              <th className="p-3">Page</th>
              <th className="p-3">Matches</th>
              <th className="p-3">Obs</th>
              <th className="p-3">Opp</th>
              <th className="p-3">Quality</th>
              <th className="p-3">Fresh</th>
              <th className="p-3">Status</th>
              <th className="p-3">Source</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="p-3">
                  <Link href={row.path} className="text-gold-600 underline" target="_blank">
                    {row.path}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">{row.h1}</div>
                  {row.status_reason && (
                    <div className="text-[11px] text-gray-400 mt-1">{row.status_reason}</div>
                  )}
                  {(row.locked_by_admin || row.automation_disabled) && (
                    <div className="text-[11px] text-amber-700 mt-1">
                      {row.locked_by_admin ? "Admin locked" : ""}
                      {row.automation_disabled ? " · Automation off" : ""}
                    </div>
                  )}
                </td>
                <td className="p-3">{row.match_count}</td>
                <td className="p-3">{row.matching_observation_count ?? 0}</td>
                <td className="p-3">{row.opportunity_score ?? 0}</td>
                <td className="p-3">{row.quality_score}</td>
                <td className="p-3 text-xs uppercase">{row.data_freshness || "—"}</td>
                <td className="p-3">
                  <span className="uppercase text-xs tracking-wide">{row.index_status}</span>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {row.last_calculated_at
                      ? new Date(row.last_calculated_at).toLocaleDateString()
                      : row.last_built_at
                        ? new Date(row.last_built_at).toLocaleDateString()
                        : "—"}
                  </div>
                </td>
                <td className="p-3 text-xs">{row.source || "—"}</td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button type="button" className="text-xs underline" onClick={() => regenerate.mutate(row.id)}>
                    Refresh
                  </button>
                  <button type="button" className="text-xs underline" onClick={() => approve.mutate(row.id)}>
                    Approve
                  </button>
                  <button type="button" className="text-xs underline" onClick={() => noindex.mutate(row.id)}>
                    Noindex
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => lock.mutate({ id: row.id, locked: !row.locked_by_admin })}
                  >
                    {row.locked_by_admin ? "Unlock" : "Lock"}
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && !isLoading && (
              <tr>
                <td colSpan={9} className="p-6 text-gray-500">
                  No intents in this tab. Click <strong>Run discovery</strong> or{" "}
                  <strong>Rebuild research + automation</strong> (requires migration 025 on the API database).
                  Seed remains available: <code>python scripts/seed_search_intents.py</code> then discovery.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
