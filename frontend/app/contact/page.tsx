"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { contentService } from "@/services/api";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await contentService.contact(form);
    setSubmitted(true);
  };

  return (
    <div className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">GET IN TOUCH</span>
          <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mt-3">Contact Us</h1>
        </div>
        {submitted ? (
          <p className="text-center text-green-600 text-lg">Thank you! We&apos;ll be in touch soon.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input className="lux-input" placeholder="Your Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="lux-input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="lux-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="lux-input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <textarea className="lux-input min-h-[150px]" placeholder="Message" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <Button type="submit" className="w-full rounded-full">Send Message</Button>
          </form>
        )}
      </div>
    </div>
  );
}
