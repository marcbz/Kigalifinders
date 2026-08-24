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
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    for (const row of data) c[row.index_status] = (c[row.index_status] || 0) + 1;
    return c;
  }, [data]);

  const visibleIds = filtered.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectVisible = () => setSelected(new Set(visibleIds));
  const selectAll = () => setSelected(new Set(data.map((r) => r.id)));
  const unselectAll = () => setSelected(new Set());

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] });
  const regenerate = useMutation({
    mutationFn: (id: string) => adminService.regenerateSearchIntent(id),
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: (id: string) => adminService.approveSearchIntent(id),
    onSuccess: invalidate,
  });
  const noindex = useMutation({
    mutationFn: (id: string) => adminService.noindexSearchIntent(id),
    onSuccess: invalidate,
  });
  const rebuild = useMutation({
    mutationFn: () => adminService.rebuildResearch(),
    onSuccess: invalidate,
  });
  const discover = useMutation({
    mutationFn: () => adminService.runDiscovery(true),
    onSuccess: invalidate,
  });
  const bulk = useMutation({
    mutationFn: (action: string) => adminService.bulkSearchIntents(Array.from(selected), action),
    onSuccess: () => {
      unselectAll();
      invalidate();
    },
  });
  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
  });
  const lock = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) => adminService.lockSearchIntent(id, locked),
    onSuccess: invalidate,
  });

  const runBulk = (action: string, destructive = false) => {
    if (!selected.size && action !== "rebuild_research") return;
    if (destructive && !window.confirm(`Apply “${action}” to ${selected.size} selected intent(s)?`)) return;
    bulk.mutate(action);
  };

  const seoSummary = useQuery({
    queryKey: ["admin-seo-summary"],
    queryFn: () => adminService.getSeoSummary(),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Search Landing Pages</h2>
          <p className="text-sm text-gray-500 mt-1">
            Auto-discovered from inventory + external observations. Manual overrides lock automation.{" "}
            <Link href="/admin/seo-settings" className="underline">
              SEO settings
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => discover.mutate()} className="px-4 py-2 text-sm rounded-lg border">
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

      {seoSummary.data && (
        <div className="text-sm border rounded-xl p-4 bg-white dark:bg-navy-800 flex flex-wrap gap-6">
          <div>
            <span className="text-gray-500">Eligible SEO landings</span>
            <div className="text-xl font-serif">{seoSummary.data.eligible_landing_pages}</div>
          </div>
          <div>
            <span className="text-gray-500">Excluded</span>
            <div className="text-xl font-serif">{seoSummary.data.excluded_pages}</div>
          </div>
          <div className="text-xs text-gray-500 max-w-md">
            Thresholds: ≥{seoSummary.data.thresholds?.min_dimensions_for_index} dimensions, ≥
            {seoSummary.data.thresholds?.min_verified_for_index} matching properties.{" "}
            <Link href="/admin/seo-settings" className="underline">
              Adjust SEO settings
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-gray-500">{selected.size} selected</span>
        <button type="button" className="underline" onClick={selectVisible}>
          Select visible
        </button>
        <button type="button" className="underline" onClick={selectAll}>
          Select all
        </button>
        <button type="button" className="underline" onClick={unselectAll}>
          Unselect all
        </button>
        <span className="mx-2 text-gray-300">|</span>
        <button type="button" className="underline" onClick={() => runBulk("approve", true)}>
          Approve
        </button>
        <button type="button" className="underline" onClick={() => runBulk("indexable", true)}>
          Indexable
        </button>
        <button type="button" className="underline" onClick={() => runBulk("noindex", true)}>
          Noindex
        </button>
        <button type="button" className="underline" onClick={() => runBulk("refresh")}>
          Refresh
        </button>
        <button type="button" className="underline" onClick={() => runBulk("enable")}>
          Enable
        </button>
        <button type="button" className="underline" onClick={() => runBulk("disable", true)}>
          Disable
        </button>
        <button type="button" className="underline" onClick={() => runBulk("rebuild_research", true)}>
          Rebuild research
        </button>
      </div>

      {(rebuild.data || importCsv.data || discover.data || bulk.data) && (
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
          {JSON.stringify(rebuild.data || importCsv.data || discover.data || bulk.data, null, 2)}
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
            {t.label} (
            {t.id === "all" ? counts.all || 0 : t.id === "indexable" ? counts.indexable || 0 : counts[t.id] || 0})
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load intents.</p>}

      <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-navy-900 text-left">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => (allVisibleSelected ? unselectAll() : selectVisible())}
                  aria-label="Select visible"
                />
              </th>
              <th className="p-3">Page</th>
              <th className="p-3">Matches</th>
              <th className="p-3">Obs</th>
              <th className="p-3">Opp</th>
              <th className="p-3">Quality</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.path}`}
                  />
                </td>
                <td className="p-3">
                  <Link href={row.path} className="text-gold-600 underline" target="_blank">
                    {row.path}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">{row.h1}</div>
                  {row.status_reason && <div className="text-[11px] text-gray-400 mt-1">{row.status_reason}</div>}
                </td>
                <td className="p-3">{row.match_count}</td>
                <td className="p-3">{row.matching_observation_count ?? 0}</td>
                <td className="p-3">{row.opportunity_score ?? 0}</td>
                <td className="p-3">{row.quality_score}</td>
                <td className="p-3 text-xs uppercase">{row.index_status}</td>
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
                <td colSpan={8} className="p-6 text-gray-500">
                  No intents in this tab. Run discovery or rebuild research + automation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
