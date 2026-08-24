"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import Link from "next/link";

type SeoPayload = {
  settings: {
    min_dimensions_for_index: number;
    min_verified_for_index: number;
    allow_auto_index: boolean;
    allow_sitemap_inclusion: boolean;
    require_unique_content: boolean;
    min_unique_content_chars: number;
  };
  defaults: Record<string, number | boolean>;
  help: Record<string, string>;
  allowed_attributes: string[];
  removed_attributes: string[];
  notes?: string;
  summary?: {
    eligible_landing_pages: number;
    excluded_pages: number;
    total_pages: number;
    exclusion_reasons: { reason: string; count: number }[];
    thresholds: Record<string, number | boolean>;
  };
  re_evaluated?: { promoted?: number; demoted?: number };
};

const FIELD_ORDER = [
  "min_dimensions_for_index",
  "min_verified_for_index",
  "allow_auto_index",
  "allow_sitemap_inclusion",
  "require_unique_content",
  "min_unique_content_chars",
] as const;

const LABELS: Record<(typeof FIELD_ORDER)[number], string> = {
  min_dimensions_for_index: "Minimum dimensions / attributes required",
  min_verified_for_index: "Minimum matching properties required",
  allow_auto_index: "Enable automatic SEO landing-page generation",
  allow_sitemap_inclusion: "Enable automatic sitemap inclusion for eligible pages",
  require_unique_content: "Require unique content / real market data",
  min_unique_content_chars: "Minimum unique-content length (characters)",
};

export default function AdminSeoSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-seo-settings"],
    queryFn: () => adminService.getSeoSettings() as Promise<SeoPayload>,
  });
  const [form, setForm] = useState<SeoPayload["settings"] | null>(null);

  useEffect(() => {
    if (data?.settings) setForm({ ...data.settings });
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Partial<SeoPayload["settings"]>) => adminService.updateSeoSettings(payload),
    onSuccess: (res: SeoPayload) => {
      qc.setQueryData(["admin-seo-settings"], res);
      if (res.settings) setForm({ ...res.settings });
    },
  });
  const reset = useMutation({
    mutationFn: () => adminService.resetSeoSettings(),
    onSuccess: (res: SeoPayload) => {
      qc.setQueryData(["admin-seo-settings"], res);
      if (res.settings) setForm({ ...res.settings });
    },
  });
  const reevaluate = useMutation({
    mutationFn: () => adminService.reevaluateSeo(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-seo-settings"] }),
  });

  const summary = (save.data as SeoPayload | undefined)?.summary || data?.summary;
  const help = data?.help || {};

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">SEO Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Control when rental attribute landing pages can be indexed and included in sitemaps.{" "}
          <Link href="/admin/search-landings" className="underline">
            View search landings
          </Link>
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Failed to load SEO settings.</p>}

      {data && (
        <div className="text-xs border rounded-xl p-4 bg-white dark:bg-navy-800 space-y-2">
          <p>
            <strong>Allowed attributes:</strong> {(data.allowed_attributes || []).join(", ")}
          </p>
          <p>
            <strong>Removed from SEO:</strong> {(data.removed_attributes || []).join(", ")}
          </p>
          <p className="text-gray-500">{data.notes}</p>
        </div>
      )}

      {form && (
        <form
          className="space-y-6 border rounded-xl p-6 bg-white dark:bg-navy-800"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          {FIELD_ORDER.map((key) => {
            const value = form[key];
            const isBool = typeof value === "boolean";
            return (
              <div key={key} className="space-y-1">
                <label className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-navy-800 dark:text-white">
                  <span>{LABELS[key]}</span>
                  {isBool ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                  ) : (
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-28"
                      value={Number(value)}
                      min={0}
                      onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                    />
                  )}
                </label>
                <p className="text-xs text-gray-500">{help[key]}</p>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border"
              disabled={reset.isPending}
              onClick={() => {
                if (window.confirm("Reset SEO settings to defaults and re-evaluate landing pages?")) {
                  reset.mutate();
                }
              }}
            >
              {reset.isPending ? "Resetting…" : "Reset to defaults"}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border"
              disabled={reevaluate.isPending}
              onClick={() => reevaluate.mutate()}
            >
              {reevaluate.isPending ? "Re-evaluating…" : "Re-evaluate now"}
            </button>
          </div>
          {(save.data || reset.data) && (
            <p className="text-xs text-gray-500">
              Saved. Re-evaluated:{" "}
              {JSON.stringify((save.data as SeoPayload)?.re_evaluated || (reset.data as SeoPayload)?.re_evaluated || {})}
            </p>
          )}
        </form>
      )}

      {summary && (
        <section className="border rounded-xl p-6 bg-white dark:bg-navy-800 space-y-4">
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Eligibility summary</h3>
          <dl className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Eligible (indexable)</dt>
              <dd className="text-2xl font-serif">{summary.eligible_landing_pages}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Excluded</dt>
              <dd className="text-2xl font-serif">{summary.excluded_pages}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Total pages</dt>
              <dd className="text-2xl font-serif">{summary.total_pages}</dd>
            </div>
          </dl>
          <div>
            <p className="text-sm font-medium mb-2">Current thresholds</p>
            <pre className="text-xs bg-gray-50 dark:bg-navy-900 p-3 rounded overflow-auto">
              {JSON.stringify(summary.thresholds, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Why pages were excluded</p>
            {(summary.exclusion_reasons || []).length === 0 ? (
              <p className="text-xs text-gray-500">No exclusions recorded.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {summary.exclusion_reasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-4 border-b py-1">
                    <span>{r.reason}</span>
                    <span className="text-gray-500">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
