/**
 * Normalize page titles from the API (often suffixed with "| KigaliRent")
 * so the layout template can append "| Kigali Rent" once.
 */
export function normalizeSeoTitle(title: string): string {
  return title
    .replace(/\s*\|\s*KigaliRent\s*$/i, "")
    .replace(/\s*\|\s*Kigali Rent\s*$/i, "")
    .trim();
}

export function buildFaqPageJsonLd(faqs: { question: string; answer: string }[]) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      },
    })),
  };
}
