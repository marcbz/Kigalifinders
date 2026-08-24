"use client";

import Link from "next/link";
import Image from "next/image";
import { ResearchChart } from "@/components/research/research-charts";
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
  last_verified_at?: string;
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
  verified_listings?: Listing[];
  neighborhoods?: { slug: string; name: string; district_name?: string; listing_count: number; median_usd?: number; path: string }[];
  related_searches?: { path: string; title: string; h1: string; match_count?: number }[];
  featured_searches?: { path: string; title: string; h1: string; match_count?: number }[];
  related_neighborhoods?: { slug: string; name: string; path: string; listing_count: number }[];
  faqs?: { q: string; a: string }[];
};

function MarketBlock({ snap, title }: { snap: Snap | null | undefined; title: string }) {
  if (!snap || snap.sample_size < 3) {
    return (
      <section className="rounded-2xl border border-dashed p-6 bg-white dark:bg-navy-800">
        <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-500">Not enough data yet to show statistics for this section.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border p-6 bg-white dark:bg-navy-800">
      <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-2">{title}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{snap.summary}</p>
      <dl className="grid sm:grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-gray-500">Typical rent</dt>
          <dd className="text-2xl font-serif">{snap.median_usd != null ? `$${snap.median_usd.toLocaleString()}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Common range</dt>
          <dd className="text-lg font-serif">
            {snap.p25_usd != null && snap.p75_usd != null
              ? `$${snap.p25_usd.toLocaleString()}–$${snap.p75_usd.toLocaleString()}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Sample size</dt>
          <dd className="text-2xl font-serif">{snap.sample_size}</dd>
        </div>
      </dl>
      {title.toLowerCase().includes("external") && (
        <p className="text-xs text-gray-500 mt-4">
          External market observations are not verified by KigaliRent. Availability is not confirmed.
        </p>
      )}
    </section>
  );
}

export function RentalHubPage({ data }: { data: RentalHubData }) {
  const listings = data.verified_listings || [];
  const searches = data.related_searches || data.featured_searches || [];

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-14 px-6">
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
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight mb-4">{data.h1}</h1>
          <p className="text-lg text-gray-100 max-w-3xl leading-relaxed">{data.intro}</p>
          {data.last_updated && (
            <p className="text-sm text-gray-300 mt-4">
              Updated {new Date(data.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {data.page_type === "directory" && data.neighborhoods && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Browse by neighborhood</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.neighborhoods
                .filter((n) => n.listing_count > 0)
                .map((n) => (
                  <li key={n.slug}>
                    <Link href={n.path} className="block rounded-xl border bg-white dark:bg-navy-800 p-4 hover:border-gold-500">
                      <span className="font-medium text-navy-800 dark:text-white">{n.name}</span>
                      <p className="text-sm text-gray-500 mt-1">
                        {n.listing_count} verified · {n.district_name}
                        {n.median_usd ? ` · ~$${n.median_usd.toLocaleString()}/mo` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
            </ul>
            <p className="mt-4 text-sm">
              <Link href="/rentals/kigali" className="text-gold-600 underline">Kigali market overview</Link>
            </p>
          </section>
        )}

        {(data.verified_market || data.observation_market) && (
          <div className="grid lg:grid-cols-2 gap-6">
            <MarketBlock snap={data.verified_market} title="KigaliRent Verified" />
            <MarketBlock snap={data.observation_market} title="External Market Observations" />
          </div>
        )}

        {listings.length > 0 && (
          <section>
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
              <Link href="/properties" className="text-gold-600 underline">Browse all rentals</Link> or try a related search below.
            </p>
          </section>
        )}

        {(data.by_bedroom_verified?.length || 0) > 0 && (
          <ResearchChart
            title="Verified rent by bedroom"
            subtitle="KigaliRent Verified listings only"
            points={(data.by_bedroom_verified || []).map((r) => ({
              label: r.bedrooms === 4 ? "4+" : String(r.bedrooms),
              value: r.median_usd || 0,
              sample_size: r.sample_size,
              p25: r.p25_usd,
              p75: r.p75_usd,
            }))}
            emptyText="Not enough bedroom breakdown data yet."
          />
        )}

        {(data.by_bedroom_external?.length || 0) > 0 && (
          <ResearchChart
            title="External observations by bedroom"
            subtitle="Observed on external sources — not confirmed vacancies"
            points={(data.by_bedroom_external || []).map((r) => ({
              label: r.bedrooms === 4 ? "4+" : String(r.bedrooms),
              value: r.median_usd || 0,
              sample_size: r.sample_size,
            }))}
            emptyText="Not enough external observation data yet."
          />
        )}

        {data.furnished_breakdown && data.furnished_breakdown.total > 0 && (
          <section className="rounded-2xl border p-6 bg-white dark:bg-navy-800">
            <h2 className="font-serif text-xl font-bold mb-3">Furnished vs unfurnished</h2>
            <p className="text-sm text-gray-600">
              {data.furnished_breakdown.furnished} furnished · {data.furnished_breakdown.unfurnished} unfurnished
              (from {data.furnished_breakdown.total} verified listings)
            </p>
          </section>
        )}

        {(data.property_types?.length || 0) > 0 && (
          <section className="rounded-2xl border p-6 bg-white dark:bg-navy-800">
            <h2 className="font-serif text-xl font-bold mb-3">Property types</h2>
            <ul className="text-sm space-y-1">
              {data.property_types!.map((t) => (
                <li key={t.slug} className="flex justify-between gap-4 border-b py-2">
                  <span>{t.name}</span>
                  <span className="text-gray-500">{t.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {searches.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Related rental searches</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {searches.map((s) => (
                <li key={s.path}>
                  <Link href={s.path} className="block rounded-lg border bg-white dark:bg-navy-800 px-4 py-3 hover:border-gold-500">
                    {s.h1}
                    {s.match_count != null ? <span className="text-xs text-gray-500 ml-2">({s.match_count} matches)</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(data.related_neighborhoods?.length || 0) > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Nearby neighborhoods</h2>
            <ul className="flex flex-wrap gap-2">
              {data.related_neighborhoods!.map((n) => (
                <li key={n.slug}>
                  <Link href={n.path} className="text-sm px-3 py-1.5 rounded-full border hover:border-gold-500">
                    {n.name} ({n.listing_count})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(data.faqs?.length || 0) > 0 && (
          <section className="border-t pt-8">
            <h2 className="font-serif text-2xl font-bold mb-4">FAQs</h2>
            <dl className="space-y-4">
              {data.faqs!.map((f) => (
                <div key={f.q}>
                  <dt className="font-medium text-navy-800 dark:text-white">{f.q}</dt>
                  <dd className="text-sm text-gray-600 mt-1">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
