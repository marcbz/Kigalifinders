import {
  buildRentalBreadcrumbJsonLd,
  buildRentalFaqJsonLd,
  buildRentalItemListJsonLd,
} from "@/lib/rental-jsonld";
import type { RentalHubData } from "@/components/rentals/rental-hub-page";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

function JsonLdScript({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
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

  const listings = data.verified_listings || [];
  const breadcrumb = buildRentalBreadcrumbJsonLd(crumbs);
  const itemList = buildRentalItemListJsonLd(listings, canonical, data.h1);
  const faq = buildRentalFaqJsonLd(data.faqs || []);

  return (
    <>
      <JsonLdScript data={breadcrumb} />
      <JsonLdScript data={itemList} />
      <JsonLdScript data={faq} />
    </>
  );
}

type IntentPageJsonLdProps = {
  h1: string;
  canonical: string;
  locationSlug: string;
  locationLabel: string;
  listings: { title: string; slug: string; price?: number; usd_price?: number; currency?: string }[];
};

export function RentalIntentSeoJsonLd({
  h1,
  canonical,
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
  const itemList = buildRentalItemListJsonLd(listings, canonical, h1);

  return (
    <>
      <JsonLdScript data={breadcrumb} />
      <JsonLdScript data={itemList} />
    </>
  );
}
