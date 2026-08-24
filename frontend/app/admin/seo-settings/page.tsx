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

export default function AdminSeoSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-seo-settings"],
    queryFn: () => adminService.getSeoSettings(),
  });
  const [form, setForm] = useState<Settings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data?.settings) {
      setForm({
        min_verified_for_index: data.settings.min_verified_for_index,
        min_dimensions_for_index: data.settings.min_dimensions_for_index,
        min_quality_for_index: data.settings.min_quality_for_index ?? 40,
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
    onSuccess: () => {
      setMessage("Settings saved. Search pages were recalculated.");
      qc.invalidateQueries({ queryKey: ["admin-seo-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-search-intents"] });
    },
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-xl font-semibold text-navy-800 dark:text-white">Publishing rules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose when a rental search page is good enough to publish to Google.{" "}
          <Link href="/admin/search-landings" className="underline">
            View search pages
          </Link>
        </p>
      </div>

      {message && <p className="text-sm text-green-700 bg-green-50 border rounded-lg px-4 py-2">{message}</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

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
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
