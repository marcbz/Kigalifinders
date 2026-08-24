import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRentalLandingSafe } from "@/lib/market-api";
import { getPropertyHref } from "@/lib/property-url";

interface Props {
  params: Promise<{ location: string; intent: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location, intent } = await params;
  const page = await fetchRentalLandingSafe(location, intent);
  if (!page) return { title: "Rentals", robots: { index: false } };
  return {
    title: page.title,
    description: page.meta_description,
    alternates: { canonical: page.canonical },
    robots: page.robots.includes("noindex")
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

function formatVerified(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Verified today";
  if (days === 1) return "Verified 1 day ago";
  if (days < 30) return `Verified ${days} days ago`;
  return `Last verified ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default async function RentalLandingPage({ params }: Props) {
  const { location, intent } = await params;
  const page = await fetchRentalLandingSafe(location, intent);
  if (!page) notFound();

  const snap = page.market_snapshot;

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">KigaliRent verified search</p>
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight mb-4">{page.h1}</h1>
          <p className="text-lg text-gray-100 max-w-3xl leading-relaxed">{page.answer}</p>
          {page.last_updated && (
            <p className="text-sm text-gray-300 mt-4">
              Updated {new Date(page.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-14">
        <section>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-2">
            {page.match_count} verified {page.match_count === 1 ? "property" : "properties"}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-8">
            Ranked by transparent relevance (location, bedrooms, price, amenities, verification freshness). No paid placement.
          </p>

          {page.verified_matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 bg-white dark:bg-navy-800">
              <p className="text-navy-800 dark:text-white font-medium mb-2">
                We don&apos;t currently have enough verified properties matching this exact search.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Try a related search below, or{" "}
                <Link href="/properties" className="text-gold-600 underline">
                  browse all rentals
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {page.verified_matches.map((p) => (
                <li key={p.id} className="bg-white dark:bg-navy-800 rounded-xl overflow-hidden border shadow-sm">
                  <Link href={getPropertyHref(p)} className="block">
                    <div className="relative aspect-[4/3] bg-navy-700">
                      {p.primary_image ? (
                        <Image src={p.primary_image} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
                      ) : null}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                        <span className="bg-gold-500/15 text-gold-700 px-2 py-0.5 rounded">Verified</span>
                        {p.is_furnished && <span className="bg-navy-100 text-navy-700 px-2 py-0.5 rounded">Furnished</span>}
                        {p.has_pool && <span className="bg-navy-100 text-navy-700 px-2 py-0.5 rounded">Pool</span>}
                      </div>
                      <h3 className="font-serif text-lg font-semibold text-navy-800 dark:text-white line-clamp-2">{p.title}</h3>
                      <p className="text-gold-600 font-semibold">
                        ${(p.usd_price ?? p.price).toLocaleString()}/month
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.neighborhood_name}
                        {p.bedrooms != null ? ` · ${p.bedrooms} bed` : ""}
                        {formatVerified(p.last_verified_at) ? ` · ${formatVerified(p.last_verified_at)}` : ""}
                      </p>
                      <p className="text-[11px] text-gray-400">Match score {p.relevance_score}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {snap && snap.sample_size >= 3 && (
          <section className="bg-white dark:bg-navy-800 rounded-2xl border p-8">
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-2">Market snapshot</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{snap.summary}</p>
            <dl className="grid sm:grid-cols-3 gap-6 text-sm">
              <div>
                <dt className="text-gray-500">Median asking rent</dt>
                <dd className="text-2xl font-serif text-navy-800 dark:text-white">
                  {snap.median_usd != null ? `$${snap.median_usd.toLocaleString()}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Observed range (P25–P75)</dt>
                <dd className="text-2xl font-serif text-navy-800 dark:text-white">
                  {snap.p25_usd != null && snap.p75_usd != null
                    ? `$${snap.p25_usd.toLocaleString()}–$${snap.p75_usd.toLocaleString()}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Sample size</dt>
                <dd className="text-2xl font-serif text-navy-800 dark:text-white">{snap.sample_size}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500 mt-4">
              Source label: {snap.data_kind === "verified_kigali_rent" ? "KigaliRent verified inventory" : "External market observations"}
              {snap.period_end ? ` · Period ending ${snap.period_end}` : ""}
            </p>
          </section>
        )}

        {page.related.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Similar searches</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {page.related.map((r) => (
                <li key={r.path}>
                  <Link href={r.path} className="block rounded-lg border bg-white dark:bg-navy-800 px-4 py-3 hover:border-gold-500 transition">
                    <span className="text-navy-800 dark:text-white font-medium">{r.h1}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              <Link
                href={page.location_slug === "kigali" ? "/area" : `/area/${page.location_slug}`}
                className="text-gold-600 underline"
              >
                {page.location_slug === "kigali" ? "Explore Kigali areas" : `See the ${page.location_slug} area guide`}
              </Link>
              {" · "}
              <Link href="/research/kigali-rental-market/" className="text-gold-600 underline">
                Kigali rental market data
              </Link>
            </p>
          </section>
        )}

        <section className="text-sm text-gray-600 dark:text-gray-300 border-t pt-8">
          <h2 className="font-semibold text-navy-800 dark:text-white mb-2">Methodology</h2>
          <p>{page.methodology_note}</p>
          <p className="mt-2">
            <Link href="/research/kigali-rental-market/methodology/" className="text-gold-600 underline">
              Full methodology
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
