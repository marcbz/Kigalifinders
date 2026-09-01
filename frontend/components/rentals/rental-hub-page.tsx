"use client";

import Link from "next/link";
import { Suspense } from "react";
import {
  AskingRentSnapshot,
  FullCatalogueCta,
  KeyAttributes,
  RelatedNeighborhoods,
  RelatedRentalSearches,
  RentalListingsSection,
} from "@/components/rentals/rental-landing-sections";
import { WhatsAppMatchAlert } from "@/components/property/whatsapp-match-alert";
import { getAreaHref } from "@/lib/areas";
import { CiteThisRental } from "@/components/rentals/cite-this-rental";

type Listing = {
  id: string;
  title: string;
  slug: string;
  price: number;
  usd_price?: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  is_furnished?: boolean;
  has_pool?: boolean;
  has_parking?: boolean;
  neighborhood_name?: string;
  property_type_name?: string;
  primary_image?: string;
  relevance_score?: number;
};

type Snap = {
  sample_size: number;
  median_usd?: number;
  p25_usd?: number;
  p75_usd?: number;
  summary: string;
  label: string;
  data_kind?: string;
  period_end?: string;
};

type BedroomRow = { bedrooms: number; median_usd?: number; p25_usd?: number; p75_usd?: number; sample_size: number };

type TypeHub = {
  slug: string;
  label: string;
  path: string;
  h1?: string;
  match_count?: number;
};

export type RentalHubData = {
  page_type: "directory" | "city" | "neighborhood";
  path: string;
  title: string;
  h1: string;
  meta_description?: string;
  canonical?: string;
  robots?: string;
  intro: string;
  last_updated?: string;
  location_slug?: string;
  location_name?: string;
  district_name?: string;
  listing_count?: number;
  total_listings?: number;
  observation_count?: number;
  verified_market?: Snap | null;
  observation_market?: Snap | null;
  by_bedroom_verified?: BedroomRow[];
  by_bedroom_external?: BedroomRow[];
  furnished_breakdown?: { furnished: number; unfurnished: number; total: number };
  property_types?: { slug: string; name: string; count: number }[];
  type_hubs?: TypeHub[];
  verified_listings?: Listing[];
  neighborhoods?: { slug: string; name: string; district_name?: string; listing_count: number; median_usd?: number; path: string }[];
  related_searches?: { path: string; title: string; h1: string; match_count?: number }[];
  featured_searches?: { path: string; title: string; h1: string; match_count?: number }[];
  related_neighborhoods?: { slug: string; name: string; path: string; listing_count: number }[];
  faqs?: { q: string; a: string }[];
  key_attributes?: string[];
  data_insights?: string[];
  trend_verified?: { label: string; median_usd?: number; sample_size?: number }[];
  trend_external?: { label: string; median_usd?: number; sample_size?: number }[];
  alert_context?: {
    intent?: string;
    area?: string;
    bedrooms?: string | null;
    budget?: string | null;
    property_type?: string | null;
    furnished?: boolean | null;
    search_label?: string;
    search_url?: string;
  } | null;
  market_answer?: {
    question?: string;
    headline?: string | null;
    has_enough_data?: boolean;
    summary?: string;
    range_text?: string | null;
    sample_size?: number;
    last_updated_display?: string | null;
    asking_rent_note?: string;
  } | null;
  match_mode?: "exact" | "closest" | string;
};

function truncateIntro(text: string, max = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function shortHubIntro(data: RentalHubData): string | null {
  if (data.intro?.trim()) return truncateIntro(data.intro, 160);
  if (data.meta_description?.trim()) return truncateIntro(data.meta_description, 160);
  return null;
}

export function RentalHubPage({ data }: { data: RentalHubData }) {
  const listings = (data.verified_listings || []).slice(0, 9);
  const searches = data.related_searches || data.featured_searches || [];
  const intro = shortHubIntro(data);
  const typeHubs = data.type_hubs || [];
  const locationSlug = data.location_slug;
  const neighborhoodBrowse =
    data.page_type === "directory" || data.page_type === "city"
      ? (data.neighborhoods || []).filter((n) => n.listing_count > 0)
      : [];
  const alert = data.alert_context;

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-gray-300 mb-4">
            <Link href="/" className="hover:text-gold-400">
              Home
            </Link>
            {" / "}
            <Link href="/rentals" className="hover:text-gold-400">
              Rentals
            </Link>
            {data.page_type !== "directory" && (
              <>
                {" / "}
                <span className="text-gold-400">{data.location_name || data.location_slug}</span>
              </>
            )}
          </nav>
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">
            {data.page_type === "directory"
              ? "Kigali marketplace"
              : data.page_type === "city"
                ? "Market overview"
                : "Neighborhood rentals"}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3">{data.h1}</h1>
          {intro && <p className="text-base text-gray-200 max-w-3xl leading-relaxed">{intro}</p>}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <RentalListingsSection
          listings={listings}
          matchMode={data.match_mode || "exact"}
          emptyHref="/properties"
          emptyLabel="View Full Properties Catalogue"
        />

        <FullCatalogueCta />

        {searches.length > 0 && <RelatedRentalSearches items={searches} showMatchCount />}

        <Suspense fallback={null}>
          <WhatsAppMatchAlert
            defaults={{
              intent: (alert?.intent as "rent" | "buy" | "") || "rent",
              area: alert?.area || data.location_name || "Kigali",
              bedrooms: alert?.bedrooms || undefined,
              budget: alert?.budget || undefined,
              propertyType: alert?.property_type || undefined,
              furnished: alert?.furnished,
              searchLabel: alert?.search_label || data.h1,
              searchUrl: alert?.search_url || `https://kigalirent.com${data.path}`,
            }}
          />
        </Suspense>

        {(data.related_neighborhoods?.length || 0) > 0 && (
          <RelatedNeighborhoods items={data.related_neighborhoods!} />
        )}

        <AskingRentSnapshot
          marketAnswer={data.market_answer}
          showCityOverviewLink={data.page_type === "directory"}
        />

        {typeHubs.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">
              Browse by rental type
            </h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {typeHubs.map((hub) => (
                <li key={hub.path}>
                  <Link
                    href={hub.path}
                    className="block rounded-xl border bg-white dark:bg-navy-800 p-4 hover:border-gold-500"
                  >
                    <span className="font-medium text-navy-800 dark:text-white">{hub.label}</span>
                    {hub.match_count != null && (
                      <p className="text-sm text-gray-500 mt-1">{hub.match_count} verified matches</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {neighborhoodBrowse.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">
              Browse by neighborhood
            </h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {neighborhoodBrowse.slice(0, data.page_type === "city" ? 12 : undefined).map((n) => (
                <li key={n.slug}>
                  <div className="rounded-xl border bg-white dark:bg-navy-800 p-4 hover:border-gold-500">
                    <Link href={n.path} className="block">
                      <span className="font-medium text-navy-800 dark:text-white">{n.name}</span>
                      <p className="text-sm text-gray-500 mt-1">
                        {n.listing_count} verified
                        {n.district_name ? ` · ${n.district_name}` : ""}
                        {n.median_usd ? ` · ~$${n.median_usd.toLocaleString()}/mo` : ""}
                      </p>
                    </Link>
                    <p className="text-xs mt-2">
                      <Link href={getAreaHref(n.slug)} className="text-gold-600 hover:underline">
                        Area guide
                      </Link>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {data.page_type === "directory" && (
              <p className="mt-4 text-sm flex flex-wrap gap-x-3 gap-y-1">
                <Link href="/rentals/kigali" className="text-gold-600 underline">
                  Kigali market overview
                </Link>
                <Link href="/area" className="text-gold-600 underline">
                  All neighborhood guides
                </Link>
              </p>
            )}
          </section>
        )}

        {data.page_type === "neighborhood" && locationSlug && (
          <p className="text-sm flex flex-wrap gap-x-3 gap-y-1">
            <Link href={getAreaHref(locationSlug)} className="text-gold-600 underline">
              Living in {data.location_name || locationSlug} area guide
            </Link>
            <span className="text-gray-400" aria-hidden>
              ·
            </span>
            <Link href="/research/kigali-rental-market/prices" className="text-gold-600 underline">
              Kigali rental prices research
            </Link>
            <span className="text-gray-400" aria-hidden>
              ·
            </span>
            <Link href="/rentals" className="text-gold-600 underline">
              All Kigali rentals
            </Link>
          </p>
        )}

        {data.page_type === "city" && (data.total_listings ?? 0) > 0 && (
          <CiteThisRental
            topic={data.h1}
            canonicalUrl={data.canonical || "https://kigalirent.com/rentals/kigali"}
            lastUpdated={data.last_updated}
            listingCount={data.total_listings}
          />
        )}

        {data.page_type === "neighborhood" &&
          locationSlug &&
          (data.listing_count ?? 0) > 0 && (
            <CiteThisRental
              topic={data.h1}
              canonicalUrl={data.canonical || `https://kigalirent.com/rentals/${locationSlug}`}
              lastUpdated={data.last_updated}
              listingCount={data.listing_count}
            />
          )}

        {!!data.key_attributes?.length && <KeyAttributes attrs={data.key_attributes} />}

        {!!data.data_insights?.length && (
          <section className="text-sm text-gray-600 dark:text-gray-300 space-y-2 max-w-3xl">
            <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white">About these listings</h2>
            <ul className="list-disc pl-5 space-y-1">
              {data.data_insights.slice(0, 3).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
