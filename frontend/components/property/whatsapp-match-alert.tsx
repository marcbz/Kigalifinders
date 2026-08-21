"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function WhatsAppMatchAlert({ whatsapp }: { whatsapp?: string }) {
  const searchParams = useSearchParams();
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState("");
  const [beds, setBeds] = useState(searchParams.get("bedrooms") || "");

  const phone = digitsOnly(whatsapp || "250784806641");

  const href = useMemo(() => {
    const listing = searchParams.get("listing_type") || "any";
    const lines = [
      "Hi Kigali Rent — please WhatsApp me when a matching listing appears.",
      `Looking for: ${listing}`,
      beds ? `Bedrooms: ${beds}` : null,
      area.trim() ? `Area: ${area.trim()}` : null,
      budget.trim() ? `Budget: ${budget.trim()}` : null,
      `Current search: https://kigalirent.com/properties?${searchParams.toString()}`,
    ].filter(Boolean);
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [area, beds, budget, phone, searchParams]);

  return (
    <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5 mb-8">
      <div className="flex items-start gap-3 mb-3">
        <MessageCircle className="w-5 h-5 text-gold-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-navy-800 dark:text-white">WhatsApp me when a match appears</h3>
          <p className="text-sm text-gray-500 mt-1">
            Tell us your budget and area — we&apos;ll message you on WhatsApp when something fits.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          className="lux-input"
          placeholder="Budget (e.g. under $800)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <input
          className="lux-input"
          placeholder="Preferred area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <input
          className="lux-input"
          placeholder="Bedrooms"
          value={beds}
          onChange={(e) => setBeds(e.target.value)}
        />
      </div>
      <Button asChild className="rounded-full mt-3 gap-2">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="w-4 h-4" />
          Send WhatsApp alert request
        </a>
      </Button>
    </div>
  );
}
