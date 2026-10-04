import { formatPrice } from "@/lib/utils";

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

/** Page-specific Open Graph block; pages without one would inherit only the root brand defaults. */
export function pageOpenGraph(opts: {
  title: string;
  description?: string;
  url?: string;
  image?: string | null;
  imageAlt?: string;
}) {
  return {
    title: opts.title,
    description: opts.description,
    url: opts.url,
    type: "website" as const,
    siteName: "Kigali Rent",
    locale: "en_RW",
    images: opts.image
      ? [{ url: opts.image, alt: opts.imageAlt || opts.title }]
      : [{ url: "/logo.png", width: 512, height: 512, alt: "Kigali Rent logo" }],
  };
}

export function buildPropertyMetaDescription(property: {
  title: string;
  short_description?: string | null;
  meta_description?: string | null;
  neighborhood_name?: string | null;
  district_name?: string | null;
  price: number;
  currency?: string;
  price_period?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  listing_type?: string;
}): string {
  if (property.meta_description?.trim()) return property.meta_description.trim();
  if (property.short_description?.trim()) return property.short_description.trim();

  const location = property.neighborhood_name || property.district_name || "Kigali";
  const priceBit = formatPrice(
    property.price,
    property.currency || "USD",
    property.listing_type !== "sale" ? property.price_period : null,
  );
  const specs = [
    property.bedrooms != null ? `${property.bedrooms} bed` : null,
    property.bathrooms != null ? `${property.bathrooms} bath` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `${property.title} in ${location} — ${priceBit}${specs ? `. ${specs}` : ""}. Listed on Kigali Rent.`;
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
