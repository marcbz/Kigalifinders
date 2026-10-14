type MarketAnswer = {
  question?: string;
  headline?: string | null;
  plain_english?: string | null;
  summary?: string;
  sample_size?: number;
  period_end?: string | null;
};

function answerText(a: MarketAnswer): string {
  const bits = [a.headline, a.plain_english || a.summary]
    .map((s) => (s || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (a.sample_size) bits.push(`Based on ${a.sample_size} eligible observations.`);
  if (a.period_end) bits.push(`Period through ${a.period_end}.`);
  return bits.join(" ") || "See the Kigali Rent research page for the latest asking-rent estimates.";
}

/** FAQPage JSON-LD from research market answers — targets “Kigali rental prices” queries. */
export function buildResearchFaqJsonLd(answers: MarketAnswer[]) {
  const entities = answers
    .filter((a) => a.question?.trim())
    .slice(0, 10)
    .map((a) => ({
      "@type": "Question",
      name: a.question!.trim(),
      acceptedAnswer: {
        "@type": "Answer",
        text: answerText(a),
      },
    }));
  if (!entities.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  };
}

export function buildResearchBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
