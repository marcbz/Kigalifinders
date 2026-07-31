"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";
import { Plus, Trash2 } from "lucide-react";

type SettingsMap = Record<string, Record<string, unknown>>;

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [site, setSite] = useState<Record<string, string>>({});
  const [social, setSocial] = useState<Record<string, string>>({});
  const [legal, setLegal] = useState<Record<string, string>>({});
  const [faqForm, setFaqForm] = useState({ question: "", answer: "" });

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
    setSite((s.site as Record<string, string>) || {});
    setSocial((s.social as Record<string, string>) || {});
    setLegal((s.legal as Record<string, string>) || {});
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: () =>
      adminService.updateSettings([
        { key: "site", value: site },
        { key: "social", value: social },
        { key: "legal", value: legal },
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
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
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Site Settings</h2>

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Contact & Office</h3>
        {["phone", "whatsapp", "address", "hours", "booking_url", "email"].map((key) => (
          <input
            key={key}
            className="lux-input"
            placeholder={key.replace("_", " ")}
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

      <section className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
        <h3 className="font-semibold">Legal Pages</h3>
        <textarea className="lux-input min-h-[120px]" placeholder="Privacy Policy" value={legal.privacy_policy || ""} onChange={(e) => setLegal({ ...legal, privacy_policy: e.target.value })} />
        <textarea className="lux-input min-h-[120px]" placeholder="Terms of Service" value={legal.terms_of_service || ""} onChange={(e) => setLegal({ ...legal, terms_of_service: e.target.value })} />
        <textarea className="lux-input min-h-[80px]" placeholder="Sitemap notes / URLs" value={legal.sitemap || ""} onChange={(e) => setLegal({ ...legal, sitemap: e.target.value })} />
      </section>

      <Button className="rounded-full" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
        {saveSettings.isPending ? "Saving..." : "Save Settings"}
      </Button>

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
