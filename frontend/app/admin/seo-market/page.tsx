"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { EligibilityDetails, SearchIntentAdmin, SearchIntentListResponse } from "@/types/market";

type SimpleStatus = "all" | "ready" | "published" | "noindex" | "not_ready";
type SortMode = "best" | "properties" | "quality";

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
  base_url?: string | null;
  policy_notes?: string | null;
};

type MarketSummary = {
  total_observations: number;
  last_import_at?: string | null;
  top_sources: SourceSummary[];
  other_sources_count: number;
  sources: SourceSummary[];
};

const TABS: { id: SimpleStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "published", label: "Published" },
  { id: "noindex", label: "Noindex" },
  { id: "not_ready", label: "Not ready" },
];

function pageName(row: SearchIntentAdmin) {
  return row.h1 || row.title || row.path;
}

function simpleStatus(row: SearchIntentAdmin): Exclude<SimpleStatus, "all"> {
  if (row.index_status === "indexable") return "published";
  if (row.index_status === "noindex") return "noindex";
  if (row.automatic_eligibility === "eligible") return "ready";
  return "not_ready";
}

function statusLabel(s: Exclude<SimpleStatus, "all">) {
  if (s === "published") return "🟢 Published";
  if (s === "ready") return "🟢 Ready";
  if (s === "noindex") return "🟡 Noindex";
  return "🔴 Not ready";
}

function whyUseful(row: SearchIntentAdmin) {
  const parts: string[] = [];
  if (row.match_count) parts.push(`${row.match_count} matching propert${row.match_count === 1 ? "y" : "ies"}`);
  if (row.quality_score >= 40) parts.push("sufficient data");
  if (!parts.length) return "Does not yet meet publishing rules.";
  return `${parts.join(" and ")}.`;
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

export default function SeoMarketAdminPage() {
  const qc = useQueryClient();

  // --- Search pages state ---
  const [tab, setTab] = useState<SimpleStatus>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("best");
  const [searchPage, setSearchPage] = useState(1);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --- Market data state ---
  const [obsPage, setObsPage] = useState(1);
  const [obsStatus, setObsStatus] = useState("");
  const [obsSource, setObsSource] = useState("");
  const [selectedObs, setSelectedObs] = useState<Set<string>>(new Set());
  const [manageSources, setManageSources] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");

  const sortParams = useMemo(() => {
    if (sort === "properties") return { sort_by: "match_count", sort_dir: "desc" as const };
    if (sort === "quality") return { sort_by: "quality_score", sort_dir: "desc" as const };
    return { sort_by: "opportunity_score", sort_dir: "desc" as const };
  }, [sort]);

  useEffect(() => {
    if (window.location.hash === "#market-data") {
      document.getElementById("market-data")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const searchQuery = useQuery({
    queryKey: ["admin-search-intents", tab, search, sort, searchPage],
    queryFn: () =>
      adminService.searchIntents({
        search: search || undefined,
        simple_status: tab === "all" ? undefined : tab,
        page: searchPage,
        page_size: 40,
        ...sortParams,
      }) as Promise<SearchIntentListResponse>,
  });

  const marketSummary = useQuery({
    queryKey: ["admin-market-summary"],
    queryFn: () => adminService.marketDataSummary() as Promise<MarketSummary>,
  });

  const observations = useQuery({
    queryKey: ["admin-observations", obsPage, obsStatus, obsSource],
    queryFn: () =>
      adminService.listObservations({
        page: obsPage,
        page_size: 30,
        status: obsStatus || undefined,
        source: obsSource || undefined,
      }) as Promise<{ items: ObservationRow[]; total: number; page_size: number }>,
  });

  const review = useQuery({
    queryKey: ["admin-intent-eligibility", reviewId],
    queryFn: () => adminService.getSearchIntentEligibility(reviewId!) as Promise<EligibilityDetails>,
    enabled: Boolean(reviewId) && showDetails,
  });

  const searchItems = searchQuery.data?.items ?? [];
  const searchTotalPages = Math.max(1, Math.ceil((searchQuery.data?.total ?? 0) / (searchQuery.data?.page_size ?? 40)));
  const reviewRow = searchItems.find((r) => r.id === reviewId);
  const obsItems = observations.data?.items ?? [];
  const obsTotalPages = Math.max(1, Math.ceil((observations.data?.total ?? 0) / (observations.data?.page_size ?? 30)));
  const summary = marketSummary.data;

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const invalidateSearch = () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] });
  const invalidateMarket = () => {
    qc.invalidateQueries({ queryKey: ["admin-market-summary"] });
    qc.invalidateQueries({ queryKey: ["admin-observations"] });
  };

  const publish = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "indexable"),
    onSuccess: () => {
      flash("Page published.");
      setReviewId(null);
      invalidateSearch();
    },
  });

  const noindex = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "noindex"),
    onSuccess: () => {
      flash("Page set to noindex.");
      setReviewId(null);
      invalidateSearch();
    },
  });

  const bulkPages = useMutation({
    mutationFn: (action: string) => adminService.bulkSearchIntents(Array.from(selectedPages), action),
    onSuccess: (res: { updated?: number; errors?: string[] }) => {
      flash(res.errors?.length ? res.errors[0] : `Updated ${res.updated ?? 0} page(s).`);
      setSelectedPages(new Set());
      invalidateSearch();
    },
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => adminService.importObservationsCsv(file),
    onSuccess: () => {
      flash("CSV imported. Research refreshed.");
      invalidateMarket();
    },
  });

  const bulkObs = useMutation({
    mutationFn: (action: string) => adminService.bulkObservations(Array.from(selectedObs), action),
    onSuccess: () => {
      flash("Observations updated.");
      setSelectedObs(new Set());
      invalidateMarket();
    },
  });

  const createSource = useMutation({
    mutationFn: (name: string) => adminService.createMarketSource({ name }),
    onSuccess: () => {
      setNewSourceName("");
      invalidateMarket();
      flash("Source added.");
    },
  });

  const pageVisibleIds = searchItems.map((r) => r.id);
  const obsVisibleIds = obsItems.map((r) => r.id);

  return (
    <div className="space-y-10 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">SEO &amp; Market Data</h2>
        <p className="text-sm text-gray-500 mt-1">
          Publish search pages and manage external market observations.{" "}
          <Link href="/admin/seo-settings" className="underline">
            Publishing rules
          </Link>
        </p>
      </div>

      {message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}

      {/* --- Search Pages --- */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Search pages</h3>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchPage(1);
            }}
          />
          <select className="border rounded-lg px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="best">Best first</option>
            <option value="properties">Most properties</option>
            <option value="quality">Highest quality</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setSearchPage(1);
              }}
              className={`px-3 py-1.5 text-sm rounded-full border ${tab === t.id ? "bg-navy-800 text-white border-navy-800" : "bg-white"}`}
            >
              {t.label}
            </button>
          ))}
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
              if (!selectedPages.size || !window.confirm(`Publish ${selectedPages.size} page(s)?`)) return;
              bulkPages.mutate("set_indexable");
            }}
          >
            Publish selected
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
        </div>

        <div className="border rounded-xl bg-white dark:bg-navy-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 dark:bg-navy-900 text-left">
              <tr>
                <th className="p-3 w-8" />
                <th className="p-3">Page</th>
                <th className="p-3">Properties</th>
                <th className="p-3">Quality</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {searchQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {searchItems.map((row) => {
                const status = simpleStatus(row);
                return (
                  <tr key={row.id} className="border-t">
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
                    <td className="p-3 font-medium">
                      <Link href={row.path} target="_blank" rel="noreferrer" className="text-gold-600 hover:underline">
                        {pageName(row)}
                      </Link>
                    </td>
                    <td className="p-3">{row.match_count}</td>
                    <td className="p-3">{Math.round(row.quality_score)}/100</td>
                    <td className="p-3">{statusLabel(status)}</td>
                    <td className="p-3 space-x-2 whitespace-nowrap text-xs">
                      <button type="button" className="underline" onClick={() => { setReviewId(row.id); setShowDetails(false); }}>
                        Review
                      </button>
                      {row.automatic_eligibility === "eligible" && row.index_status !== "indexable" && (
                        <button type="button" className="underline" onClick={() => publish.mutate(row.id)}>
                          Publish
                        </button>
                      )}
                      {status === "published" && (
                        <button type="button" className="underline" onClick={() => noindex.mutate(row.id)}>
                          Noindex
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!searchQuery.isLoading && !searchItems.length && (
                <tr>
                  <td colSpan={6} className="p-6 text-gray-500">
                    No pages match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {searchTotalPages > 1 && (
          <div className="flex gap-2 text-sm items-center">
            <button type="button" className="border rounded px-3 py-1 disabled:opacity-40" disabled={searchPage <= 1} onClick={() => setSearchPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {searchPage} of {searchTotalPages}
            </span>
            <button type="button" className="border rounded px-3 py-1 disabled:opacity-40" disabled={searchPage >= searchTotalPages} onClick={() => setSearchPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>

      {/* --- External Market Data --- */}
      <section id="market-data" className="space-y-4 border-t pt-8">
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white">External market data</h3>
        <p className="text-xs text-gray-500">Separate from KigaliRent Verified inventory. Disappeared listings are never assumed rented.</p>

        <dl className="grid sm:grid-cols-2 gap-4 text-sm border rounded-xl p-4 bg-white dark:bg-navy-800">
          <div>
            <dt className="text-gray-500">Total observations</dt>
            <dd className="text-2xl font-serif">{summary?.total_observations ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last import</dt>
            <dd>{fmtDate(summary?.last_import_at)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="px-4 py-2 text-sm rounded-lg border" onClick={() => adminService.downloadObservationsCsvTemplate().then((blob: Blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "external-observations-template.csv";
            a.click();
            URL.revokeObjectURL(url);
          })}>
            Download CSV template
          </button>
          <label className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white cursor-pointer">
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
          <ul className="text-sm space-y-1 border rounded-xl p-4 bg-white dark:bg-navy-800">
            {summary.top_sources.map((s) => (
              <li key={s.source_id}>
                <button type="button" className="underline text-left" onClick={() => { setObsSource(s.source_id); setObsPage(1); }}>
                  {s.name}
                </button>
                {" — "}
                {s.observation_count}
              </li>
            ))}
            {summary.other_sources_count > 0 && (
              <li className="text-gray-600">
                Other sources — {summary.other_sources_count}
              </li>
            )}
            {!summary.top_sources.length && !summary.other_sources_count && (
              <li className="text-gray-500">No observations imported yet.</li>
            )}
          </ul>
        )}

        <button type="button" className="text-sm underline" onClick={() => setManageSources((v) => !v)}>
          {manageSources ? "Hide source settings" : "Manage sources"}
        </button>

        {manageSources && summary && (
          <div className="border rounded-xl p-4 bg-white dark:bg-navy-800 space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <input
                className="border rounded px-2 py-1 flex-1 min-w-[160px]"
                placeholder="New source name"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
              <button
                type="button"
                className="px-3 py-1 rounded bg-navy-800 text-white text-xs"
                disabled={!newSourceName.trim() || createSource.isPending}
                onClick={() => createSource.mutate(newSourceName.trim())}
              >
                Add source
              </button>
            </div>
            <ul className="space-y-2 text-xs">
              {summary.sources.map((s) => (
                <li key={s.source_id} className="flex flex-wrap items-center gap-2 justify-between border-b pb-2">
                  <span>
                    {s.name} <span className="text-gray-400">({s.observation_count})</span>
                  </span>
                  <span className="space-x-2">
                    {!s.is_archived && (
                      <button
                        type="button"
                        className="underline"
                        onClick={() => adminService.updateMarketSource(s.source_id, { enabled: !s.is_enabled }).then(() => { invalidateMarket(); flash(s.is_enabled ? "Source disabled." : "Source enabled."); })}
                      >
                        {s.is_enabled === false ? "Enable" : "Disable"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="underline text-red-600"
                      onClick={() => {
                        if (window.confirm(`Archive source "${s.name}"?`)) {
                          adminService.updateMarketSource(s.source_id, { archived: true }).then(() => { invalidateMarket(); flash("Source archived."); });
                        }
                      }}
                    >
                      Archive
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center text-sm">
          <select className="border rounded px-2 py-1" value={obsSource} onChange={(e) => { setObsSource(e.target.value); setObsPage(1); }}>
            <option value="">All sources</option>
            {(summary?.sources || []).map((s) => (
              <option key={s.source_id} value={s.source_id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="border rounded px-2 py-1" value={obsStatus} onChange={(e) => { setObsStatus(e.target.value); setObsPage(1); }}>
            <option value="">All statuses</option>
            <option value="active_observed">Active</option>
            <option value="not_found">Not found</option>
            <option value="unknown">Unknown</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" className="underline" onClick={() => setSelectedObs(new Set(obsVisibleIds))}>
            Select visible
          </button>
          <button type="button" className="underline" onClick={() => setSelectedObs(new Set())}>
            Unselect all
          </button>
          <button type="button" className="underline" onClick={() => selectedObs.size && bulkObs.mutate("mark_active")}>
            Mark Active
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => selectedObs.size && window.confirm(`Mark ${selectedObs.size} as not found?`) && bulkObs.mutate("mark_not_found")}
          >
            Mark Not Found
          </button>
          <button type="button" className="underline" onClick={() => selectedObs.size && bulkObs.mutate("mark_unknown")}>
            Mark Unknown
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => window.confirm("Reprocess research from current observations?") && bulkObs.mutate("reprocess")}
          >
            Reprocess
          </button>
        </div>

        <div className="border rounded-xl bg-white dark:bg-navy-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-navy-900 text-left">
              <tr>
                <th className="p-3 w-8" />
                <th className="p-3">Source</th>
                <th className="p-3">Area</th>
                <th className="p-3">Type/Beds</th>
                <th className="p-3">USD</th>
                <th className="p-3">Status</th>
                <th className="p-3">Observed</th>
              </tr>
            </thead>
            <tbody>
              {observations.isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {obsItems.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedObs.has(row.id)}
                      onChange={() => {
                        setSelectedObs((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="p-3">
                    {row.source}
                    {row.source_url && (
                      <>
                        {" · "}
                        <a href={row.source_url} target="_blank" rel="noreferrer" className="text-gold-600 underline text-xs">
                          original
                        </a>
                      </>
                    )}
                  </td>
                  <td className="p-3">{row.neighborhood || "—"}</td>
                  <td className="p-3">
                    {row.property_type || "—"}
                    {row.bedrooms != null ? ` · ${row.bedrooms} bed` : ""}
                  </td>
                  <td className="p-3">{row.usd_price != null ? `$${row.usd_price.toLocaleString()}` : "—"}</td>
                  <td className="p-3 text-xs">{friendlyStatus(row.observation_status)}</td>
                  <td className="p-3 text-xs">{row.observed_at ? new Date(row.observed_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {!observations.isLoading && !obsItems.length && (
                <tr>
                  <td colSpan={7} className="p-6 text-gray-500">
                    No observations match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {obsTotalPages > 1 && (
          <div className="flex gap-2 text-sm items-center">
            <button type="button" className="border rounded px-3 py-1 disabled:opacity-40" disabled={obsPage <= 1} onClick={() => setObsPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {obsPage} of {obsTotalPages}
            </span>
            <button type="button" className="border rounded px-3 py-1 disabled:opacity-40" disabled={obsPage >= obsTotalPages} onClick={() => setObsPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </section>

      {reviewId && reviewRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setReviewId(null)}>
          <div className="bg-white dark:bg-navy-800 rounded-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Review page</h3>
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-gray-500">Search</dt>
                <dd className="font-medium">{pageName(reviewRow)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Properties</dt>
                <dd>{reviewRow.match_count}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Quality</dt>
                <dd>{Math.round(reviewRow.quality_score)}/100</dd>
              </div>
              <div>
                <dt className="text-gray-500">Why it&apos;s useful</dt>
                <dd>{whyUseful(reviewRow)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {reviewRow.automatic_eligibility === "eligible" && reviewRow.index_status !== "indexable" && (
                <button type="button" className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white" onClick={() => publish.mutate(reviewRow.id)}>
                  Publish
                </button>
              )}
              <button type="button" className="px-4 py-2 text-sm rounded-lg border" onClick={() => noindex.mutate(reviewRow.id)}>
                Noindex
              </button>
              <button type="button" className="text-sm underline" onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? "Hide details" : "More details"}
              </button>
            </div>
            {showDetails && review.data && (
              <ul className="text-xs space-y-1 border-t pt-3 max-h-40 overflow-auto">
                {review.data.checks.map((c) => (
                  <li key={c.label}>
                    {c.passed ? "✓" : "✗"} {c.label}: {c.detail}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="text-sm underline" onClick={() => setReviewId(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
