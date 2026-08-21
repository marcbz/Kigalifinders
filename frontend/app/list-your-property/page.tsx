"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { contentService } from "@/services/api";

export default function ListYourPropertyPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      await contentService.contact({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: "Landlord listing request",
        message: `Area/neighborhood: ${area.trim()}\n\n${details.trim()}`,
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">OWNERS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">List Your Property</h1>
          <p className="text-gray-300 mt-4">
            Tell us about your home or plot — Kigali Rent will follow up to feature it on the marketplace.
          </p>
        </div>
      </div>
      <section className="py-16 px-6">
        <div className="max-w-xl mx-auto">
          {status === "success" ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-green-800">
              Thanks — we received your listing request and will contact you shortly.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-card border rounded-xl p-6">
              {status === "error" && (
                <p className="text-sm text-red-500">Could not send. Please try again or WhatsApp us.</p>
              )}
              <input className="lux-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input type="email" className="lux-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="tel" className="lux-input" placeholder="Phone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <input className="lux-input" placeholder="Neighborhood / area" value={area} onChange={(e) => setArea(e.target.value)} required />
              <textarea
                className="lux-input min-h-[140px]"
                placeholder="Property type, bedrooms, rent or sale price, furnished?, and anything important..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
              />
              <Button type="submit" className="rounded-full w-full" disabled={status === "loading"}>
                {status === "loading" ? "Sending..." : "Submit listing request"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
