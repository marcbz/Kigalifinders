import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { PropertyCard } from "@/components/property/property-card";
import { getAreaHref } from "@/lib/areas";
import {
  fetchComparePairsSafe,
  fetchNeighborhoodComparisonSafe,
  type NeighborhoodCompareProfile,
} from "@/lib/market-api";
import { fetchPropertiesSafe, fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";

export const revalidate = 600;

const SITE = "https://kigalirent.com";
const HUB = "/research/kigali-rental-market";

interface PageProps {
  params: Promise<{ pair: string }>;
}

function canonicalPair(pair: string): string | null {
  const parts = pair.toLowerCase().split("-vs-");
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) return null;
  return [...parts].sort().join("-vs-");
}

function money(value: number | null | undefined): string {
  return value != null ? `$${Math.round(value).toLocaleString()}` : "—";
}

function pct(value: number | null | undefined): string {
  return value != null ? `${value}%` : "—";
}

export async function generateStaticParams() {
  const data = await fetchComparePairsSafe();
  return (data?.items || []).slice(0, 20).map((p) => ({ pair: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pair } = await params;
  const data = await fetchNeighborhoodComparisonSafe(canonicalPair(pair) || pair);
  if (!data) return { title: "Neighborhood comparison", robots: { index: false } };
  const { a, b } = data;
  const title = `${a.name} vs ${b.name}: Rent Prices Compared (${new Date(data.last_updated).getFullYear()})`;
  const description = `${data.summary[0]} Compare rent by bedroom, furnished homes and amenities in ${a.name} and ${b.name}, Kigali.`;
  const url = `${SITE}${HUB}/compare/${data.slug}`;
  const listings = await fetchPropertiesSafe({
    neighborhood_slug: a.slug,
    page_size: 6,
    sort_by: "created_at",
    sort_order: "desc",
  });
  const cover = listings.items.find((p) => p.primary_image)?.primary_image;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "Kigali Rent",
      locale: "en_RW",
      ...(cover ? { images: [{ url: cover, alt: `Homes for rent in ${a.name}, Kigali` }] } : {}),
    },
    ...(data.limited_data ? { robots: { index: false, follow: true } } : {}),
  };
}

function ProfileCard({ p, cheaper, hasArea }: { p: NeighborhoodCompareProfile; cheaper: boolean; hasArea: boolean }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">{p.name}</h2>
        {cheaper && (
          <span className="text-xs font-semibold uppercase tracking-wide rounded-full bg-gold-500/15 text-gold-700 dark:text-gold-400 px-2.5 py-1">
            Cheaper
          </span>
        )}
      </div>
      <p className="font-serif text-3xl text-navy-800 dark:text-white">
        {money(p.typical_usd)}
        <span className="text-base text-gray-500 font-sans">/month typical</span>
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
        Most listings: {money(p.p25_usd)}–{money(p.p75_usd)}
      </p>
      <p className="text-xs text-gray-500 mt-2">Based on {p.sample_size} recent asking rents</p>
      <div className="flex flex-wrap gap-3 mt-4 text-sm">
        {hasArea && (
          <Link href={getAreaHref(p.slug)} className="underline text-navy-800 dark:text-gold-400">
            {p.name} area guide
          </Link>
        )}
        <Link
          href={`/properties?neighborhood_slug=${encodeURIComponent(p.slug)}`}
          className="underline text-navy-800 dark:text-gold-400"
        >
          Homes for rent in {p.name}
        </Link>
      </div>
    </div>
  );
}

export default async function NeighborhoodComparePage({ params }: PageProps) {
  const { pair } = await params;
  const canonical = canonicalPair(pair);
  if (!canonical) notFound();
  if (canonical !== pair) permanentRedirect(`${HUB}/compare/${canonical}`);

  const data = await fetchNeighborhoodComparisonSafe(canonical);
  if (!data) notFound();
  const { a, b } = data;
  const minListed = data.min_listed_sample ?? 10;
  const thinAreas = [a, b].filter((p) => p.sample_size < minListed);

  const [aListings, bListings, pairs, areas] = await Promise.all([
    fetchPropertiesSafe({ neighborhood_slug: a.slug, page_size: 6, sort_by: "created_at", sort_order: "desc" }),
    fetchPropertiesSafe({ neighborhood_slug: b.slug, page_size: 6, sort_by: "created_at", sort_order: "desc" }),
    fetchComparePairsSafe(),
    fetchSearchFilterNeighborhoodsSafe(),
  ]);
  const areaSlugs = new Set(areas.map((n) => n.slug));
  const rentals = (items: typeof aListings.items) => items.filter((p) => p.listing_type !== "sale").slice(0, 3);
  const otherComparisons = (pairs?.items || [])
    .filter((p) => p.slug !== data.slug && [p.a.slug, p.b.slug].some((s) => s === a.slug || s === b.slug))
    .slice(0, 8);

  const pageUrl = `${SITE}${HUB}/compare/${data.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Kigali rental market", item: `${SITE}${HUB}` },
          { "@type": "ListItem", position: 3, name: "Compare neighborhoods", item: `${SITE}${HUB}/compare` },
          { "@type": "ListItem", position: 4, name: `${a.name} vs ${b.name}`, item: pageUrl },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: data.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };

  const rows: { label: string; a: string; b: string }[] = [
    { label: "Typical asking rent", a: money(a.typical_usd), b: money(b.typical_usd) },
    { label: "Common range (middle 50%)", a: `${money(a.p25_usd)}–${money(a.p75_usd)}`, b: `${money(b.p25_usd)}–${money(b.p75_usd)}` },
    { label: "Furnished (typical)", a: money(a.furnished_median_usd), b: money(b.furnished_median_usd) },
    { label: "Unfurnished (typical)", a: money(a.unfurnished_median_usd), b: money(b.unfurnished_median_usd) },
    { label: "Share of listings furnished", a: pct(a.furnished_share_pct), b: pct(b.furnished_share_pct) },
    { label: "Kigali Rent listings with a pool", a: pct(a.amenities.pool_pct), b: pct(b.amenities.pool_pct) },
    { label: "Kigali Rent listings with a garden", a: pct(a.amenities.garden_pct), b: pct(b.amenities.garden_pct) },
    { label: "Kigali Rent listings with parking", a: pct(a.amenities.parking_pct), b: pct(b.amenities.parking_pct) },
    { label: "Asking rents observed", a: String(a.sample_size), b: String(b.sample_size) },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="text-sm mb-4 text-gray-500">
        <Link href={HUB} className="underline">
          Research hub
        </Link>
        {" / "}
        <Link href={`${HUB}/compare`} className="underline">
          Compare neighborhoods
        </Link>
      </nav>

      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">
        {a.name} vs {b.name}: rent prices compared
      </h1>
      {data.limited_data && thinAreas.length > 0 && (
        <p className="mb-6 max-w-3xl rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm text-navy-800 dark:text-gray-200">
          Limited data: {thinAreas.map((p) => `${p.name} (${p.sample_size} asking rents)`).join(" and ")}{" "}
          {thinAreas.length > 1 ? "have" : "has"} fewer than {minListed} recent asking rents, so treat these
          figures as indicative.
        </p>
      )}
      <div className="space-y-2 text-gray-700 dark:text-gray-300 mb-8 max-w-3xl">
        {data.summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <ProfileCard p={a} cheaper={data.cheaper_slug === a.slug} hasArea={areaSlugs.has(a.slug)} />
        <ProfileCard p={b} cheaper={data.cheaper_slug === b.slug} hasArea={areaSlugs.has(b.slug)} />
      </div>

      <section className="mb-10">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Side by side</h2>
        <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 px-4 font-medium text-gray-500"> </th>
                <th className="py-3 px-4 font-semibold text-navy-800 dark:text-white">{a.name}</th>
                <th className="py-3 px-4 font-semibold text-navy-800 dark:text-white">{b.name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{r.label}</td>
                  <td className="py-3 px-4 tabular-nums">{r.a}</td>
                  <td className="py-3 px-4 tabular-nums">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.bedroom_rows.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Rent by bedrooms</h2>
          <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-navy-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-3 px-4 font-medium text-gray-500">Size</th>
                  <th className="py-3 px-4 font-semibold text-navy-800 dark:text-white">{a.name}</th>
                  <th className="py-3 px-4 font-semibold text-navy-800 dark:text-white">{b.name}</th>
                </tr>
              </thead>
              <tbody>
                {data.bedroom_rows.map((r) => (
                  <tr key={r.bedrooms} className="border-b last:border-0">
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{r.label}</td>
                    <td className="py-3 px-4 tabular-nums">
                      {money(r.a_median_usd)}
                      {r.a_sample_size > 0 && <span className="text-xs text-gray-400 ml-1">n={r.a_sample_size}</span>}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {money(r.b_median_usd)}
                      {r.b_sample_size > 0 && <span className="text-xs text-gray-400 ml-1">n={r.b_sample_size}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {[
        { p: a, items: rentals(aListings.items) },
        { p: b, items: rentals(bListings.items) },
      ].map(({ p, items }) =>
        items.length ? (
          <section key={p.slug} className="mb-10">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">
                Available now in {p.name}
              </h2>
              <Link
                href={`/properties?neighborhood_slug=${encodeURIComponent(p.slug)}`}
                className="text-sm underline text-navy-800 dark:text-gold-400 shrink-0"
              >
                See all
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section className="mb-10">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Common questions</h2>
        <div className="space-y-4">
          {data.faqs.map((f) => (
            <div key={f.question}>
              <h3 className="font-semibold text-navy-800 dark:text-white">{f.question}</h3>
              <p className="text-gray-700 dark:text-gray-300">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {otherComparisons.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">More comparisons</h2>
          <ul className="flex flex-wrap gap-2">
            {otherComparisons.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`${HUB}/compare/${p.slug}`}
                  className="inline-block rounded-full border px-4 py-2 text-sm hover:border-gold-500"
                >
                  {p.a.name} vs {p.b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-gray-500">
        {data.note} Updated {data.last_updated}.{" "}
        <Link href={`${HUB}/methodology`} className="underline">
          Methodology
        </Link>
      </p>
    </div>
  );
}
