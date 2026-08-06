import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { fetchLegalSafe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using Kigali Rent and our property services in Kigali.",
};

export default async function TermsPage() {
  const legal = await fetchLegalSafe();

  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">LEGAL</span>
        <LegalDocument content={legal.terms_of_service} />
      </div>
    </div>
  );
}
