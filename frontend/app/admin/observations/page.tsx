"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";

type ObservationRow = {
  id: string;
  source: string;
  source_url?: string | null;
  neighborhood?: string | null;
  bedrooms?: number | null;
  property_type?: string | null;
  asking_price: number;
  currency: string;
  usd_price?: number | null;
  observation_status: string;
  observed_at?: string | null;
  data_label?: string;
};

type SourceRow = {
  source_id: string;
  name: string;
  collection_method: string;
  policy_status: string;
  policy_notes?: string | null;
  robots_summary?: string | null;
  automated_enabled: boolean;
  listing_adapter_ready: boolean;
  can_enable_automated: boolean;
  can_run_now: boolean;
  csv_only: boolean;
  last_crawl_at?: string | null;
  last_import_at?: string | null;
  last_error?: string | null;
  observation_count: number;
};

type CollectionRun = {
  id: string;
  status: string;
  mode: string;
  source_ids: string[];
  current_source_id?: string | null;
  progress?: Record<string, unknown> | null;
  observations_found: number;
  observations_new: number;
  observations_updated: number;
  duplicates: number;
  errors?: string[];
  started_at?: string | null;
  completed_at?: string | null;
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

export default function AdminObservationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string>("");
  const [showRunModal, setShowRunModal] = useState(false);
  const [runPick, setRunPick] = useState<Set<string>>(new Set());
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-observations", status],
    queryFn: () =>
      adminService.listObservations({ page: 1, page_size: 100, status: status || undefined }) as Promise<{
        items: ObservationRow[];
        total: number;
      }>,
  });
  const sources = useQuery({
    queryKey: ["admin-market-sources"],
    queryFn: () => adminService.marketSources() as Promise<{ policy: string; sources: SourceRow[] }>,
  });
  const runs = useQuery({
    queryKey: ["admin-collection-runs"],
    queryFn: () => adminService.listCollectionRuns() as Promise<{ runs: CollectionRun[] }>,
    refetchInterval: activeRunId ? 2500 : false,
  });

  const activeRun = useQuery({
    queryKey: ["admin-collection-run", activeRunId],
    queryFn: () => adminService.getCollectionRun(activeRunId!) as Promise<CollectionRun>,
    enabled: !!activeRunId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "queued" || s === "running" ? 2000 : false;
    },
  });

  useEffect(() => {
    const s = activeRun.data?.status;
    if (s === "completed" || s === "failed" || s === "paused") {
      qc.invalidateQueries({ queryKey: ["admin-market-sources"] });
      qc.invalidateQueries({ queryKey: ["admin-observations"] });
      qc.invalidateQueries({ queryKey: ["admin-collection-runs"] });
    }
  }, [activeRun.data?.status, qc]);

  const items = data?.items || [];
  const sourceRows = sources.data?.sources || [];
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-observations"] });
    qc.invalidateQueries({ queryKey: ["admin-market-sources"] });
    qc.invalidateQueries({ queryKey: ["admin-collection-runs"] });
  };

  const importCsv = useMutation({
    mutationFn: ({ file, sourceId }: { file: File; sourceId?: string }) =>
      adminService.importObservationsCsv(file, sourceId),
    onSuccess: invalidate,
  });
  const bulk = useMutation({
    mutationFn: (action: string) => adminService.bulkObservations(Array.from(selected), action),
    onSuccess: () => {
      setSelected(new Set());
      invalidate();
    },
  });
  const review = useMutation({
    mutationFn: (sourceId: string) => adminService.reviewMarketSource(sourceId),
    onSuccess: invalidate,
  });
  const enable = useMutation({
    mutationFn: (sourceId: string) => adminService.enableMarketSource(sourceId),
    onSuccess: invalidate,
  });
  const disable = useMutation({
    mutationFn: (sourceId: string) => adminService.disableMarketSource(sourceId),
    onSuccess: invalidate,
  });
  const runNow = useMutation({
    mutationFn: (sourceId: string) => adminService.runMarketSourceNow(sourceId),
    onSuccess: (res: { run?: CollectionRun }) => {
      if (res?.run?.id) setActiveRunId(res.run.id);
      setShowRunModal(false);
      invalidate();
    },
  });
  const runExternal = useMutation({
    mutationFn: (payload: { source_ids: string[]; mode: string }) => adminService.runExternalResearch(payload),
    onSuccess: (res: { run?: CollectionRun }) => {
      if (res?.run?.id) setActiveRunId(res.run.id);
      setShowRunModal(false);
      invalidate();
    },
  });

  const runBulk = (action: string, destructive = false) => {
    if (!selected.size) return;
    if (destructive && !window.confirm(`Apply “${action}” to ${selected.size} observation(s)?`)) return;
    bulk.mutate(action);
  };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of items) c[row.observation_status] = (c[row.observation_status] || 0) + 1;
    return c;
  }, [items]);

  const enabledSources = sourceRows.filter((s) => s.automated_enabled);
  const progress = activeRun.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800 dark:text-white">External Market Observations</h2>
          <p className="text-sm text-gray-500 mt-1">
            Separate from KigaliRent Verified inventory. Disappeared listings are never assumed rented.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-lg bg-navy-800 text-white"
            onClick={() => {
              setRunPick(new Set(enabledSources.map((s) => s.source_id)));
              setShowRunModal(true);
            }}
          >
            Run External Research
          </button>
        </div>
      </div>

      {sources.data?.policy && (
        <p className="text-xs text-gray-600 border rounded-xl p-4 bg-white dark:bg-navy-800">{sources.data.policy}</p>
      )}

      {(progress || runNow.error || runExternal.error || enable.error || review.error) && (
        <div className="border rounded-xl p-4 bg-white dark:bg-navy-800 text-sm space-y-2">
          <p className="font-medium text-navy-800 dark:text-white">Collection status</p>
          {progress && (
            <dl className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="uppercase font-medium">{progress.status}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Source</dt>
                <dd>{progress.current_source_id || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Found / new / updated / dupes</dt>
                <dd>
                  {progress.observations_found} / {progress.observations_new} / {progress.observations_updated} /{" "}
                  {progress.duplicates}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Completed</dt>
                <dd>{fmtDate(progress.completed_at)}</dd>
              </div>
            </dl>
          )}
          {progress?.errors && progress.errors.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-5">
              {progress.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {(runNow.error || runExternal.error || enable.error || review.error) && (
            <p className="text-xs text-red-600">
              {(runNow.error || runExternal.error || enable.error || review.error) instanceof Error
                ? (runNow.error || runExternal.error || enable.error || review.error)!.message
                : "Action failed"}
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white">External Sources</h3>
        <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-900 text-left">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Method</th>
                <th className="p-3">Policy / robots</th>
                <th className="p-3">Enabled</th>
                <th className="p-3">Last crawl / import</th>
                <th className="p-3">Count</th>
                <th className="p-3">Last error</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map((s) => (
                <tr key={s.source_id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[10px] text-gray-400">{s.source_id}</div>
                    {!s.listing_adapter_ready && (
                      <div className="text-[10px] text-amber-700 mt-1">Listing adapter not approved — CSV for data</div>
                    )}
                  </td>
                  <td className="p-3">{s.collection_method}</td>
                  <td className="p-3 text-xs max-w-[220px]">
                    <div className="uppercase tracking-wide text-gray-500">{s.policy_status}</div>
                    <div className="text-gray-500 mt-1 line-clamp-3">{s.robots_summary || s.policy_notes || "—"}</div>
                  </td>
                  <td className="p-3">{s.automated_enabled ? "Yes" : "No"}</td>
                  <td className="p-3 text-xs">
                    <div>Crawl: {fmtDate(s.last_crawl_at)}</div>
                    <div>Import: {fmtDate(s.last_import_at)}</div>
                  </td>
                  <td className="p-3">{s.observation_count}</td>
                  <td className="p-3 text-xs text-red-600 max-w-[160px]">{s.last_error || "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1 text-xs items-start">
                      <button type="button" className="underline" onClick={() => review.mutate(s.source_id)}>
                        Review Source
                      </button>
                      {s.can_enable_automated && !s.automated_enabled && (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Enable automated collection for ${s.name}? Only after robots/policy review. No CAPTCHA/login bypass. Conservative rate limits.`
                              )
                            ) {
                              enable.mutate(s.source_id);
                            }
                          }}
                        >
                          Enable Automated Collection
                        </button>
                      )}
                      {s.automated_enabled && (
                        <button type="button" className="underline" onClick={() => disable.mutate(s.source_id)}>
                          Disable Collection
                        </button>
                      )}
                      {s.can_run_now ? (
                        <button type="button" className="underline" onClick={() => runNow.mutate(s.source_id)}>
                          Run Now
                        </button>
                      ) : (
                        <span className="text-gray-400">Run Now (enable first)</span>
                      )}
                      <label className="underline cursor-pointer">
                        Import CSV
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            importCsv.mutate({ file: f, sourceId: s.source_id });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(runs.data?.runs || []).length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-white">Recent runs</h3>
          <ul className="text-xs space-y-1">
            {(runs.data?.runs || []).slice(0, 5).map((r) => (
              <li key={r.id}>
                <button type="button" className="underline" onClick={() => setActiveRunId(r.id)}>
                  {r.id.slice(0, 8)}
                </button>{" "}
                · {r.status} · found {r.observations_found} · new {r.observations_new} · {fmtDate(r.completed_at || r.started_at)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Observation rows</h3>
          <label className="px-4 py-2 text-sm rounded-lg border cursor-pointer h-fit">
            Import CSV (any source)
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                importCsv.mutate({ file: f });
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center text-sm">
          <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active_observed">active_observed</option>
            <option value="not_found">not_found</option>
            <option value="price_changed">price_changed</option>
            <option value="unknown">unknown</option>
            <option value="invalid">invalid</option>
          </select>
          <span className="text-gray-500">
            {selected.size} selected · {data?.total ?? 0} total
          </span>
          <button type="button" className="underline" onClick={() => setSelected(new Set(visibleIds))}>
            Select all
          </button>
          <button type="button" className="underline" onClick={() => setSelected(new Set())}>
            Unselect all
          </button>
          <button type="button" className="underline" onClick={() => setSelected(new Set(visibleIds))}>
            Select visible
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_active")}>
            Mark active
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_not_found", true)}>
            Mark not found
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_unknown")}>
            Mark unknown
          </button>
          <button type="button" className="underline" onClick={() => runBulk("mark_invalid", true)}>
            Mark invalid
          </button>
          <button type="button" className="underline" onClick={() => runBulk("reprocess", true)}>
            Reprocess
          </button>
        </div>

        {(importCsv.data || bulk.data) && (
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
            {JSON.stringify(importCsv.data || bulk.data, null, 2)}
          </pre>
        )}

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">Failed to load observations.</p>}

        <div className="overflow-x-auto border rounded-xl bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-900 text-left">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))}
                    aria-label="Select visible"
                  />
                </th>
                <th className="p-3">Source</th>
                <th className="p-3">Area</th>
                <th className="p-3">Type / beds</th>
                <th className="p-3">USD</th>
                <th className="p-3">Status</th>
                <th className="p-3">Observed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select observation ${row.id}`}
                    />
                  </td>
                  <td className="p-3">
                    <div>{row.source}</div>
                    {row.source_url && (
                      <a href={row.source_url} target="_blank" rel="noreferrer" className="text-xs text-gold-600 underline">
                        URL
                      </a>
                    )}
                    <div className="text-[10px] text-gray-400">{row.data_label}</div>
                  </td>
                  <td className="p-3">{row.neighborhood || "—"}</td>
                  <td className="p-3">
                    {row.property_type || "—"}
                    {row.bedrooms != null ? ` · ${row.bedrooms} bed` : ""}
                  </td>
                  <td className="p-3">
                    {row.usd_price != null ? `$${row.usd_price.toLocaleString()}` : "—"}
                    <div className="text-[10px] text-gray-400">
                      {row.asking_price} {row.currency}
                    </div>
                  </td>
                  <td className="p-3 text-xs uppercase">{row.observation_status}</td>
                  <td className="p-3 text-xs">{row.observed_at ? new Date(row.observed_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {!items.length && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-gray-500">
                    No observations yet. Import a CSV. Automated listing adapters stay off until explicitly approved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">Visible status mix: {JSON.stringify(statusCounts)}</p>
      </section>

      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-navy-800 dark:text-white">Run External Research</h3>
            <p className="text-sm text-gray-500">
              Only enabled sources can run. Disabled/unapproved sources are skipped. Crawling runs in the background —
              not during page load.
            </p>
            <div className="space-y-2 max-h-56 overflow-auto">
              {sourceRows.map((s) => (
                <label key={s.source_id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!s.automated_enabled}
                    checked={runPick.has(s.source_id)}
                    onChange={() => {
                      setRunPick((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.source_id)) next.delete(s.source_id);
                        else next.add(s.source_id);
                        return next;
                      });
                    }}
                  />
                  <span className={!s.automated_enabled ? "text-gray-400" : ""}>
                    {s.name}
                    {!s.automated_enabled ? " (disabled — CSV only)" : ""}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" className="px-3 py-2 text-sm border rounded-lg" onClick={() => setShowRunModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm border rounded-lg"
                disabled={!runPick.size || runExternal.isPending}
                onClick={() => runExternal.mutate({ source_ids: Array.from(runPick), mode: "selected" })}
              >
                Run selected
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-lg bg-navy-800 text-white"
                disabled={!enabledSources.length || runExternal.isPending}
                onClick={() => runExternal.mutate({ source_ids: [], mode: "all_enabled" })}
              >
                Run all ENABLED sources
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
