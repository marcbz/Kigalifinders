"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { contentService } from "@/services/api";

export function PropertyInquiryForm({
  propertyId,
  propertyTitle,
}: {
  propertyId: string;
  propertyTitle: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      await contentService.viewingRequest({
        property_id: propertyId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });
      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
      setError("Failed to send message. Please try again or call us directly.");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-300">
        Thank you! We received your message about <strong>{propertyTitle}</strong>. Our team will contact you shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-6 mt-6">
      <h3 className="font-semibold text-navy-800 dark:text-white">Send a Message</h3>
      <p className="text-xs text-gray-500">Ask about this property — we&apos;ll reply via email or phone.</p>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <input className="lux-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input type="email" className="lux-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="tel" className="lux-input" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <textarea
        className="lux-input min-h-[100px]"
        placeholder="Your message about this property..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      <Button type="submit" className="w-full rounded-full" disabled={status === "loading"}>
        {status === "loading" ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
