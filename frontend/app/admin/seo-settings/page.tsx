"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import Link from "next/link";
import type { LandingPageStats } from "@/types/market";

type SeoPayload = {
  settings: {
    min_dimensions_for_index: number;
    min_verified_for_index: number;
    min_quality_for_index: number;
    min_opportunity_for_index: number;
    min_observations_for_research_value: number;
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
    indexable?: number;
    noindex?: number;
    sitemap_included?: number;
    sitemap_excluded?: number;
    manual_overrides?: number;
    exclusion_reasons: { reason: string; count: number }[];
    thresholds: Record<string, number | boolean>;
  };
  recalculation?: { before: LandingPageStats; after: LandingPageStats };
};

const FIELD_ORDER = [
  "min_dimensions_for_index",
  "min_verified_for_index",
  "min_quality_for_index",
  "min_opportunity_for_index",
  "min_observations_for_research_value",
  "allow_auto_index",
  "allow_sitemap_inclusion",
  "require_unique_content",
  "min_unique_content_chars",
] as const;

const LABELS: Record<(typeof FIELD_ORDER)[number], string> = {
  min_dimensions_for_index: "Minimum dimensions / attributes required",
  min_verified_for_index: "Minimum matching properties required",
  min_quality_for_index: "Minimum quality score",
  min_opportunity_for_index: "Minimum opportunity score",
  min_observations_for_research_value: "Minimum observations",
  allow_auto_index: "Enable automatic SEO landing-page generation",
  allow_sitemap_inclusion: "Enable automatic sitemap inclusion for eligible pages",
  require_unique_content: "Require unique content / real market data",
  min_unique_content_chars: "Minimum unique-content length (characters)",
};

function StatsGrid({ title, stats }: { title: string; stats: LandingPageStats }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{title}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <dt className="text-gray-500">Eligible</dt>
          <dd className="text-lg font-serif">{stats.eligible}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Excluded</dt>
          <dd className="text-lg font-serif">{stats.excluded}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Indexable</dt>
          <dd className="text-lg font-serif">{stats.indexable}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Noindex</dt>
          <dd className="text-lg font-serif">{stats.noindex}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Sitemap in</dt>
          <dd className="text-lg font-serif">{stats.sitemap_included}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Sitemap out</dt>
          <dd className="text-lg font-serif">{stats.sitemap_excluded}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Manual</dt>
          <dd className="text-lg font-serif">{stats.manual}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Automatic</dt>
          <dd className="text-lg font-serif">{stats.automatic}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function AdminSeoSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-seo-settings"],
    queryFn: () => adminService.getSeoSettings() as Promise<SeoPayload>,
  });
  const [form, setForm] = useState<SeoPayload["settings"] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.settings) setForm({ ...data.settings });
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Partial<SeoPayload["settings"]>) => adminService.updateSeoSettings(payload),
    onSuccess: (res: SeoPayload) => {
      qc.setQueryData(["admin-seo-settings"], res);
      if (res.settings) setForm({ ...res.settings });
      setMessage("Settings saved and landing pages recalculated.");
    },
  });
  const reset = useMutation({
    mutationFn: () => adminService.resetSeoSettings(),
    onSuccess: (res: SeoPayload) => {
      qc.setQueryData(["admin-seo-settings"], res);
      if (res.settings) setForm({ ...res.settings });
      setMessage("Settings reset to defaults and landing pages recalculated.");
    },
  });
  const recalculate = useMutation({
    mutationFn: () => adminService.recalculateSeoLandings(),
    onSuccess: (res: SeoPayload) => {
      qc.invalidateQueries({ queryKey: ["admin-seo-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-seo-summary"] });
      setMessage("Landing page eligibility recalculated.");
      if (res.recalculation) {
        qc.setQueryData(["admin-seo-settings"], (old: SeoPayload | undefined) =>
          old ? { ...old, recalculation: res.recalculation } : old
        );
      }
    },
  });

  const summary = (save.data as SeoPayload | undefined)?.summary || data?.summary;
  const recalc = (save.data as SeoPayload | undefined)?.recalculation || (reset.data as SeoPayload | undefined)?.recalculation || data?.recalculation;
  const help = data?.help || {};

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">SEO Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Thresholds are stored in the database and drive automatic eligibility. Manual overrides are never overwritten.{" "}
          <Link href="/admin/search-landings" className="underline">
            View search landings
          </Link>
        </p>
      </div>

      {message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}
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
                      step={key.includes("quality") || key.includes("opportunity") ? 1 : undefined}
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
              {save.isPending ? "Saving…" : "Save & recalculate"}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border"
              disabled={recalculate.isPending}
              onClick={() => {
                if (window.confirm("Recalculate eligibility for all landing pages using current settings?")) {
                  recalculate.mutate();
                }
              }}
            >
              {recalculate.isPending ? "Recalculating…" : "Apply / recalculate landing pages"}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border"
              disabled={reset.isPending}
              onClick={() => {
                if (window.confirm("Reset SEO settings to defaults and recalculate landing pages?")) {
                  reset.mutate();
                }
              }}
            >
              {reset.isPending ? "Resetting…" : "Reset to defaults"}
            </button>
          </div>
        </form>
      )}

      {recalc && (
        <section className="border rounded-xl p-6 bg-white dark:bg-navy-800 space-y-4">
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Recalculation results</h3>
          <StatsGrid title="Before" stats={recalc.before} />
          <StatsGrid title="After" stats={recalc.after} />
        </section>
      )}

      {summary && (
        <section className="border rounded-xl p-6 bg-white dark:bg-navy-800 space-y-4">
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Current summary</h3>
          <dl className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Indexable</dt>
              <dd className="text-2xl font-serif">{summary.indexable ?? summary.eligible_landing_pages}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Excluded (auto)</dt>
              <dd className="text-2xl font-serif">{summary.excluded_pages}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Total pages</dt>
              <dd className="text-2xl font-serif">{summary.total_pages}</dd>
            </div>
          </dl>
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
