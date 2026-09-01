const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

type RentalListing = {
  title: string;
  slug: string;
  price?: number;
  usd_price?: number;
  currency?: string;
};

type FaqPair = { q: string; a: string };

export function buildRentalBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  if (!items.length) return null;
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

export function buildRentalItemListJsonLd(
  listings: RentalListing[],
  pageUrl: string,
  listName: string,
) {
  if (!listings.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: pageUrl,
    numberOfItems: listings.length,
    itemListElement: listings.map((listing, index) => {
      const price = listing.usd_price ?? listing.price;
      const offer =
        price != null
          ? {
              "@type": "Offer",
              price,
              priceCurrency: listing.currency || "USD",
            }
          : undefined;
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "RealEstateListing",
          name: listing.title,
          url: `${SITE}/properties/${encodeURIComponent(listing.slug)}`,
          ...(offer ? { offers: offer } : {}),
        },
      };
    }),
  };
}

export function buildRentalFaqJsonLd(faqs: FaqPair[]) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

export function formatCitationDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function buildRentalCitationText(opts: {
  topic: string;
  canonicalUrl: string;
  lastUpdated?: string | null;
  listingCount?: number;
}): string {
  const date = formatCitationDate(opts.lastUpdated) || "n.d.";
  const countBit =
    opts.listingCount != null && opts.listingCount > 0
      ? ` Based on ${opts.listingCount} verified listing${opts.listingCount === 1 ? "" : "s"}.`
      : "";
  return `Kigali Rent. "${opts.topic}." ${date}. ${opts.canonicalUrl}.${countBit}`;
}
