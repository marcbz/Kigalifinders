"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";
import type { EligibilityDetails, SearchIntentAdmin, SearchIntentListResponse } from "@/types/market";

type SimpleStatus = "all" | "ready" | "published" | "noindex" | "not_ready";
type SortMode = "best" | "properties" | "quality";

const TABS: { id: SimpleStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "published", label: "Published" },
  { id: "noindex", label: "Noindex" },
  { id: "not_ready", label: "Not ready" },
];

function pageName(row: SearchIntentAdmin): string {
  return row.h1 || row.title || row.path;
}

function simpleStatus(row: SearchIntentAdmin): Exclude<SimpleStatus, "all"> {
  if (row.index_status === "indexable") return "published";
  if (row.index_status === "noindex") return "noindex";
  if (row.automatic_eligibility === "eligible") return "ready";
  return "not_ready";
}

function statusLabel(s: Exclude<SimpleStatus, "all">): string {
  if (s === "published") return "🟢 Published";
  if (s === "ready") return "🟢 Ready";
  if (s === "noindex") return "🟡 Noindex";
  return "🔴 Not ready";
}

function whyUseful(row: SearchIntentAdmin): string {
  const parts: string[] = [];
  if (row.match_count) parts.push(`${row.match_count} matching propert${row.match_count === 1 ? "y" : "ies"}`);
  if (row.quality_score >= 40) parts.push("sufficient quality score");
  if (row.matching_observation_count && row.matching_observation_count >= 3) {
    parts.push(`${row.matching_observation_count} market observations`);
  }
  if (!parts.length) return row.status_reason || "Does not yet meet publishing rules.";
  return `${parts.join(" and ")}.`;
}

export default function AdminSearchLandingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<SimpleStatus>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("best");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sortParams = useMemo(() => {
    if (sort === "properties") return { sort_by: "match_count", sort_dir: "desc" as const };
    if (sort === "quality") return { sort_by: "quality_score", sort_dir: "desc" as const };
    return { sort_by: "opportunity_score", sort_dir: "desc" as const };
  }, [sort]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-search-intents", tab, search, sort, page],
    queryFn: () =>
      adminService.searchIntents({
        search: search || undefined,
        simple_status: tab === "all" ? undefined : tab,
        page,
        page_size: 40,
        ...sortParams,
      }) as Promise<SearchIntentListResponse>,
  });

  const review = useQuery({
    queryKey: ["admin-intent-eligibility", reviewId],
    queryFn: () => adminService.getSearchIntentEligibility(reviewId!) as Promise<EligibilityDetails>,
    enabled: Boolean(reviewId) && showDetails,
  });

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 40)));
  const reviewRow = items.find((r) => r.id === reviewId);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-search-intents"] });

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const publish = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "indexable"),
    onSuccess: () => {
      flash("Page published.");
      setReviewId(null);
      invalidate();
    },
  });

  const noindex = useMutation({
    mutationFn: (id: string) => adminService.setSearchIntentIndex(id, "noindex"),
    onSuccess: () => {
      flash("Page set to noindex.");
      setReviewId(null);
      invalidate();
    },
  });

  const bulk = useMutation({
    mutationFn: (action: string) => adminService.bulkSearchIntents(Array.from(selected), action),
    onSuccess: (res: { updated?: number; errors?: string[] }) => {
      if (res.errors?.length) flash(res.errors[0]);
      else flash(`Updated ${res.updated ?? 0} page(s).`);
      setSelected(new Set());
      invalidate();
    },
  });

  const visibleIds = items.map((r) => r.id);
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const runBulk = (action: string) => {
    if (!selected.size) return;
    const label = action === "set_indexable" ? "Publish" : "Noindex";
    if (!window.confirm(`${label} ${selected.size} selected page(s)?`)) return;
    bulk.mutate(action);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Search pages</h2>
        <p className="text-sm text-gray-500 mt-1">
          Which pages are good enough for Google?{" "}
          <Link href="/admin/seo-settings" className="underline">
            Publishing rules
          </Link>
        </p>
      </div>

      {message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          placeholder="Search pages…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
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
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              tab === t.id ? "bg-navy-800 text-white border-navy-800" : "bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm items-center">
        <button type="button" className="underline" onClick={() => setSelected(new Set(visibleIds))}>
          Select visible
        </button>
        <button type="button" className="underline" onClick={() => setSelected(new Set())}>
          Unselect all
        </button>
        <button type="button" className="underline" onClick={() => runBulk("set_indexable")}>
          Publish selected
        </button>
        <button type="button" className="underline" onClick={() => runBulk("set_noindex")}>
          Noindex selected
        </button>
      </div>

      <div className="border rounded-xl bg-white dark:bg-navy-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-navy-900 text-left">
            <tr>
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={allVisible}
                  onChange={() => (allVisible ? setSelected(new Set()) : setSelected(new Set(visibleIds)))}
                  aria-label="Select visible"
                />
              </th>
              <th className="p-3">Page</th>
              <th className="p-3">Properties</th>
              <th className="p-3">Quality</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading &&
              items.map((row) => {
                const status = simpleStatus(row);
                const canPublish = status === "ready" || status === "not_ready";
                return (
                  <tr key={row.id} className="border-t align-middle">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-3 font-medium">{pageName(row)}</td>
                    <td className="p-3">{row.match_count}</td>
                    <td className="p-3">{Math.round(row.quality_score)}/100</td>
                    <td className="p-3 whitespace-nowrap">{statusLabel(status)}</td>
                    <td className="p-3 space-x-2 whitespace-nowrap">
                      <button type="button" className="underline text-xs" onClick={() => { setReviewId(row.id); setShowDetails(false); }}>
                        Review
                      </button>
                      {canPublish && row.automatic_eligibility === "eligible" && (
                        <button
                          type="button"
                          className="underline text-xs"
                          disabled={publish.isPending}
                          onClick={() => publish.mutate(row.id)}
                        >
                          Publish
                        </button>
                      )}
                      {status === "published" && (
                        <button type="button" className="underline text-xs" disabled={noindex.isPending} onClick={() => noindex.mutate(row.id)}>
                          Noindex
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            {!isLoading && !items.length && (
              <tr>
                <td colSpan={6} className="p-6 text-gray-500">
                  No pages match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 text-sm items-center">
          <button type="button" className="border rounded px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button type="button" className="border rounded px-3 py-1 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

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
            <div className="flex flex-wrap gap-2 pt-2">
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
