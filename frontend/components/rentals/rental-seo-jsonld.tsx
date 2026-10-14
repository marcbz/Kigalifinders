import {
  buildRentalBreadcrumbJsonLd,
  buildRentalCollectionPageJsonLd,
  buildRentalFaqJsonLd,
  type RentalListing,
} from "@/lib/rental-jsonld";
import type { RentalHubData } from "@/components/rentals/rental-hub-page";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

function JsonLdScript({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

function asRentalListings(
  listings: Array<{
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
  }>,
): RentalListing[] {
  return listings.map((l) => ({
    title: l.title,
    slug: l.slug,
    price: l.price,
    usd_price: l.usd_price,
    currency: l.currency,
    primary_image: l.primary_image,
    primary_image_alt: l.primary_image_alt,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    neighborhood_name: l.neighborhood_name,
    district_name: l.district_name,
    property_type_name: l.property_type_name,
    is_furnished: l.is_furnished,
  }));
}

export function RentalHubSeoJsonLd({ data }: { data: RentalHubData }) {
  const canonical = data.canonical || `${SITE}${data.path}`;
  const crumbs: { name: string; url: string }[] = [
    { name: "Home", url: SITE },
    { name: "Rentals", url: `${SITE}/rentals` },
  ];
  if (data.page_type === "city" && data.location_slug) {
    crumbs.push({ name: "Kigali", url: `${SITE}/rentals/kigali` });
  } else if (data.page_type === "neighborhood" && data.location_name) {
    crumbs.push({
      name: data.location_name,
      url: `${SITE}/rentals/${encodeURIComponent(data.location_slug || "")}`,
    });
  }

  const listings = asRentalListings(data.verified_listings || []);
  const breadcrumb = buildRentalBreadcrumbJsonLd(crumbs);
  const collection = buildRentalCollectionPageJsonLd({
    name: data.h1,
    description: data.meta_description || data.intro,
    pageUrl: canonical,
    listings,
  });
  const faq = buildRentalFaqJsonLd(data.faqs || []);

  return (
    <>
      <JsonLdScript data={breadcrumb} />
      <JsonLdScript data={collection} />
      <JsonLdScript data={faq} />
    </>
  );
}

type IntentPageJsonLdProps = {
  h1: string;
  canonical: string;
  description?: string;
  locationSlug: string;
  locationLabel: string;
  listings: RentalListing[];
};

export function RentalIntentSeoJsonLd({
  h1,
  canonical,
  description,
  locationSlug,
  locationLabel,
  listings,
}: IntentPageJsonLdProps) {
  const breadcrumb = buildRentalBreadcrumbJsonLd([
    { name: "Home", url: SITE },
    { name: "Rentals", url: `${SITE}/rentals` },
    { name: locationLabel, url: `${SITE}/rentals/${encodeURIComponent(locationSlug)}` },
    { name: h1, url: canonical },
  ]);
  const collection = buildRentalCollectionPageJsonLd({
    name: h1,
    description,
    pageUrl: canonical,
    listings: asRentalListings(listings),
  });

  return (
    <>
      <JsonLdScript data={breadcrumb} />
      <JsonLdScript data={collection} />
    </>
  );
}
