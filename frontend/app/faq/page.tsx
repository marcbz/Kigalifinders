import type { Metadata } from "next";
import { fetchFaqsSafe } from "@/lib/server-api";
import { FAQSection } from "@/features/home/faq-section";
import { buildFaqPageJsonLd } from "@/lib/seo-metadata";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about renting and buying property in Kigali.",
};

export default async function FAQPage() {
  const faqs = await fetchFaqsSafe();
  const faqJsonLd = buildFaqPageJsonLd(faqs);

  return (
    <>
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <FAQSection faqs={faqs} />
    </>
  );
}
