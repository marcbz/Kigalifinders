"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import { getApiErrorMessage } from "@/lib/utils";

function formatWhen(iso?: string) {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "never" : d.toLocaleString();
}

/** Bing / Microsoft (Copilot, ChatGPT search, DuckDuckGo) discovery via IndexNow. */
export function IndexNowPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["indexnow-status"], queryFn: adminService.indexNowStatus, retry: false });
  const submitAll = useMutation({
    mutationFn: adminService.indexNowSubmitAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["indexnow-status"] }),
  });

  const last = data?.last_full_sweep;

  return (
    <section className="rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50/90 dark:bg-navy-800/90 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-navy-800 dark:text-white">Instant indexing (IndexNow)</h3>
      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug">
        Listings, blog posts, rental search pages and research pages are sent to Bing automatically when they change
        (also used by Copilot, ChatGPT search and DuckDuckGo). The full sitemap is re-sent weekly. Google reads the
        sitemap instead.
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Status:{" "}
        <span className="font-medium">{data ? (data.enabled ? "active" : "off (non-production)") : "…"}</span>
        <br />
        Last full submit: <span className="font-medium">{formatWhen(last?.last_run)}</span>
        {last && ` · ${last.submitted}/${last.found} URLs${last.ok ? "" : " (failed)"}`}
      </p>
      <button
        type="button"
        className="w-full border rounded-md px-3 py-1.5 text-sm font-medium bg-white dark:bg-navy-900 hover:border-gold-500 disabled:opacity-50"
        disabled={submitAll.isPending || data?.enabled === false}
        onClick={() => submitAll.mutate()}
      >
        {submitAll.isPending ? "Submitting all pages…" : "Submit all pages now"}
      </button>
      {submitAll.isSuccess && (
        <p className="text-xs text-green-700">
          Sent {submitAll.data.submitted} of {submitAll.data.found} URLs.
        </p>
      )}
      {submitAll.isError && (
        <p className="text-xs text-red-700">{getApiErrorMessage(submitAll.error, "Submission failed.")}</p>
      )}
    </section>
  );
}
