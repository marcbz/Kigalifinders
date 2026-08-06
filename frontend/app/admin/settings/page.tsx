"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";
import { getApiErrorMessage } from "@/lib/utils";

type SettingsMap = Record<string, Record<string, unknown>>;

function parseSitePayload(site: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...site };
  if (site.latitude?.trim()) {
    const lat = parseFloat(site.latitude);
    if (!Number.isNaN(lat)) payload.latitude = lat;
  } else {
    delete payload.latitude;
  }
  if (site.longitude?.trim()) {
    const lng = parseFloat(site.longitude);
    if (!Number.isNaN(lng)) payload.longitude = lng;
  } else {
    delete payload.longitude;
  }
  return payload;
}

function parseLegalFromSettings(legalData: Record<string, unknown> | undefined): Record<string, string> {
  if (!legalData) return { privacy_policy: "", terms_of_service: "", sitemap_intro: "" };
  return {
    privacy_policy: String(legalData.privacy_policy || ""),
    terms_of_service: String(legalData.terms_of_service || ""),
    sitemap_intro: String(legalData.sitemap_intro || legalData.sitemap || ""),
  };
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [site, setSite] = useState<Record<string, string>>({});
  const [hero, setHero] = useState<Record<string, string>>({});
  const [social, setSocial] = useState<Record<string, string>>({});
  const [legal, setLegal] = useState<Record<string, string>>({
    privacy_policy: "",
    terms_of_service: "",
    sitemap_intro: "",
  });
  const [faqForm, setFaqForm] = useState({ question: "", answer: "" });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [legalMessage, setLegalMessage] = useState<string | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: adminService.getSettings,
  });

  const { data: faqs = [], refetch: refetchFaqs } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: adminService.faqs,
  });

  useEffect(() => {
    if (!settings) return;
    const s = settings as SettingsMap;
    const siteData = (s.site as Record<string, unknown>) || {};
    setSite({
      phone: String(siteData.phone || ""),
      whatsapp: String(siteData.whatsapp || ""),
      address: String(siteData.address || ""),
      hours: String(siteData.hours || ""),
      booking_url: String(siteData.booking_url || ""),
      email: String(siteData.email || ""),
      latitude: siteData.latitude != null ? String(siteData.latitude) : "",
      longitude: siteData.longitude != null ? String(siteData.longitude) : "",
    });
    const heroData = (s.hero as Record<string, unknown>) || {};
    setHero({
      tagline: String(heroData.tagline || ""),
      title: String(heroData.title || ""),
      subtitle: String(heroData.subtitle || ""),
      background_image: String(heroData.background_image || ""),
      cta_primary: String(heroData.cta_primary || ""),
      cta_secondary: String(heroData.cta_secondary || ""),
    });
    setSocial((s.social as Record<string, string>) || {});
    setLegal(parseLegalFromSettings(s.legal as Record<string, unknown>));
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: () =>
      adminService.updateSettings([
        { key: "site", value: parseSitePayload(site) },
        { key: "hero", value: hero },
        { key: "social", value: social },
      ]),
    onSuccess: () => {
      setSaveMessage("Settings saved. Refresh the homepage to see updates.");
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err) => {
      setSaveError(getApiErrorMessage(err, "Failed to save settings. Please try again."));
      setSaveMessage(null);
    },
  });

  const saveLegal = useMutation({
    mutationFn: () =>
      adminService.updateLegalSettings({
        privacy_policy: legal.privacy_policy || "",
        terms_of_service: legal.terms_of_service || "",
        sitemap_intro: legal.sitemap_intro || "",
      }),
    onSuccess: () => {
      setLegalMessage("Legal pages saved. View them using the preview links below.");
      setLegalError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err) => {
      setLegalError(getApiErrorMessage(err, "Failed to save legal pages. Please try again."));
      setLegalMessage(null);
    },
  });

  const createFaq = useMutation({
    mutationFn: () => adminService.createFaq(faqForm),
    onSuccess: () => {
      setFaqForm({ question: "", answer: "" });
      refetchFaqs();
    },
  });

  const deleteFaq = useMutation({
    mutationFn: adminService.deleteFaq,
    onSuccess: () => refetchFaqs(),
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
    <div className="space-y-10 max-w-3xl">
      <div>
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Site Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Updates apply to the homepage hero, contact section, map, and CTAs.</p>
      </div>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Homepage Hero</h3>
        {["tagline", "title", "subtitle", "background_image", "cta_primary", "cta_secondary"].map((key) => (
          <input
            key={key}
            className="lux-input"
            placeholder={key.replace(/_/g, " ")}
            value={hero[key] || ""}
            onChange={(e) => setHero({ ...hero, [key]: e.target.value })}
          />
        ))}
        <p className="text-xs text-gray-500">Booking button uses the booking URL from Contact & Office below.</p>
      </section>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Contact & Office</h3>
        {["phone", "whatsapp", "address", "hours", "booking_url", "email"].map((key) => (
          <input
            key={key}
            className="lux-input"
            placeholder={key.replace(/_/g, " ")}
            value={site[key] || ""}
            onChange={(e) => setSite({ ...site, [key]: e.target.value })}
          />
        ))}
        <div className="grid grid-cols-2 gap-4">
          <input className="lux-input" placeholder="Office latitude" value={site.latitude || ""} onChange={(e) => setSite({ ...site, latitude: e.target.value })} />
          <input className="lux-input" placeholder="Office longitude" value={site.longitude || ""} onChange={(e) => setSite({ ...site, longitude: e.target.value })} />
        </div>
        <p className="text-xs text-gray-500">Office coordinates are used for the map on the homepage.</p>
      </section>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Social Media</h3>
        {["facebook", "instagram", "twitter", "linkedin", "youtube"].map((key) => (
          <input
            key={key}
            className="lux-input"
            placeholder={key}
            value={social[key] || ""}
            onChange={(e) => setSocial({ ...social, [key]: e.target.value })}
          />
        ))}
      </section>

      {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      <Button className="rounded-full" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
        {saveSettings.isPending ? "Saving..." : "Save Site Settings"}
      </Button>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-5">
        <div>
          <h3 className="font-semibold">Legal Pages</h3>
          <p className="text-sm text-gray-500 mt-1">
            Edit Privacy Policy, Terms of Service, and the sitemap intro. Property and blog links on the sitemap page are generated automatically.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-navy-800 dark:text-white">Privacy Policy</label>
          <textarea
            className="lux-input min-h-[280px] font-mono text-sm"
            value={legal.privacy_policy || ""}
            onChange={(e) => setLegal({ ...legal, privacy_policy: e.target.value })}
          />
          <Link href="/privacy" target="_blank" className="inline-flex items-center gap-1 text-xs text-gold-600 hover:underline">
            Preview <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-navy-800 dark:text-white">Terms of Service</label>
          <textarea
            className="lux-input min-h-[280px] font-mono text-sm"
            value={legal.terms_of_service || ""}
            onChange={(e) => setLegal({ ...legal, terms_of_service: e.target.value })}
          />
          <Link href="/terms" target="_blank" className="inline-flex items-center gap-1 text-xs text-gold-600 hover:underline">
            Preview <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-navy-800 dark:text-white">Sitemap Intro</label>
          <textarea
            className="lux-input min-h-[100px] font-mono text-sm"
            placeholder="Short introduction shown at the top of the sitemap page"
            value={legal.sitemap_intro || ""}
            onChange={(e) => setLegal({ ...legal, sitemap_intro: e.target.value })}
          />
          <Link href="/sitemap" target="_blank" className="inline-flex items-center gap-1 text-xs text-gold-600 hover:underline">
            Preview <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {legalMessage && <p className="text-sm text-green-600">{legalMessage}</p>}
        {legalError && <p className="text-sm text-red-500">{legalError}</p>}

        <Button className="rounded-full" onClick={() => saveLegal.mutate()} disabled={saveLegal.isPending}>
          {saveLegal.isPending ? "Saving..." : "Save Legal Pages"}
        </Button>
      </section>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">FAQs</h3>
        <input className="lux-input" placeholder="Question" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} />
        <textarea className="lux-input min-h-[80px]" placeholder="Answer" value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} />
        <Button variant="outline" className="rounded-full gap-2" onClick={() => createFaq.mutate()}>
          <Plus className="w-4 h-4" /> Add FAQ
        </Button>
        <div className="space-y-2 mt-4">
          {(faqs as { id: string; question: string }[]).map((faq) => (
            <div key={faq.id} className="flex justify-between items-center border rounded-lg p-3 text-sm">
              <span>{faq.question}</span>
              <button type="button" onClick={() => deleteFaq.mutate(faq.id)} className="text-red-500 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
