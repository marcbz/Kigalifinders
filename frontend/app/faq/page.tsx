import type { Metadata } from "next";
import { fetchFaqsSafe } from "@/lib/server-api";
import { FAQSection } from "@/features/home/faq-section";
import { buildFaqPageJsonLd, pageOpenGraph } from "@/lib/seo-metadata";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Renting in Kigali: Frequently Asked Questions",
  description:
    "Answers to common questions about renting and buying property in Kigali: prices, neighbourhoods, deposits, viewings and furnished homes.",
  alternates: { canonical: "https://kigalirent.com/faq" },
  openGraph: pageOpenGraph({
    title: "Renting in Kigali: Frequently Asked Questions",
    url: "https://kigalirent.com/faq",
  }),
};

export default async function FAQPage() {
  const faqs = await fetchFaqsSafe();
  const faqJsonLd = buildFaqPageJsonLd(faqs);

  return (
    <>
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <FAQSection faqs={faqs} headingLevel="h1" heading="Renting in Kigali: your questions answered" />
    </>
  );
}
