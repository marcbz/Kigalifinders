"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";
import { formatDateTime } from "@/lib/utils";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

type RedirectLink = {
  id: string;
  slug: string;
  destination_url: string;
  title?: string | null;
  notes?: string | null;
  is_active: boolean;
  clicks_count: number;
  created_at: string;
  updated_at: string;
};

type RedirectClick = {
  id: string;
  ip_address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  user_agent?: string | null;
  referer?: string | null;
  clicked_at: string;
};

type RedirectForm = {
  slug: string;
  destination_url: string;
  title: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: RedirectForm = {
  slug: "",
  destination_url: "",
  title: "",
  notes: "",
  is_active: true,
};

function locationLabel(click: RedirectClick): string {
  const parts = [click.city, click.region, click.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown";
}

export default function AdminRedirectsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RedirectForm>(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin-redirects"],
    queryFn: adminService.redirects,
  });

  const { data: clicks = [], isLoading: loadingClicks } = useQuery({
    queryKey: ["admin-redirect-clicks", editingId],
    queryFn: () => adminService.redirectClicks(editingId!),
    enabled: !!editingId,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-redirect-stats", editingId],
    queryFn: () => adminService.redirectStats(editingId!),
    enabled: !!editingId,
  });

  const shortUrl = useMemo(() => {
    if (!form.slug.trim()) return "";
    return `${siteUrl}/go/${form.slug.trim().toLowerCase()}`;
  }, [form.slug]);

  useEffect(() => {
    if (!editingId) {
      setForm(emptyForm);
      return;
    }
    const link = (links as RedirectLink[]).find((l) => l.id === editingId);
    if (!link) return;
    setForm({
      slug: link.slug,
      destination_url: link.destination_url,
      title: link.title || "",
      notes: link.notes || "",
      is_active: link.is_active,
    });
  }, [editingId, links]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        slug: form.slug.trim() || undefined,
        destination_url: form.destination_url.trim(),
        title: form.title.trim() || undefined,
        notes: form.notes.trim() || undefined,
        is_active: form.is_active,
      };
      if (editingId) {
        return adminService.updateRedirect(editingId, payload);
      }
      return adminService.createRedirect(payload);
    },
    onSuccess: () => {
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-redirects"] });
      if (!editingId) {
        setForm(emptyForm);
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not save redirect.";
      setSaveError(typeof msg === "string" ? msg : "Could not save redirect.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteRedirect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-redirects"] });
      if (editingId) setEditingId(null);
    },
  });

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-bold text-navy-800 dark:text-white">Redirect links</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Create private short links like <code className="text-xs">/go/your-slug</code>. Clicks are tracked with
          location when available. These links are not indexed or added to the sitemap.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="rounded-xl border bg-white dark:bg-navy-800 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-navy-800 dark:text-white">
              {editingId ? "Edit redirect" : "New redirect"}
            </h3>
            {editingId ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Label (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 bg-white dark:bg-navy-900"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="WhatsApp campaign"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Slug</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 bg-white dark:bg-navy-900"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="my-link"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Destination URL</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 bg-white dark:bg-navy-900"
                value={form.destination_url}
                onChange={(e) => setForm((f) => ({ ...f, destination_url: e.target.value }))}
                placeholder="https://example.com/page"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 dark:text-gray-300">Notes (optional)</span>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2 bg-white dark:bg-navy-900 min-h-[72px]"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Personal reminder"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
          </div>

          {shortUrl ? (
            <div className="rounded-lg bg-navy-50 dark:bg-navy-900 px-3 py-2 text-sm flex items-center justify-between gap-3">
              <span className="truncate">{shortUrl}</span>
              <button
                type="button"
                className="text-gold-600 hover:underline inline-flex items-center gap-1 shrink-0"
                onClick={() => copyLink(shortUrl)}
              >
                <Copy className="w-4 h-4" />
                {copied === shortUrl ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}

          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}

          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : editingId ? "Update redirect" : "Create redirect"}
          </Button>
        </section>

        <section className="rounded-xl border bg-white dark:bg-navy-800 p-6">
          <h3 className="font-semibold text-navy-800 dark:text-white mb-4">Your redirects</h3>
          {isLoading ? (
            <Shimmer className="h-24 w-full" />
          ) : (links as RedirectLink[]).length === 0 ? (
            <p className="text-sm text-gray-500">No redirects yet.</p>
          ) : (
            <ul className="space-y-3">
              {(links as RedirectLink[]).map((link) => {
                const url = `${siteUrl}/go/${link.slug}`;
                return (
                  <li
                    key={link.id}
                    className={`rounded-lg border p-3 ${editingId === link.id ? "border-gold-500" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-navy-800 dark:text-white truncate">
                          {link.title || link.slug}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{url}</p>
                        <p className="text-xs text-gray-500 truncate mt-1">{link.destination_url}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {link.clicks_count} clicks · {link.is_active ? "Active" : "Paused"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="p-2 text-gray-500 hover:text-gold-600"
                          title="Copy link"
                          onClick={() => copyLink(url)}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-gold-600"
                          title="Test redirect"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          className="p-2 text-gray-500 hover:text-gold-600"
                          onClick={() => setEditingId(link.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="p-2 text-gray-500 hover:text-red-600"
                          onClick={() => {
                            if (confirm("Delete this redirect?")) deleteMutation.mutate(link.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {editingId ? (
        <section className="rounded-xl border bg-white dark:bg-navy-800 p-6 space-y-4">
          <h3 className="font-semibold text-navy-800 dark:text-white">Click activity</h3>
          {stats?.by_country?.length ? (
            <div className="flex flex-wrap gap-2">
              {stats.by_country.map((row: { country: string; clicks: number }) => (
                <span key={row.country} className="text-xs px-2 py-1 rounded-full bg-navy-100 dark:bg-navy-900">
                  {row.country}: {row.clicks}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No location data yet.</p>
          )}
          {loadingClicks ? (
            <Shimmer className="h-20 w-full" />
          ) : (clicks as RedirectClick[]).length === 0 ? (
            <p className="text-sm text-gray-500">No clicks recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Referrer</th>
                    <th className="py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(clicks as RedirectClick[]).map((click) => (
                    <tr key={click.id} className="border-b border-gray-100 dark:border-navy-700">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(click.clicked_at)}</td>
                      <td className="py-2 pr-3">{locationLabel(click)}</td>
                      <td className="py-2 pr-3 max-w-[220px] truncate">{click.referer || "Direct"}</td>
                      <td className="py-2">{click.ip_address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
