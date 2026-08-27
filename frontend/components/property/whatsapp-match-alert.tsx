"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentService } from "@/services/api";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export type MatchAlertDefaults = {
  area?: string;
  bedrooms?: string;
  budget?: string;
  intent?: "rent" | "buy" | "";
  searchLabel?: string;
  searchUrl?: string;
  propertyType?: string;
  furnished?: boolean | null;
};

export function WhatsAppMatchAlert({
  whatsapp,
  defaults,
}: {
  whatsapp?: string;
  defaults?: MatchAlertDefaults;
}) {
  const searchParams = useSearchParams();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState(defaults?.budget || "");
  const [area, setArea] = useState(defaults?.area || "");
  const [beds, setBeds] = useState(
    defaults?.bedrooms || searchParams.get("bedrooms") || "",
  );
  const [intent, setIntent] = useState<"rent" | "buy" | "">(
    defaults?.intent ||
      (searchParams.get("listing_type") === "sale"
        ? "buy"
        : searchParams.get("listing_type") === "rent" ||
            searchParams.get("listing_type") === "furnished"
          ? "rent"
          : ""),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const phone = digitsOnly(whatsapp || "250784806641");
  const searchUrl =
    defaults?.searchUrl ||
    `https://kigalirent.com/properties?${searchParams.toString()}`;
  const searchLabel = defaults?.searchLabel || "property search";

  const href = useMemo(() => {
    const lookingFor = intent === "buy" ? "buy" : intent === "rent" ? "rent" : "any";
    const typeBit = defaults?.propertyType
      ? defaults.propertyType.replace(/-/g, " ")
      : null;
    const furnishedBit =
      defaults?.furnished === true
        ? "furnished"
        : defaults?.furnished === false
          ? "unfurnished"
          : null;
    const lines = [
      "Hi KigaliRent, I'd like to receive WhatsApp alerts when a rental matching my preferences becomes available.",
      `Search: ${searchLabel}`,
      email.trim() ? `Email: ${email.trim()}` : null,
      `Looking for: ${lookingFor}`,
      typeBit ? `Property type: ${typeBit}` : null,
      furnishedBit ? `Furnishing: ${furnishedBit}` : null,
      beds ? `Bedrooms: ${beds}` : null,
      area.trim() ? `Area: ${area.trim()}` : null,
      budget.trim() ? `Budget: ${budget.trim()}` : null,
      "Please let me know when a matching property is listed.",
      `Page: ${searchUrl}`,
    ].filter(Boolean);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [
    area,
    beds,
    budget,
    defaults?.furnished,
    defaults?.propertyType,
    email,
    intent,
    phone,
    searchLabel,
    searchUrl,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSubmit = async () => {
    setError("");
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email so we can save your alert.");
      return;
    }
    setSaving(true);
    try {
      await contentService.listingAlert({
        email: trimmed,
        budget: budget.trim() || undefined,
        area: area.trim() || undefined,
        bedrooms: beds || undefined,
        intent: intent || "any",
        search_url: searchUrl,
      });
      window.open(href, "_blank", "noopener,noreferrer");
      setOpen(false);
    } catch {
      setError("Could not save the alert. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <MessageCircle className="w-5 h-5 text-gold-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-navy-800 dark:text-white">
              Want to know when a matching rental appears?
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Get a WhatsApp alert when a property matching your rental preferences is listed.
            </p>
          </div>
        </div>
        <div className="flex w-full sm:justify-center">
          <Button
            type="button"
            className="rounded-full gap-2 shrink-0 w-full sm:w-auto"
            onClick={() => setOpen(true)}
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp me when a match appears
          </Button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-navy-900/55 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl shadow-xl border border-gold-500/20 p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id={titleId} className="font-serif text-xl font-bold text-navy-800 dark:text-white">
                  Match alert
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  We save your preferences, then open WhatsApp so you can confirm.
                </p>
                {searchLabel ? (
                  <p className="text-xs text-gray-500 mt-2">Based on: {searchLabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">
                  EMAIL
                </label>
                <input
                  type="email"
                  required
                  className="lux-input w-full"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">
                  BUDGET
                </label>
                <input
                  className="lux-input w-full"
                  placeholder="Budget (e.g. under $800)"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">
                  PREFERRED AREA
                </label>
                <input
                  className="lux-input w-full"
                  placeholder="Preferred area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">
                  BEDROOMS
                </label>
                <select className="lux-input w-full" value={beds} onChange={(e) => setBeds(e.target.value)}>
                  <option value="">Any</option>
                  {["1", "2", "3", "4", "5"].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">
                  LOOKING TO
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "rent", label: "Rent" },
                      { id: "buy", label: "Buy" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIntent(opt.id)}
                      className={`rounded-full border px-3 py-2.5 text-sm font-semibold transition ${
                        intent === opt.id
                          ? "border-navy-800 bg-navy-800 text-gold-500"
                          : "border-gray-200 dark:border-border text-navy-800 dark:text-gray-200 hover:border-gold-500/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}

            <Button
              type="button"
              className="rounded-full mt-5 gap-2 w-full"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Save alert &amp; WhatsApp
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
