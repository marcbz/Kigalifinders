const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

export type RentalListing = {
  title: string;
  slug: string;
  price?: number;
  usd_price?: number;
  currency?: string;
  primary_image?: string | null;
  primary_image_alt?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  neighborhood_name?: string | null;
  district_name?: string | null;
  property_type_name?: string | null;
  is_furnished?: boolean | null;
  listing_type?: string | null;
};

type FaqPair = { q: string; a: string };

function absoluteImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, `${SITE}/`).toString();
  } catch {
    return null;
  }
}

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

function buildRentalItemListEntity(
  listings: RentalListing[],
  pageUrl: string,
  listName: string,
): Record<string, unknown> | null {
  if (!listings.length) return null;
  return {
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
              availability: "https://schema.org/InStock",
              businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
            }
          : undefined;

      const imageUrl = absoluteImageUrl(listing.primary_image);
      const addressLocality = listing.neighborhood_name || listing.district_name;
      const address =
        addressLocality || listing.district_name
          ? {
              "@type": "PostalAddress",
              addressCountry: "RW",
              ...(addressLocality ? { addressLocality } : {}),
              ...(listing.district_name ? { addressRegion: listing.district_name } : {}),
            }
          : undefined;

      const item: Record<string, unknown> = {
        "@type": "RealEstateListing",
        name: listing.title,
        url: `${SITE}/properties/${encodeURIComponent(listing.slug)}`,
      };
      if (offer) item.offers = offer;
      if (imageUrl) {
        item.image = [
          {
            "@type": "ImageObject",
            url: imageUrl,
            caption: listing.primary_image_alt || listing.title,
          },
        ];
      }
      if (listing.bedrooms != null) item.numberOfRooms = listing.bedrooms;
      if (listing.bathrooms != null) item.numberOfBathroomsTotal = listing.bathrooms;
      if (address) item.address = address;
      if (listing.is_furnished) item.furnished = true;
      if (listing.property_type_name || listing.bedrooms != null) {
        const placeType = (listing.property_type_name || "").toLowerCase().includes("house")
          ? "House"
          : (listing.property_type_name || "").toLowerCase().includes("land") ||
              (listing.property_type_name || "").toLowerCase().includes("plot")
            ? "Land"
            : "Apartment";
        item.itemOffered = {
          "@type": placeType,
          name: listing.title,
          ...(address ? { address } : {}),
          ...(listing.bedrooms != null ? { numberOfRooms: listing.bedrooms } : {}),
          ...(listing.bathrooms != null ? { numberOfBathroomsTotal: listing.bathrooms } : {}),
          ...(imageUrl ? { image: imageUrl } : {}),
        };
      }

      return {
        "@type": "ListItem",
        position: index + 1,
        item,
      };
    }),
  };
}

/** Collection + ItemList with listing images — signals Google can use for SERP thumbnails. */
export function buildRentalCollectionPageJsonLd(opts: {
  name: string;
  description?: string;
  pageUrl: string;
  listings: RentalListing[];
}) {
  const itemList = buildRentalItemListEntity(opts.listings, opts.pageUrl, opts.name);
  if (!itemList) return null;

  const images = opts.listings
    .map((l) => absoluteImageUrl(l.primary_image))
    .filter((url): url is string => Boolean(url))
    .slice(0, 12);

  const page: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${opts.pageUrl}#webpage`,
    url: opts.pageUrl,
    name: opts.name,
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": `${SITE}/#organization` },
    inLanguage: "en-RW",
    mainEntity: itemList,
  };
  if (opts.description) page.description = opts.description;
  if (images.length) {
    page.image = images;
    page.primaryImageOfPage = {
      "@type": "ImageObject",
      url: images[0],
    };
  }
  return page;
}

export function buildRentalItemListJsonLd(
  listings: RentalListing[],
  pageUrl: string,
  listName: string,
) {
  const entity = buildRentalItemListEntity(listings, pageUrl, listName);
  if (!entity) return null;
  return { "@context": "https://schema.org", ...entity };
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
