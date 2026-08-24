"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { EligibilityDetails, SearchIntentAdmin, SearchIntentListResponse } from "@/types/market";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "indexable", label: "Indexable" },
  { value: "noindex", label: "Noindex" },
  { value: "draft", label: "Draft" },
  { value: "discovered", label: "Discovered" },
  { value: "disabled", label: "Disabled" },
];

const SORT_COLUMNS = [
  { value: "match_count", label: "Matches" },
  { value: "matching_observation_count", label: "Observations" },
  { value: "opportunity_score", label: "Opportunity" },
  { value: "quality_score", label: "Quality" },
  { value: "updated_at", label: "Updated" },
  { value: "last_evaluated_at", label: "Last evaluated" },
];

type Filters = {
  search: string;
  location: string;
  property_type: string;
  index_status: string;
  sort_by: string;
  sort_dir: "asc" | "desc";
  page: number;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  location: "",
  property_type: "",
  index_status: "",
  sort_by: "updated_at",
  sort_dir: "desc",
  page: 1,
};

function formatIntent(row: SearchIntentAdmin) {
  const q = row.query || {};
  const parts = [row.location_slug !== "kigali" ? row.location_slug : "Kigali"];
  if (q.property_type) parts.push(String(q.property_type));
  if (q.bedrooms != null) parts.push(`${q.bedrooms}+ bed`);
  if (q.furnished === true) parts.push("furnished");
  return parts.join(" · ");
}

export default function AdminSearchLandingsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [eligibilityId, setEligibilityId] = useState<string | null>(null);

  const queryParams = useMemo(
    () => ({
      search: filters.search || undefined,
      location: filters.location || undefined,
      property_type: filters.property_type || undefined,
      index_status: filters.index_status || undefined,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
      page: filters.page,
      page_size: 50,
    }),
    [filters]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-search-intents", queryParams],
    queryFn: () => adminService.searchIntents(queryParams) as Promise<SearchIntentListResponse>,
  });

  const locations = useQuery({
    queryKey: ["admin-search-intent-locations"],
    queryFn: () => adminService.searchIntentLocations() as Promise<string[]>,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const eligibility = useQuery({
    queryKey: ["admin-intent-eligibility", eligibilityId],
    queryFn: () => adminService.getSearchIntentEligibility(eligibilityId!) as Promise<EligibilityDetails>,
    enabled: Boolean(eligibilityId),
  });

  const seoSummary = useQuery({
    queryKey: ["admin-seo-summary"],
    queryFn: () => adminService.getSeoSummary(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-search-intents"] });
    qc.invalidateQueries({ queryKey: ["admin-seo-summary"] });
  };

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const actionMutation = useMutation({
    mutationFn: async (args: { fn: () => Promise<unknown>; success: string }) => {
      await args.fn();
      return args.success;
    },
    onSuccess: (msg) => {
      showFeedback("success", msg);
      invalidate();
    },
    onError: (err: Error) => showFeedback("error", err.message || "Action failed"),
  });

  const bulk = useMutation({
    mutationFn: (action: string) => adminService.bulkSearchIntents(Array.from(selected), action),
    onSuccess: (res: { updated?: number; errors?: string[]; ok?: boolean }) => {
      if (res.errors?.length) {
        showFeedback("error", res.errors.join("; "));
      } else {
        showFeedback("success", `Updated ${res.updated ?? 0} landing page(s).`);
      }
      setSelected(new Set());
      invalidate();
    },
    onError: (err: Error) => showFeedback("error", err.message || "Bulk action failed"),
  });

  const rebuild = useMutation({
    mutationFn: () => adminService.rebuildResearch(),
    onSuccess: () => {
      showFeedback("success", "Research rebuild started.");
      invalidate();
    },
  });

  const discover = useMutation({
    mutationFn: () => adminService.runDiscovery(true),
    onSuccess: () => {
      showFeedback("success", "Discovery complete.");
      invalidate();
    },
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
  });

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

  const runBulk = (action: string, destructive = false) => {
    if (!selected.size && action !== "rebuild_research") return;
    if (destructive && !window.confirm(`Apply “${action}” to ${selected.size} selected page(s)?`)) return;
    bulk.mutate(action);
  };

  const toggleSort = (col: string) => {
    setFilters((f) => ({
      ...f,
      page: 1,
      sort_by: col,
      sort_dir: f.sort_by === col && f.sort_dir === "desc" ? "asc" : "desc",
    }));
  };

  const sortIndicator = (col: string) => {
    if (filters.sort_by !== col) return "";
    return filters.sort_dir === "desc" ? " ↓" : " ↑";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Search Landing Pages</h2>
          <p className="text-sm text-gray-500 mt-1">
            Index status and sitemap inclusion are stored in the database and drive public robots metadata.{" "}
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
            {rebuild.isPending ? "Running…" : "Rebuild research"}
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

      {feedback && (
        <div
          className={`text-sm rounded-lg px-4 py-3 ${
            feedback.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {seoSummary.data && (
        <div className="text-sm border rounded-xl p-4 bg-white dark:bg-navy-800 flex flex-wrap gap-6">
          <div>
            <span className="text-gray-500">Indexable</span>
            <div className="text-xl font-serif">{seoSummary.data.indexable ?? seoSummary.data.eligible_landing_pages}</div>
          </div>
          <div>
            <span className="text-gray-500">Noindex</span>
            <div className="text-xl font-serif">{seoSummary.data.noindex ?? 0}</div>
          </div>
          <div>
            <span className="text-gray-500">Sitemap included</span>
            <div className="text-xl font-serif">{seoSummary.data.sitemap_included ?? 0}</div>
          </div>
          <div>
            <span className="text-gray-500">Manual overrides</span>
            <div className="text-xl font-serif">{seoSummary.data.manual_overrides ?? 0}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end border rounded-xl p-4 bg-white dark:bg-navy-800">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Search</label>
          <input
            className="border rounded px-2 py-1 text-sm w-48"
            placeholder="URL, title, slug…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Area</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value, page: 1 }))}
          >
            <option value="">All areas</option>
            {(locations.data || []).map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Property type</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.property_type}
            onChange={(e) => setFilters((f) => ({ ...f, property_type: e.target.value, page: 1 }))}
          >
            <option value="">All types</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="villa">Villa</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.index_status}
            onChange={(e) => setFilters((f) => ({ ...f, index_status: e.target.value, page: 1 }))}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Sort</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.sort_by}
            onChange={(e) => setFilters((f) => ({ ...f, sort_by: e.target.value, page: 1 }))}
          >
            {SORT_COLUMNS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Direction</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.sort_dir}
            onChange={(e) => setFilters((f) => ({ ...f, sort_dir: e.target.value as "asc" | "desc", page: 1 }))}
          >
            <option value="desc">Highest → Lowest</option>
            <option value="asc">Lowest → Highest</option>
          </select>
        </div>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setSelected(new Set());
          }}
        >
          Reset filters
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="text-gray-500">{selected.size} selected · {total} total</span>
        <button type="button" className="underline" onClick={() => setSelected(new Set(visibleIds))}>
          Select visible
        </button>
        <button type="button" className="underline" onClick={() => setSelected(new Set(items.map((r) => r.id)))}>
          Select all on page
        </button>
        <button type="button" className="underline" onClick={() => setSelected(new Set())}>
          Unselect all
        </button>
        <span className="mx-2 text-gray-300">|</span>
        <button type="button" className="underline" onClick={() => runBulk("set_indexable", true)}>
          Set indexable
        </button>
        <button type="button" className="underline" onClick={() => runBulk("set_noindex", true)}>
          Set noindex
        </button>
        <button type="button" className="underline" onClick={() => runBulk("sitemap_include", true)}>
          Include in sitemap
        </button>
        <button type="button" className="underline" onClick={() => runBulk("sitemap_exclude", true)}>
          Exclude from sitemap
        </button>
        <button type="button" className="underline" onClick={() => runBulk("reset_automatic", true)}>
          Reset to automatic
        </button>
        <button type="button" className="underline" onClick={() => runBulk("rebuild_research", true)}>
          Rebuild research
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load landing pages.</p>}

      <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-navy-900 text-left">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => (allVisibleSelected ? setSelected(new Set()) : setSelected(new Set(visibleIds)))}
                  aria-label="Select visible"
                />
              </th>
              <th className="p-3">Page / intent</th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort("match_count")}>
                Matches{sortIndicator("match_count")}
              </th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort("matching_observation_count")}>
                Obs{sortIndicator("matching_observation_count")}
              </th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort("opportunity_score")}>
                Opp{sortIndicator("opportunity_score")}
              </th>
              <th className="p-3 cursor-pointer" onClick={() => toggleSort("quality_score")}>
                Quality{sortIndicator("quality_score")}
              </th>
              <th className="p-3">Index</th>
              <th className="p-3">Sitemap</th>
              <th className="p-3">Auto</th>
              <th className="p-3">Override</th>
              <th className="p-3">Evaluated</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.path}`}
                  />
                </td>
                <td className="p-3 min-w-[200px]">
                  <Link href={row.path} className="text-gold-600 underline" target="_blank">
                    {row.path}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">{formatIntent(row)}</div>
                  <div className="text-xs text-gray-400">{row.h1}</div>
                  {row.status_reason && <div className="text-[11px] text-gray-400 mt-1">{row.status_reason}</div>}
                </td>
                <td className="p-3">{row.match_count}</td>
                <td className="p-3">{row.matching_observation_count ?? 0}</td>
                <td className="p-3">{row.opportunity_score ?? 0}</td>
                <td className="p-3">{row.quality_score}</td>
                <td className="p-3 text-xs uppercase">{row.index_status}</td>
                <td className="p-3 text-xs uppercase">{row.sitemap_status ?? "excluded"}</td>
                <td className="p-3 text-xs uppercase">{row.automatic_eligibility ?? "—"}</td>
                <td className="p-3 text-xs uppercase">{row.seo_control ?? "automatic"}</td>
                <td className="p-3 text-xs whitespace-nowrap">
                  {row.last_evaluated_at ? new Date(row.last_evaluated_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3 space-y-1 whitespace-nowrap text-xs">
                  <div className="space-x-2">
                    <button
                      type="button"
                      className="underline"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          fn: () => adminService.setSearchIntentIndex(row.id, "indexable"),
                          success: `${row.path} set to indexable.`,
                        })
                      }
                    >
                      Indexable
                    </button>
                    <button
                      type="button"
                      className="underline"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          fn: () => adminService.setSearchIntentIndex(row.id, "noindex"),
                          success: `${row.path} set to noindex.`,
                        })
                      }
                    >
                      Noindex
                    </button>
                  </div>
                  <div className="space-x-2">
                    <button
                      type="button"
                      className="underline"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          fn: () => adminService.setSearchIntentSitemap(row.id, "included"),
                          success: `${row.path} included in sitemap.`,
                        })
                      }
                    >
                      + Sitemap
                    </button>
                    <button
                      type="button"
                      className="underline"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          fn: () => adminService.setSearchIntentSitemap(row.id, "excluded"),
                          success: `${row.path} excluded from sitemap.`,
                        })
                      }
                    >
                      − Sitemap
                    </button>
                  </div>
                  <div className="space-x-2">
                    <button
                      type="button"
                      className="underline"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          fn: () => adminService.regenerateSearchIntent(row.id),
                          success: `${row.path} metrics refreshed.`,
                        })
                      }
                    >
                      Refresh
                    </button>
                    <button type="button" className="underline" onClick={() => setEligibilityId(row.id)}>
                      Why?
                    </button>
                    <button
                      type="button"
                      className="underline"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          fn: () => adminService.resetSearchIntentAutomatic(row.id),
                          success: `${row.path} reset to automatic.`,
                        })
                      }
                    >
                      Reset auto
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !isLoading && (
              <tr>
                <td colSpan={12} className="p-6 text-gray-500">
                  No landing pages match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 items-center text-sm">
          <button
            type="button"
            className="px-3 py-1 border rounded disabled:opacity-40"
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
          >
            Previous
          </button>
          <span>
            Page {filters.page} of {totalPages}
          </span>
          <button
            type="button"
            className="px-3 py-1 border rounded disabled:opacity-40"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}

      {eligibilityId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEligibilityId(null)}>
          <div
            className="bg-white dark:bg-navy-800 rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4">
              <h3 className="text-lg font-semibold">Eligibility details</h3>
              <button type="button" className="text-sm underline" onClick={() => setEligibilityId(null)}>
                Close
              </button>
            </div>
            {eligibility.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {eligibility.data && (
              <>
                <p className={`text-sm font-medium ${eligibility.data.eligible ? "text-green-700" : "text-amber-700"}`}>
                  {eligibility.data.summary}
                </p>
                <ul className="text-sm space-y-2">
                  {eligibility.data.checks.map((c) => (
                    <li key={c.label} className="flex gap-2">
                      <span>{c.passed ? "✓" : "✗"}</span>
                      <span>
                        {c.label}: {c.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="text-xs grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <dt className="text-gray-500">Index</dt>
                    <dd className="uppercase">{eligibility.data.index_status}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Sitemap</dt>
                    <dd className="uppercase">{eligibility.data.sitemap_status}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">SEO control</dt>
                    <dd className="uppercase">{eligibility.data.seo_control}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Automatic</dt>
                    <dd className="uppercase">{eligibility.data.automatic_eligibility}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
