"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { adminService } from "@/services/api";

type Settings = {
  min_verified_for_index: number;
  min_dimensions_for_index: number;
  min_quality_for_index: number;
};

type RuleResults = {
  pages_ready: number;
  pages_not_ready: number;
};

export default function AdminSeoSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-seo-settings"],
    queryFn: () => adminService.getSeoSettings(),
  });
  const [form, setForm] = useState<Settings | null>(null);
  const [results, setResults] = useState<RuleResults | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.settings) {
      setForm({
        min_verified_for_index: data.settings.min_verified_for_index,
        min_dimensions_for_index: data.settings.min_dimensions_for_index,
        min_quality_for_index: data.settings.min_quality_for_index ?? 40,
      });
    }
    if (data?.summary) {
      setResults({
        pages_ready: data.summary.pages_ready ?? data.summary.eligible ?? 0,
        pages_not_ready: data.summary.pages_not_ready ?? data.summary.excluded_pages ?? 0,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      adminService.updateSeoSettings({
        min_verified_for_index: form!.min_verified_for_index,
        min_dimensions_for_index: form!.min_dimensions_for_index,
        min_quality_for_index: form!.min_quality_for_index,
      }),
    onSuccess: (res: { summary?: RuleResults; recalculation?: { after?: RuleResults } }) => {
      setMessage("Settings saved. Search pages were recalculated.");
      const summary = res?.summary;
      if (summary) {
        setResults({
          pages_ready: summary.pages_ready ?? 0,
          pages_not_ready: summary.pages_not_ready ?? 0,
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-seo-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-search-intents"] });
    },
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Publishing rules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set minimum quality thresholds, then see which search pages are ready to publish.{" "}
          <Link href="/admin/seo-market" className="underline">
            Manage search pages
          </Link>
        </p>
      </div>

      {message && <p className="text-sm text-green-700 bg-green-50 border rounded-lg px-4 py-2">{message}</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {results && (
        <div className="border rounded-xl p-5 bg-white dark:bg-navy-800 space-y-3">
          <p className="text-sm font-medium text-navy-800 dark:text-white">Current results</p>
          <p className="text-2xl font-serif text-navy-800 dark:text-white">
            {results.pages_ready} page{results.pages_ready === 1 ? "" : "s"} ready to publish
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {results.pages_not_ready} page{results.pages_not_ready === 1 ? "" : "s"} not ready
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/admin/seo-market?status=ready"
              className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white"
            >
              View ready pages
            </Link>
            <Link
              href="/admin/seo-market?status=not_ready"
              className="px-4 py-2 text-sm rounded-lg border"
            >
              View not ready pages
            </Link>
          </div>
        </div>
      )}

      {form && (
        <form
          className="space-y-6 border rounded-xl p-6 bg-white dark:bg-navy-800"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium">Minimum matching properties</span>
            <input
              type="number"
              min={1}
              className="border rounded px-3 py-2 w-full"
              value={form.min_verified_for_index}
              onChange={(e) => setForm({ ...form, min_verified_for_index: Number(e.target.value) })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Minimum attributes</span>
            <p className="text-xs text-gray-500">Location counts as one. Example: Kibagabaga + furnished = 2.</p>
            <input
              type="number"
              min={1}
              className="border rounded px-3 py-2 w-full"
              value={form.min_dimensions_for_index}
              onChange={(e) => setForm({ ...form, min_dimensions_for_index: Number(e.target.value) })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Minimum quality score</span>
            <input
              type="number"
              min={0}
              max={100}
              className="border rounded px-3 py-2 w-full"
              value={form.min_quality_for_index}
              onChange={(e) => setForm({ ...form, min_quality_for_index: Number(e.target.value) })}
            />
          </label>
          <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white w-full" disabled={save.isPending}>
            {save.isPending ? "Saving & recalculating…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
