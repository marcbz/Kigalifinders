"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { SearchIntentAdmin, SearchIntentListResponse } from "@/types/market";

type SortMode =
  | "best"
  | "filters_desc"
  | "filters_asc"
  | "quality_desc"
  | "quality_asc"
  | "properties_desc"
  | "properties_asc";

type SeoControls = {
  min_dimensions_for_index: number;
  max_dimensions_for_index: number;
  min_quality_for_index: number;
  max_sitemap_urls: number;
  require_min_intent: boolean;
  min_intent_for_index: number;
  require_min_properties: boolean;
  min_verified_for_index: number;
};

type EligibilityFilter = "all" | "eligible" | "under";
type IndexFilter = "all" | "indexable" | "noindex";

type ObservationRow = {
  id: string;
  source: string;
  source_url?: string | null;
  neighborhood?: string | null;
  bedrooms?: number | null;
  property_type?: string | null;
  usd_price?: number | null;
  observation_status: string;
  observed_at?: string | null;
};

type SourceSummary = {
  source_id: string;
  name: string;
  observation_count: number;
  is_enabled?: boolean;
  is_archived?: boolean;
};

type MarketSummary = {
  total_observations: number;
  last_import_at?: string | null;
  top_sources: SourceSummary[];
  other_sources_count: number;
  sources: SourceSummary[];
};

function pageName(row: SearchIntentAdmin) {
  return row.h1 || row.title || row.path;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function friendlyStatus(s: string) {
  return s.replace(/_/g, " ");
}

function errMsg(err: unknown, fallback: string) {
  const ax = err as { response?: { data?: { detail?: string } }; message?: string };
  const detail = ax?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (ax?.message) return ax.message;
  return fallback;
}

function eligibilityLabel(row: SearchIntentAdmin) {
  if (row.automatic_eligibility === "eligible") return "Eligible";
  return "Not eligible";
}

function indexLabel(row: SearchIntentAdmin) {
  if (row.index_status === "indexable") return "Indexed";
  if (row.index_status === "noindex") return "Noindex";
  return row.index_status;
}

function sitemapLabel(row: SearchIntentAdmin) {
  if (row.sitemap_status === "included") return "Sitemap included";
  return "Sitemap excluded";
}

function intentStrengthLabel(row: SearchIntentAdmin) {
  const s = (row.intent_strength || "").toLowerCase();
  if (s === "strong") return "Strong";
  if (s === "useful") return "Useful";
  if (s === "weak") return "Weak";
  return "—";
}

export default function SeoMarketAdminPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("best");
  const [searchPage, setSearchPage] = useState(1);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seoForm, setSeoForm] = useState<SeoControls | null>(null);
  const [recalcLabel, setRecalcLabel] = useState<string | null>(null);

  const [obsPage, setObsPage] = useState(1);
  const [obsStatus, setObsStatus] = useState("");
  const [obsSource, setObsSource] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState<EligibilityFilter>("all");
  const [indexFilter, setIndexFilter] = useState<IndexFilter>("all");

  const sortParams = useMemo(() => {
    if (sort === "filters_desc") return { sort_by: "filter_count", sort_dir: "desc" as const };
    if (sort === "filters_asc") return { sort_by: "filter_count", sort_dir: "asc" as const };
    if (sort === "quality_desc") return { sort_by: "quality_score", sort_dir: "desc" as const };
    if (sort === "quality_asc") return { sort_by: "quality_score", sort_dir: "asc" as const };
    if (sort === "properties_desc") return { sort_by: "match_count", sort_dir: "desc" as const };
    if (sort === "properties_asc") return { sort_by: "match_count", sort_dir: "asc" as const };
    return { sort_by: "best", sort_dir: "desc" as const };
  }, [sort]);

  const searchQuery = useQuery({
    queryKey: ["admin-search-intents", search, sort, searchPage, eligibilityFilter, indexFilter],
    queryFn: () =>
      adminService.searchIntents({
        search: search || undefined,
        page: searchPage,
        page_size: 40,
        automatic_eligibility:
          eligibilityFilter === "eligible"
            ? "eligible"
            : eligibilityFilter === "under"
              ? "excluded"
              : undefined,
        index_status: indexFilter === "all" ? undefined : indexFilter,
        ...sortParams,
      }) as Promise<SearchIntentListResponse>,
  });

  const seoSettingsQuery = useQuery({
    queryKey: ["admin-seo-settings"],
    queryFn: () => adminService.getSeoSettings(),
  });

  useEffect(() => {
    if (seoSettingsQuery.data?.settings) {
      const s = seoSettingsQuery.data.settings;
      setSeoForm({
        min_dimensions_for_index: s.min_dimensions_for_index ?? 3,
        max_dimensions_for_index: s.max_dimensions_for_index ?? 5,
        min_quality_for_index: s.min_quality_for_index ?? 50,
        max_sitemap_urls: s.max_sitemap_urls ?? 100,
        require_min_intent: s.require_min_intent ?? false,
        min_intent_for_index: s.min_intent_for_index ?? 30,
        require_min_properties: s.require_min_properties ?? false,
        min_verified_for_index: s.min_verified_for_index ?? 1,
      });
    }
    const summary = seoSettingsQuery.data?.summary;
    if (summary?.recalc_label) setRecalcLabel(summary.recalc_label);
  }, [seoSettingsQuery.data]);

  const marketSummary = useQuery({
    queryKey: ["admin-market-summary"],
    queryFn: () => adminService.marketDataSummary() as Promise<MarketSummary>,
  });

  const observations = useQuery({
    queryKey: ["admin-observations", obsPage, obsStatus, obsSource],
    queryFn: () =>
      adminService.listObservations({
        page: obsPage,
        page_size: 15,
        status: obsStatus || undefined,
        source: obsSource || undefined,
      }) as Promise<{ items: ObservationRow[]; total: number; page_size: number }>,
  });

  const searchItems = searchQuery.data?.items ?? [];
  const searchTotalPages = Math.max(1, Math.ceil((searchQuery.data?.total ?? 0) / (searchQuery.data?.page_size ?? 40)));
  const obsItems = observations.data?.items ?? [];
  const obsTotalPages = Math.max(1, Math.ceil((observations.data?.total ?? 0) / (observations.data?.page_size ?? 15)));
  const summary = marketSummary.data;
  const pageVisibleIds = searchItems.map((r) => r.id);
  const maxSitemap = seoForm?.max_sitemap_urls ?? 100;

  const flash = (text: string) => {
    setErrorMsg(null);
    setMessage(text);
    setTimeout(() => setMessage(null), 5000);
  };
  const flashErr = (text: string) => {
    setMessage(null);
    setErrorMsg(text);
    setTimeout(() => setErrorMsg(null), 7000);
  };

  const invalidateSearch = () => {
    qc.invalidateQueries({ queryKey: ["admin-search-intents"] });
    qc.invalidateQueries({ queryKey: ["admin-seo-settings"] });
  };
  const invalidateMarket = () => {
    qc.invalidateQueries({ queryKey: ["admin-market-summary"] });
    qc.invalidateQueries({ queryKey: ["admin-observations"] });
  };

  const applySummary = (res?: { summary?: { recalc_label?: string }; recalculation?: unknown }) => {
    if (res?.summary?.recalc_label) setRecalcLabel(res.summary.recalc_label);
  };

  const publish = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "indexable"),
    onSuccess: () => {
      flash("Page set to indexable (manual override).");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to index page.")),
  });

  const noindex = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "noindex"),
    onSuccess: () => {
      flash("Page set to noindex; sitemap excluded.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to noindex page.")),
  });

  const includeSitemap = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentSitemap(id, "included"),
    onSuccess: () => {
      flash("Page included in sitemap (manual override).");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Could not include in sitemap — page must be indexable first.")),
  });

  const excludeSitemap = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentSitemap(id, "excluded"),
    onSuccess: () => {
      flash("Page excluded from sitemap.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to exclude from sitemap.")),
  });

  const bulkPages = useMutation({
    mutationFn: (action: string) => adminService.bulkSearchIntents(Array.from(selectedPages), action),
    onSuccess: (res: { updated?: number; errors?: string[] }) => {
      if (res.errors?.length) flashErr(res.errors[0]);
      else flash(`Updated ${res.updated ?? 0} page(s).`);
      setSelectedPages(new Set());
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Bulk action failed.")),
  });

  const saveSeo = useMutation({
    mutationFn: () =>
      adminService.updateSeoSettings({
        min_dimensions_for_index: seoForm!.min_dimensions_for_index,
        max_dimensions_for_index: seoForm!.max_dimensions_for_index,
        min_quality_for_index: seoForm!.min_quality_for_index,
        max_sitemap_urls: seoForm!.max_sitemap_urls,
        require_min_intent: seoForm!.require_min_intent,
        min_intent_for_index: seoForm!.min_intent_for_index,
        require_min_properties: seoForm!.require_min_properties,
        min_verified_for_index: seoForm!.min_verified_for_index,
      }),
    onSuccess: (res: { summary?: { recalc_label?: string } }) => {
      applySummary(res);
      flash(res?.summary?.recalc_label || "SEO controls saved and recalculated.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to save SEO controls.")),
  });

  const refreshSeo = useMutation({
    mutationFn: () => adminService.recalculateSeoLandings(),
    onSuccess: (res: { summary?: { recalc_label?: string } }) => {
      applySummary(res);
      flash(res?.summary?.recalc_label || "Recalculated.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Recalculate failed.")),
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
    onSuccess: (res: { import_reference?: string }) => {
      flash(
        res.import_reference
          ? `CSV imported (${res.import_reference}). Research refreshed.`
          : "CSV imported. Research refreshed."
      );
      invalidateMarket();
    },
    onError: (e) => flashErr(errMsg(e, "CSV import failed.")),
  });

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">SEO &amp; Market Data</h2>
        <p className="text-sm text-gray-500 mt-1">
          Control which rental search pages are eligible, indexed, and included in the sitemap (hard URL cap).
          Strong search intents are prioritized. Manual overrides are labeled.
        </p>
      </div>

      {message && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>
      )}
      {errorMsg && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{errorMsg}</p>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* LEFT */}
        <aside className="space-y-5 sticky top-4">
          <div
            id="seo-controls"
            className="rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50/80 dark:bg-navy-800/90 p-4 space-y-3"
          >
            <h3 className="font-semibold text-navy-800 dark:text-white">SEO controls</h3>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 border rounded-lg px-3 py-2 bg-white/70 dark:bg-navy-900/50">
              <p className="font-medium text-navy-800 dark:text-white">Search-intent rules</p>
              <p>
                <span className="font-medium">Strong:</span> neighborhood + bedrooms + type + budget, or + furnished
              </p>
              <p>
                <span className="font-medium">Useful:</span> any valid combination with 3–5 parameters
              </p>
              <p>
                <span className="font-medium">Weak:</span> fewer than 3, or more than 5 parameters
              </p>
            </div>
            {recalcLabel && (
              <p className="text-xs font-medium text-navy-800 dark:text-white border rounded-lg px-3 py-2 bg-gray-50 dark:bg-navy-900">
                {recalcLabel}
              </p>
            )}
            {seoForm && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSeo.mutate();
                }}
              >
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Minimum search filters</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                    value={seoForm.min_dimensions_for_index}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, min_dimensions_for_index: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Maximum search filters</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                    value={seoForm.max_dimensions_for_index}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, max_dimensions_for_index: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Minimum quality (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                    value={seoForm.min_quality_for_index}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, min_quality_for_index: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Maximum indexed / sitemap URLs</span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                    value={seoForm.max_sitemap_urls}
                    onChange={(e) => setSeoForm({ ...seoForm, max_sitemap_urls: Number(e.target.value) })}
                  />
                  <span className="text-[11px] text-gray-500">
                    Hard global cap. After Save &amp; Recalculate, only the top ranked eligible pages stay in the
                    sitemap.
                  </span>
                </label>

                <div className="border-t border-gray-200 dark:border-navy-700 pt-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={seoForm.require_min_intent}
                      onChange={(e) => setSeoForm({ ...seoForm, require_min_intent: e.target.checked })}
                    />
                    <span className="font-medium">Require minimum Intent (optional)</span>
                  </label>
                  {seoForm.require_min_intent && (
                    <input
                      type="number"
                      min={0}
                      max={200}
                      className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                      value={seoForm.min_intent_for_index}
                      onChange={(e) =>
                        setSeoForm({ ...seoForm, min_intent_for_index: Number(e.target.value) })
                      }
                    />
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-navy-700 pt-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={seoForm.require_min_properties}
                      onChange={(e) => setSeoForm({ ...seoForm, require_min_properties: e.target.checked })}
                    />
                    <span className="font-medium">Require minimum Properties (optional)</span>
                  </label>
                  {seoForm.require_min_properties && (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                      value={seoForm.min_verified_for_index}
                      onChange={(e) =>
                        setSeoForm({ ...seoForm, min_verified_for_index: Number(e.target.value) })
                      }
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-navy-800 text-white"
                  disabled={saveSeo.isPending}
                >
                  {saveSeo.isPending ? "Saving…" : "Save & Recalculate"}
                </button>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50/80 dark:bg-navy-800/90 p-4 space-y-3">
            <h3 className="font-semibold text-navy-800 dark:text-white">External market data</h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-gray-500">Observations</dt>
                <dd className="text-lg font-serif">{summary?.total_observations ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Last import</dt>
                <dd>{fmtDate(summary?.last_import_at)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-2 py-1.5 text-xs rounded-lg border"
                onClick={() =>
                  adminService.downloadObservationsCsvTemplate().then((blob: Blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "external-observations-template.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                }
              >
                Download CSV template
              </button>
              <label className="px-2 py-1.5 text-xs rounded-lg bg-navy-800 text-white cursor-pointer">
                {importCsv.isPending ? "Importing…" : "Import CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCsv.mutate(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {summary && (
              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {summary.top_sources.map((s) => (
                  <li key={s.source_id}>
                    <button
                      type="button"
                      className="underline text-left"
                      onClick={() => {
                        setObsSource(s.source_id);
                        setObsPage(1);
                      }}
                    >
                      {s.name}
                    </button>
                    {" — "}
                    {s.observation_count}
                  </li>
                ))}
                {summary.other_sources_count > 0 && (
                  <li className="text-gray-600">Other — {summary.other_sources_count}</li>
                )}
                {!summary.top_sources.length && !summary.other_sources_count && (
                  <li className="text-gray-500">No observations yet.</li>
                )}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <select
                className="border rounded px-1 py-1"
                value={obsSource}
                onChange={(e) => {
                  setObsSource(e.target.value);
                  setObsPage(1);
                }}
              >
                <option value="">All sources</option>
                {(summary?.sources || []).map((s) => (
                  <option key={s.source_id} value={s.source_id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="border rounded px-1 py-1"
                value={obsStatus}
                onChange={(e) => {
                  setObsStatus(e.target.value);
                  setObsPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="active_observed">Active</option>
                <option value="not_found">Not found</option>
                <option value="unknown">Unknown</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>
            <ul className="text-xs space-y-1 max-h-48 overflow-y-auto border-t pt-2">
              {obsItems.map((row) => (
                <li key={row.id} className="border-b pb-1">
                  <span className="font-medium">{row.source}</span>
                  {" · "}
                  {row.neighborhood || "—"}
                  {" · "}
                  {friendlyStatus(row.observation_status)}
                </li>
              ))}
              {!observations.isLoading && !obsItems.length && (
                <li className="text-gray-500">No observations match.</li>
              )}
            </ul>
            {obsTotalPages > 1 && (
              <div className="flex gap-2 text-xs items-center">
                <button
                  type="button"
                  className="border rounded px-2 py-0.5 disabled:opacity-40"
                  disabled={obsPage <= 1}
                  onClick={() => setObsPage((p) => p - 1)}
                >
                  Prev
                </button>
                <span>
                  {obsPage}/{obsTotalPages}
                </span>
                <button
                  type="button"
                  className="border rounded px-2 py-0.5 disabled:opacity-40"
                  disabled={obsPage >= obsTotalPages}
                  onClick={() => setObsPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT */}
        <section className="space-y-3 min-w-0 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Search pages</h3>
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-lg border"
              disabled={refreshSeo.isPending}
              onClick={() => refreshSeo.mutate()}
            >
              {refreshSeo.isPending ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchPage(1);
              }}
            />
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="best">Best first</option>
              <option value="properties_desc">Most properties</option>
              <option value="properties_asc">Fewest properties</option>
              <option value="quality_desc">Highest quality</option>
              <option value="quality_asc">Lowest quality</option>
              <option value="filters_desc">Most filters</option>
              <option value="filters_asc">Fewest filters</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-500">Eligibility</span>
              <select
                className="border rounded-lg px-2 py-1.5 text-sm"
                value={eligibilityFilter}
                onChange={(e) => {
                  setEligibilityFilter(e.target.value as EligibilityFilter);
                  setSearchPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="eligible">Eligible</option>
                <option value="under">Not eligible</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-500">Index</span>
              <select
                className="border rounded-lg px-2 py-1.5 text-sm"
                value={indexFilter}
                onChange={(e) => {
                  setIndexFilter(e.target.value as IndexFilter);
                  setSearchPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="indexable">Index</option>
                <option value="noindex">NoIndex</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" className="underline" onClick={() => setSelectedPages(new Set(pageVisibleIds))}>
              Select visible
            </button>
            <button type="button" className="underline" onClick={() => setSelectedPages(new Set())}>
              Unselect all
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                if (!selectedPages.size || !window.confirm(`Index ${selectedPages.size} page(s)?`)) return;
                bulkPages.mutate("set_indexable");
              }}
            >
              Publish/Index selected
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                if (!selectedPages.size || !window.confirm(`Noindex ${selectedPages.size} page(s)?`)) return;
                bulkPages.mutate("set_noindex");
              }}
            >
              Noindex selected
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                if (
                  !selectedPages.size ||
                  !window.confirm(`Include ${selectedPages.size} page(s) in sitemap? Must be indexable.`)
                )
                  return;
                bulkPages.mutate("sitemap_include");
              }}
            >
              Include in sitemap
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                if (!selectedPages.size || !window.confirm(`Exclude ${selectedPages.size} page(s) from sitemap?`))
                  return;
                bulkPages.mutate("sitemap_exclude");
              }}
            >
              Exclude from sitemap
            </button>
          </div>

          <div className="border rounded-xl bg-white dark:bg-navy-800 overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-gray-50 dark:bg-navy-900 text-left">
                <tr>
                  <th className="p-3 w-8" />
                  <th className="p-3">Page</th>
                  <th className="p-3">Filters</th>
                  <th className="p-3">Intent</th>
                  <th className="p-3">Properties</th>
                  <th className="p-3">Quality</th>
                  <th className="p-3">Eligibility</th>
                  <th className="p-3">Index</th>
                  <th className="p-3">Sitemap</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {searchQuery.isLoading && (
                  <tr>
                    <td colSpan={10} className="p-6 text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {searchItems.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedPages.has(row.id)}
                        onChange={() => {
                          setSelectedPages((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-3 font-medium max-w-[200px]">
                      <Link href={row.path} target="_blank" rel="noreferrer" className="text-gold-600 hover:underline">
                        {pageName(row)}
                      </Link>
                      <p className="text-[11px] text-gray-500 mt-0.5 break-all">{row.path}</p>
                      {(row.seo_control === "manual" || row.locked_by_admin) && (
                        <span className="text-[11px] text-amber-700 font-medium">Manual override</span>
                      )}
                    </td>
                    <td className="p-3 text-xs max-w-[200px]">
                      <span className="font-medium">{row.filter_count ?? "—"}</span>
                      <p className="mt-0.5 leading-snug text-gray-600">{row.filters_label || "—"}</p>
                    </td>
                    <td className="p-3 text-xs">
                      <span className="font-medium">{intentStrengthLabel(row)}</span>
                      <p className="text-gray-500">{row.intent_score != null ? Math.round(row.intent_score) : "—"}</p>
                    </td>
                    <td className="p-3">{row.match_count}</td>
                    <td className="p-3">{Math.round(row.quality_score)}%</td>
                    <td className="p-3 text-xs">{eligibilityLabel(row)}</td>
                    <td className="p-3 text-xs">{indexLabel(row)}</td>
                    <td className="p-3 text-xs">{sitemapLabel(row)}</td>
                    <td className="p-3 space-x-2 whitespace-nowrap text-xs">
                      {row.index_status !== "indexable" && (
                        <button type="button" className="underline" onClick={() => publish.mutate(row.id)}>
                          Index
                        </button>
                      )}
                      {row.index_status === "indexable" && (
                        <button type="button" className="underline" onClick={() => noindex.mutate(row.id)}>
                          Noindex
                        </button>
                      )}
                      {row.index_status === "indexable" && row.sitemap_status !== "included" && (
                        <button type="button" className="underline" onClick={() => includeSitemap.mutate(row.id)}>
                          Include
                        </button>
                      )}
                      {row.index_status === "indexable" && row.sitemap_status === "included" && (
                        <button type="button" className="underline" onClick={() => excludeSitemap.mutate(row.id)}>
                          Exclude
                        </button>
                      )}
                      <Link href={row.path} target="_blank" rel="noreferrer" className="underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {!searchQuery.isLoading && !searchItems.length && (
                  <tr>
                    <td colSpan={10} className="p-6 text-gray-500">
                      No pages match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {searchTotalPages > 1 && (
            <div className="flex gap-2 text-sm items-center">
              <button
                type="button"
                className="border rounded px-3 py-1 disabled:opacity-40"
                disabled={searchPage <= 1}
                onClick={() => setSearchPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {searchPage} of {searchTotalPages}
              </span>
              <button
                type="button"
                className="border rounded px-3 py-1 disabled:opacity-40"
                disabled={searchPage >= searchTotalPages}
                onClick={() => setSearchPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Sitemap cap: {maxSitemap} search URLs. After Index/Include, DB{" "}
            <code className="text-[10px]">sitemap_status</code> drives{" "}
            <Link href="/sitemap-rentals.xml" target="_blank" className="underline">
              /sitemap-rentals.xml
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
