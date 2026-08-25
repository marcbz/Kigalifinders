"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { SearchIntentAdmin, SearchIntentListResponse } from "@/types/market";

const PAGE_SIZE = 15;

type SortMode =
  | "eligible"
  | "best"
  | "properties_desc"
  | "properties_asc"
  | "quality_desc"
  | "quality_asc"
  | "intent_desc"
  | "intent_asc";

type SeoControls = {
  min_dimensions_for_index: number;
  max_dimensions_for_index: number;
  min_quality_for_index: number;
  min_verified_for_index: number;
  max_sitemap_urls: number;
  min_intent_strength: "weak" | "useful" | "strong";
};

type StatusFilter = "all" | "eligible" | "under" | "indexable" | "noindex";
type IntentFilter = "all" | "strong" | "useful" | "weak";

type ObservationRow = {
  id: string;
  source: string;
  neighborhood?: string | null;
  observation_status: string;
  usd_price?: number | null;
};

type SourceSummary = {
  source_id: string;
  name: string;
  observation_count: number;
};

type MarketSummary = {
  total_observations: number;
  last_import_at?: string | null;
  top_sources: SourceSummary[];
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

function errMsg(err: unknown, fallback: string) {
  const ax = err as { response?: { data?: { detail?: string } }; message?: string };
  const detail = ax?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (ax?.message) return ax.message;
  return fallback;
}

function intentStrengthLabel(row: SearchIntentAdmin) {
  const s = (row.intent_strength || "").toLowerCase();
  if (s === "strong") return "Strong";
  if (s === "useful") return "Useful";
  if (s === "weak") return "Weak";
  return "—";
}

function statusLines(row: SearchIntentAdmin) {
  const lines: string[] = [];
  lines.push(row.automatic_eligibility === "eligible" ? "Eligible" : "Under eligibility");
  if (row.index_status === "indexable") lines.push("Index");
  else if (row.index_status === "noindex") lines.push("Noindex");
  else lines.push(row.index_status);
  lines.push(row.sitemap_status === "included" ? "Sitemap included" : "Sitemap excluded");
  return lines;
}

export default function SeoMarketAdminPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("eligible");
  const [searchPage, setSearchPage] = useState(1);
  const [pageJump, setPageJump] = useState("1");
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [seoForm, setSeoForm] = useState<SeoControls | null>(null);
  const [recalcLabel, setRecalcLabel] = useState<string | null>(null);

  const [obsPage, setObsPage] = useState(1);
  const [obsStatus, setObsStatus] = useState("");
  const [obsSource, setObsSource] = useState("");

  const sortParams = useMemo(() => {
    if (sort === "eligible") return { sort_by: "eligible", sort_dir: "desc" as const };
    if (sort === "properties_desc") return { sort_by: "match_count", sort_dir: "desc" as const };
    if (sort === "properties_asc") return { sort_by: "match_count", sort_dir: "asc" as const };
    if (sort === "quality_desc") return { sort_by: "quality_score", sort_dir: "desc" as const };
    if (sort === "quality_asc") return { sort_by: "quality_score", sort_dir: "asc" as const };
    if (sort === "intent_desc") return { sort_by: "intent_strength", sort_dir: "desc" as const };
    if (sort === "intent_asc") return { sort_by: "intent_strength", sort_dir: "asc" as const };
    return { sort_by: "best", sort_dir: "desc" as const };
  }, [sort]);

  const searchQuery = useQuery({
    queryKey: ["admin-search-intents", search, sort, searchPage, statusFilter, intentFilter],
    queryFn: () =>
      adminService.searchIntents({
        search: search || undefined,
        page: searchPage,
        page_size: PAGE_SIZE,
        automatic_eligibility:
          statusFilter === "eligible" ? "eligible" : statusFilter === "under" ? "excluded" : undefined,
        index_status:
          statusFilter === "indexable" || statusFilter === "noindex" ? statusFilter : undefined,
        intent_strength: intentFilter === "all" ? undefined : intentFilter,
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
      const strength = String(s.min_intent_strength || "useful").toLowerCase();
      setSeoForm({
        min_dimensions_for_index: s.min_dimensions_for_index ?? 3,
        max_dimensions_for_index: s.max_dimensions_for_index ?? 5,
        min_quality_for_index: s.min_quality_for_index ?? 50,
        min_verified_for_index: s.min_verified_for_index ?? 1,
        max_sitemap_urls: s.max_sitemap_urls ?? 100,
        min_intent_strength:
          strength === "strong" || strength === "weak" || strength === "useful" ? strength : "useful",
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
  const searchTotalPages = Math.max(
    1,
    Math.ceil((searchQuery.data?.total ?? 0) / (searchQuery.data?.page_size ?? PAGE_SIZE))
  );
  const pageVisibleIds = searchItems.map((r) => r.id);
  const obsItems = observations.data?.items ?? [];
  const obsTotalPages = Math.max(1, Math.ceil((observations.data?.total ?? 0) / (observations.data?.page_size ?? 15)));
  const summary = marketSummary.data;

  useEffect(() => {
    setPageJump(String(searchPage));
  }, [searchPage]);

  useEffect(() => {
    setSelectedPages(new Set());
  }, [search, sort, searchPage, statusFilter, intentFilter]);

  const goToSearchPage = (raw: string | number) => {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n)) return;
    const next = Math.min(searchTotalPages, Math.max(1, Math.floor(n)));
    setSearchPage(next);
    setPageJump(String(next));
  };

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

  const applySummary = (res?: { summary?: { recalc_label?: string } }) => {
    if (res?.summary?.recalc_label) setRecalcLabel(res.summary.recalc_label);
  };

  const publish = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "indexable"),
    onSuccess: () => {
      flash("Page set to Index and requested for sitemap (cap still applies).");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to index page.")),
  });

  const noindex = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "noindex"),
    onSuccess: () => {
      flash("Page set to Noindex and removed from sitemap.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to noindex page.")),
  });

  const includeSitemap = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentSitemap(id, "included"),
    onSuccess: () => {
      flash("Included in sitemap (manual). Cap still applies.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Could not include in sitemap — must be Index first.")),
  });

  const excludeSitemap = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentSitemap(id, "excluded"),
    onSuccess: () => {
      flash("Excluded from sitemap.");
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
        min_verified_for_index: seoForm!.min_verified_for_index,
        max_sitemap_urls: seoForm!.max_sitemap_urls,
        min_intent_strength: seoForm!.min_intent_strength,
        require_min_properties: true,
        require_min_intent: seoForm!.min_intent_strength !== "weak",
      }),
    onSuccess: (res: { summary?: { recalc_label?: string } }) => {
      applySummary(res);
      flash(res?.summary?.recalc_label || "SEO controls saved and recalculated.");
      invalidateSearch();
    },
    onError: (e) => flashErr(errMsg(e, "Failed to save SEO controls.")),
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
    <div className="space-y-4 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">SEO &amp; Market Data</h2>
        <p className="text-sm text-gray-500 mt-1">
          Three tools, one eligibility system. Save &amp; Recalculate updates Search Pages and the sitemap.
        </p>
      </div>

      {message && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</p>
      )}
      {errorMsg && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        <aside className="space-y-4">
          {/* 1. SEO Controls */}
          <section className="rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50/90 dark:bg-navy-800/90 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-navy-800 dark:text-white">SEO Controls</h3>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-0.5 leading-snug">
              <p>
                <span className="font-medium">Strong:</span> neighborhood + bedrooms + type + budget / furnished
              </p>
              <p>
                <span className="font-medium">Useful:</span> any valid 3–5 parameters
              </p>
              <p>
                <span className="font-medium">Weak:</span> fewer than 3 or more than 5
              </p>
            </div>
            {recalcLabel && (
              <p className="text-xs font-medium border rounded-md px-2.5 py-1.5 bg-white dark:bg-navy-900 text-navy-800 dark:text-white">
                {recalcLabel}
              </p>
            )}
            {seoForm && (
              <form
                className="space-y-2.5"
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
                  <span className="text-xs font-medium">Minimum Properties Listing Number</span>
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
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Require minimum Intent</span>
                  <select
                    className="border rounded px-2 py-1.5 w-full text-sm bg-white dark:bg-navy-900"
                    value={seoForm.min_intent_strength}
                    onChange={(e) =>
                      setSeoForm({
                        ...seoForm,
                        min_intent_strength: e.target.value as SeoControls["min_intent_strength"],
                      })
                    }
                  >
                    <option value="strong">Strong</option>
                    <option value="useful">Useful</option>
                    <option value="weak">Weak</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-navy-800 text-white"
                  disabled={saveSeo.isPending}
                >
                  {saveSeo.isPending ? "Saving…" : "Save & Recalculate"}
                </button>
              </form>
            )}
          </section>

          {/* 3. External Market Data */}
          <section className="rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50/90 dark:bg-navy-800/90 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-navy-800 dark:text-white">External Market Data</h3>
            <p className="text-[11px] text-gray-500">
              {summary?.total_observations ?? "—"} observations · Last import {fmtDate(summary?.last_import_at)}
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="px-2.5 py-1.5 text-xs rounded-md bg-navy-800 text-white cursor-pointer">
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
              <button
                type="button"
                className="px-2.5 py-1.5 text-xs rounded-md border"
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
                Download template
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <select
                className="border rounded px-1.5 py-1 bg-white dark:bg-navy-900"
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
                className="border rounded px-1.5 py-1 bg-white dark:bg-navy-900"
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
            <ul className="text-xs space-y-1 max-h-44 overflow-y-auto border-t pt-2">
              {obsItems.map((row) => (
                <li key={row.id} className="border-b border-gray-100 dark:border-navy-700 pb-1">
                  <span className="font-medium">{row.source}</span>
                  {" · "}
                  {row.neighborhood || "—"}
                  {" · "}
                  {row.observation_status.replace(/_/g, " ")}
                </li>
              ))}
              {!observations.isLoading && !obsItems.length && (
                <li className="text-gray-500">No observations match.</li>
              )}
            </ul>
            <div className="flex gap-2 text-xs items-center">
              <button
                type="button"
                className="border rounded px-2 py-0.5 disabled:opacity-40"
                disabled={obsPage <= 1}
                onClick={() => setObsPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {obsPage}
                {obsTotalPages > 1 ? ` / ${obsTotalPages}` : ""}
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
          </section>
        </aside>

        {/* 2. Search Pages */}
        <section className="rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-4 space-y-3 min-w-0">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-white">Search Pages</h3>

          <div className="flex flex-wrap gap-2 items-center text-sm">
            <input
              className="border rounded-md px-2.5 py-1.5 text-sm flex-1 min-w-[140px]"
              placeholder="Search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchPage(1);
              }}
            />
            <select
              className="border rounded-md px-2 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setSearchPage(1);
              }}
            >
              <option value="all">All</option>
              <option value="eligible">Eligible</option>
              <option value="under">Under eligibility</option>
              <option value="indexable">Index</option>
              <option value="noindex">Noindex</option>
            </select>
            <select
              className="border rounded-md px-2 py-1.5 text-sm"
              value={intentFilter}
              onChange={(e) => {
                setIntentFilter(e.target.value as IntentFilter);
                setSearchPage(1);
              }}
            >
              <option value="all">Intent: All</option>
              <option value="strong">Intent: Strong</option>
              <option value="useful">Intent: Useful</option>
              <option value="weak">Intent: Weak</option>
            </select>
            <select
              className="border rounded-md px-2 py-1.5 text-sm"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortMode);
                setSearchPage(1);
              }}
            >
              <option value="eligible">Sort: Eligible</option>
              <option value="best">Sort: Highest overall</option>
              <option value="properties_desc">Sort: Properties high</option>
              <option value="properties_asc">Sort: Properties low</option>
              <option value="quality_desc">Sort: Quality high</option>
              <option value="quality_asc">Sort: Quality low</option>
              <option value="intent_desc">Sort: Intent high</option>
              <option value="intent_asc">Sort: Intent low</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3 text-xs items-center">
            <button
              type="button"
              className="underline"
              onClick={() => setSelectedPages(new Set(pageVisibleIds))}
            >
              Select visible
            </button>
            <button type="button" className="underline" onClick={() => setSelectedPages(new Set())}>
              Unselect all
            </button>
            <span className="text-gray-500">{selectedPages.size} selected</span>
            <button
              type="button"
              className="underline disabled:opacity-40"
              disabled={!selectedPages.size || bulkPages.isPending}
              onClick={() => {
                if (!window.confirm(`Index ${selectedPages.size} page(s) and add to sitemap?`)) return;
                bulkPages.mutate("set_indexable");
              }}
            >
              Index selected
            </button>
            <button
              type="button"
              className="underline disabled:opacity-40"
              disabled={!selectedPages.size || bulkPages.isPending}
              onClick={() => {
                if (!window.confirm(`Noindex ${selectedPages.size} page(s) and remove from sitemap?`)) return;
                bulkPages.mutate("set_noindex");
              }}
            >
              Noindex selected
            </button>
            <button
              type="button"
              className="underline disabled:opacity-40"
              disabled={!selectedPages.size || bulkPages.isPending}
              onClick={() => {
                if (!window.confirm(`Include ${selectedPages.size} page(s) in sitemap? Must be Index.`)) return;
                bulkPages.mutate("sitemap_include");
              }}
            >
              Sitemap include
            </button>
            <button
              type="button"
              className="underline disabled:opacity-40"
              disabled={!selectedPages.size || bulkPages.isPending}
              onClick={() => {
                if (!window.confirm(`Exclude ${selectedPages.size} page(s) from sitemap?`)) return;
                bulkPages.mutate("sitemap_exclude");
              }}
            >
              Sitemap exclude
            </button>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-navy-900 text-left text-xs">
                <tr>
                  <th className="p-2.5 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={pageVisibleIds.length > 0 && pageVisibleIds.every((id) => selectedPages.has(id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPages(new Set(pageVisibleIds));
                        else setSelectedPages(new Set());
                      }}
                    />
                  </th>
                  <th className="p-2.5">Page</th>
                  <th className="p-2.5">Filters</th>
                  <th className="p-2.5">Properties</th>
                  <th className="p-2.5">Quality</th>
                  <th className="p-2.5">Intent</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {searchQuery.isLoading && (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {searchItems.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-2.5">
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
                    <td className="p-2.5 max-w-[200px]">
                      <Link
                        href={row.path}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-gold-600 hover:underline"
                      >
                        {pageName(row)}
                      </Link>
                      <p className="text-[11px] text-gray-500 break-all mt-0.5">{row.path}</p>
                      {(row.seo_control === "manual" || row.locked_by_admin) && (
                        <span className="text-[10px] text-amber-700">Manual</span>
                      )}
                    </td>
                    <td className="p-2.5 text-xs max-w-[160px]">
                      <span className="font-medium">{row.filter_count ?? "—"}</span>
                      <p className="mt-0.5 leading-snug text-gray-600">{row.filters_label || "—"}</p>
                    </td>
                    <td className="p-2.5">{row.match_count}</td>
                    <td className="p-2.5">{Math.round(row.quality_score)}%</td>
                    <td className="p-2.5 text-xs">
                      <span className="font-medium">{intentStrengthLabel(row)}</span>
                      <p className="text-gray-500">
                        {row.intent_score != null ? `${Math.round(row.intent_score)}/100` : "—"}
                      </p>
                    </td>
                    <td className="p-2.5 text-xs space-y-0.5">
                      {statusLines(row).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </td>
                    <td className="p-2.5 text-xs whitespace-nowrap space-x-2">
                      <Link href={row.path} target="_blank" rel="noreferrer" className="underline">
                        Review
                      </Link>
                      {row.index_status !== "indexable" ? (
                        <button type="button" className="underline" onClick={() => publish.mutate(row.id)}>
                          Index
                        </button>
                      ) : (
                        <button type="button" className="underline" onClick={() => noindex.mutate(row.id)}>
                          Noindex
                        </button>
                      )}
                      {row.index_status === "indexable" && row.sitemap_status !== "included" && (
                        <button type="button" className="underline" onClick={() => includeSitemap.mutate(row.id)}>
                          Sitemap include
                        </button>
                      )}
                      {row.index_status === "indexable" && row.sitemap_status === "included" && (
                        <button type="button" className="underline" onClick={() => excludeSitemap.mutate(row.id)}>
                          Sitemap exclude
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!searchQuery.isLoading && !searchItems.length && (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-500">
                      No pages match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center">
            <div className="flex gap-2 text-sm items-center">
              <button
                type="button"
                className="border rounded px-3 py-1 disabled:opacity-40"
                disabled={searchPage <= 1}
                onClick={() => goToSearchPage(searchPage - 1)}
              >
                Previous
              </button>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <span>Go to</span>
                <input
                  type="number"
                  min={1}
                  max={searchTotalPages}
                  className="border rounded px-2 py-1 w-16 text-sm text-center"
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goToSearchPage(pageJump);
                  }}
                  onBlur={() => goToSearchPage(pageJump)}
                  aria-label="Go to page number"
                />
                <span>
                  / {searchTotalPages}
                </span>
              </label>
              <button
                type="button"
                className="border rounded px-3 py-1 disabled:opacity-40"
                disabled={searchPage >= searchTotalPages}
                onClick={() => goToSearchPage(searchPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500">
            Showing up to {PAGE_SIZE} per page · {searchQuery.data?.total ?? 0} total
          </p>
        </section>
      </div>
    </div>
  );
}
