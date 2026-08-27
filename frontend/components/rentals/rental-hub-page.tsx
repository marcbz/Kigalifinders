"use client";

import Link from "next/link";
import Image from "next/image";
import { KeyAttributes, RelatedNeighborhoods, RelatedRentalSearches } from "@/components/rentals/rental-landing-sections";
import { getAreaHref } from "@/lib/areas";
import { getPropertyHref } from "@/lib/property-url";

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
};

function truncateIntro(text: string, max = 200): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function shortHubIntro(data: RentalHubData): string | null {
  if (data.meta_description?.trim()) return data.meta_description.trim();
  if (data.intro?.trim()) return truncateIntro(data.intro);
  return null;
}

export function RentalHubPage({ data }: { data: RentalHubData }) {
  const listings = data.verified_listings || [];
  const searches = data.related_searches || data.featured_searches || [];
  const intro = shortHubIntro(data);
  const typeHubs = data.type_hubs || [];
  const locationSlug = data.location_slug;

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-gray-300 mb-4">
            <Link href="/" className="hover:text-gold-400">Home</Link>
            {" / "}
            <Link href="/rentals" className="hover:text-gold-400">Rentals</Link>
            {data.page_type !== "directory" && (
              <>
                {" / "}
                <span className="text-gold-400">{data.location_name || data.location_slug}</span>
              </>
            )}
          </nav>
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">
            {data.page_type === "directory" ? "Directory" : data.page_type === "city" ? "Market overview" : "Neighborhood guide"}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3">{data.h1}</h1>
          {intro && (
            <p className="text-base text-gray-200 max-w-3xl leading-relaxed">{intro}</p>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {!!data.key_attributes?.length && <KeyAttributes attrs={data.key_attributes} />}

        {data.market_answer?.has_enough_data && data.market_answer.headline && (
          <section className="rounded-xl border bg-white dark:bg-navy-800 p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Asking-rent snapshot</p>
            <p className="font-serif text-xl font-bold text-navy-800 dark:text-white">{data.market_answer.headline}</p>
            {data.market_answer.range_text && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{data.market_answer.range_text}</p>
            )}
            <p className="mt-3 text-sm">
              <Link href="/research/kigali-rental-market" className="text-gold-600 underline">
                Kigali rental market research
              </Link>
              {data.page_type === "directory" && (
                <>
                  {" · "}
                  <Link href="/rentals/kigali" className="text-gold-600 underline">
                    City market overview
                  </Link>
                </>
              )}
            </p>
          </section>
        )}

        {typeHubs.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Browse by rental type</h2>
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

        {data.page_type === "directory" && data.neighborhoods && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Browse by neighborhood</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.neighborhoods
                .filter((n) => n.listing_count > 0)
                .map((n) => (
                  <li key={n.slug}>
                    <div className="rounded-xl border bg-white dark:bg-navy-800 p-4 hover:border-gold-500">
                      <Link href={n.path} className="block">
                        <span className="font-medium text-navy-800 dark:text-white">{n.name}</span>
                        <p className="text-sm text-gray-500 mt-1">
                          {n.listing_count} verified · {n.district_name}
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
            <p className="mt-4 text-sm flex flex-wrap gap-x-3 gap-y-1">
              <Link href="/rentals/kigali" className="text-gold-600 underline">Kigali market overview</Link>
              <Link href="/area" className="text-gold-600 underline">All neighborhood guides</Link>
              <Link href="/properties" className="text-gold-600 underline">Full properties catalogue</Link>
            </p>
          </section>
        )}

        {data.page_type === "city" && data.neighborhoods && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Neighborhoods with verified listings</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.neighborhoods
                .filter((n) => n.listing_count > 0)
                .slice(0, 12)
                .map((n) => (
                  <li key={n.slug}>
                    <div className="rounded-xl border bg-white dark:bg-navy-800 p-4 hover:border-gold-500">
                      <Link href={n.path} className="block">
                        <span className="font-medium text-navy-800 dark:text-white">{n.name}</span>
                        <p className="text-sm text-gray-500 mt-1">
                          {n.listing_count} verified
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
          </section>
        )}

        {data.page_type === "neighborhood" && locationSlug && (
          <p className="text-sm">
            <Link href={getAreaHref(locationSlug)} className="text-gold-600 underline">
              {data.location_name || locationSlug} neighborhood guide
            </Link>
            {" · "}
            <Link href="/rentals" className="text-gold-600 underline">
              All Kigali rentals
            </Link>
          </p>
        )}

        {listings.length > 0 && (
          <section>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Available verified rentals</p>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-6">Verified listings</h2>
            <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((p) => (
                <li key={p.id} className="bg-white dark:bg-navy-800 rounded-xl overflow-hidden border">
                  <Link href={getPropertyHref(p)} className="block">
                    <div className="relative aspect-[4/3] bg-navy-700">
                      {p.primary_image ? (
                        <Image src={p.primary_image} alt="" fill className="object-cover" sizes="33vw" />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="font-serif font-semibold line-clamp-2">{p.title}</h3>
                      <p className="text-gold-600 font-semibold mt-1">${(p.usd_price ?? p.price).toLocaleString()}/month</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {p.neighborhood_name}
                        {p.bedrooms != null ? ` · ${p.bedrooms} bed` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {listings.length === 0 && data.page_type !== "directory" && (
          <section className="rounded-xl border border-dashed p-8 bg-white dark:bg-navy-800">
            <p className="text-navy-800 dark:text-white font-medium">No verified listings in this area right now.</p>
            <p className="text-sm text-gray-500 mt-2">
              <Link href="/rentals" className="text-gold-600 underline">Browse rental directory</Link>
              {" · "}
              <Link href="/properties" className="text-gold-600 underline">Browse all properties</Link>
            </p>
          </section>
        )}

        {searches.length > 0 && (
          <RelatedRentalSearches items={searches} showMatchCount />
        )}

        {(data.related_neighborhoods?.length || 0) > 0 && (
          <RelatedNeighborhoods items={data.related_neighborhoods!} />
        )}
      </div>
    </div>
  );
}
