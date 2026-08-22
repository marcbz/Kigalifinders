"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function WhatsAppMatchAlert({ whatsapp }: { whatsapp?: string }) {
  const searchParams = useSearchParams();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState("");
  const [beds, setBeds] = useState(searchParams.get("bedrooms") || "");
  const [intent, setIntent] = useState<"rent" | "buy" | "">(
    searchParams.get("listing_type") === "sale"
      ? "buy"
      : searchParams.get("listing_type") === "rent" || searchParams.get("listing_type") === "furnished"
        ? "rent"
        : "",
  );

  const phone = digitsOnly(whatsapp || "250784806641");

  const href = useMemo(() => {
    const lookingFor = intent === "buy" ? "buy" : intent === "rent" ? "rent" : "any";
    const lines = [
      "Hi Kigali Rent — please WhatsApp me when a matching listing appears.",
      `Looking for: ${lookingFor}`,
      beds ? `Bedrooms: ${beds}` : null,
      area.trim() ? `Area: ${area.trim()}` : null,
      budget.trim() ? `Budget: ${budget.trim()}` : null,
      `Current search: https://kigalirent.com/properties?${searchParams.toString()}`,
    ].filter(Boolean);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [area, beds, budget, intent, phone, searchParams]);

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

  return (
    <>
      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <MessageCircle className="w-5 h-5 text-gold-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-navy-800 dark:text-white">
              WhatsApp me when a match appears
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Tell us your budget and area — we&apos;ll message you on WhatsApp when something fits.
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="rounded-full gap-2 shrink-0 w-full sm:w-auto"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="w-4 h-4" />
          Set up alert
        </Button>
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
                  WhatsApp match alert
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Tell us your budget and area — we&apos;ll message you on WhatsApp when something fits.
                </p>
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
                  {["1+", "2+", "3+", "4+", "5+"].map((b) => (
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

            <Button asChild className="rounded-full mt-5 gap-2 w-full">
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <MessageCircle className="w-4 h-4" />
                Send on WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
