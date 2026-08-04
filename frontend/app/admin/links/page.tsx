"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";

interface LinksForm {
  booking_url: string;
  book_consultation_url: string;
  phone: string;
  whatsapp: string;
}

const emptyLinks: LinksForm = {
  booking_url: "",
  book_consultation_url: "",
  phone: "",
  whatsapp: "",
};

export default function AdminLinksPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LinksForm>(emptyLinks);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminService.getSettings,
  });

  useEffect(() => {
    if (!settings) return;
    const links = (settings as Record<string, Record<string, string>>).links || {};
    const site = (settings as Record<string, Record<string, string>>).site || {};
    setForm({
      booking_url: links.booking_url || site.booking_url || "",
      book_consultation_url: links.book_consultation_url || links.booking_url || site.booking_url || "",
      phone: links.phone || site.phone || "",
      whatsapp: links.whatsapp || site.whatsapp || "",
    });
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      adminService.updateSettings([
        {
          key: "links",
          value: {
            booking_url: form.booking_url.trim(),
            book_consultation_url: form.book_consultation_url.trim() || form.booking_url.trim(),
            phone: form.phone.trim(),
            whatsapp: form.whatsapp.trim().replace(/\D/g, ""),
          },
        },
      ]),
    onSuccess: () => {
      setSaveMessage("Links saved. Refresh the website to see changes on all buttons.");
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: () => {
      setSaveError("Failed to save links.");
      setSaveMessage(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Links</h2>
        <p className="text-sm text-gray-500 mt-1">
          Control booking, call, and WhatsApp URLs used in the navbar, hero, footer, floating buttons, and property pages.
        </p>
      </div>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Booking links</h3>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Book Visit (navbar, hero, footer)</label>
          <input
            className="lux-input mt-1"
            placeholder="https://your-booking-page.com"
            value={form.booking_url}
            onChange={(e) => setForm({ ...form, booking_url: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Used for &quot;Book Visit&quot; in the menu, &quot;Book a Visit&quot; in the hero and footer.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Book Free Consultation (homepage CTA)</label>
          <input
            className="lux-input mt-1"
            placeholder="Same as booking URL or a separate consultation link"
            value={form.book_consultation_url}
            onChange={(e) => setForm({ ...form, book_consultation_url: e.target.value })}
          />
        </div>
      </section>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Call & WhatsApp</h3>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone (display & call button)</label>
          <input
            className="lux-input mt-1"
            placeholder="+250 784 806 641"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Used in the top bar, footer, and floating call button.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp number</label>
          <input
            className="lux-input mt-1"
            placeholder="250784806641"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Digits only, no + sign. Used for WhatsApp buttons site-wide.</p>
        </div>
      </section>

      {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      <Button className="rounded-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Saving..." : "Save Links"}
      </Button>
    </div>
  );
}
