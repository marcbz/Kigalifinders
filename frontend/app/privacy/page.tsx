import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { fetchLegalSafe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kigali Rent collects, uses, and protects your personal information.",
};

export default async function PrivacyPage() {
  const legal = await fetchLegalSafe();

  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">LEGAL</span>
        <LegalDocument content={legal.privacy_policy} />
      </div>
    </div>
  );
}
