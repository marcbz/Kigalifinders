import Image from "next/image";
import Link from "next/link";
import { ResearchChart } from "@/components/research/research-charts";
import { getPropertyImageAlt } from "@/lib/property-features";
import { getPropertyHref } from "@/lib/property-url";

export type LandingSnap = {
  sample_size: number;
  median_usd?: number;
  p25_usd?: number;
  p75_usd?: number;
  summary: string;
  label: string;
  data_kind?: string;
  period_end?: string;
};

export type TrendPoint = { label: string; median_usd?: number; sample_size?: number };

export type RentalListingCardData = {
  id: string;
  title: string;
  slug: string;
  price: number;
  usd_price?: number;
  currency?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  is_furnished?: boolean;
  neighborhood_name?: string | null;
  district_name?: string | null;
  property_type_name?: string | null;
  primary_image?: string | null;
};

/** Compact, crawlable refine control — attributes stay in HTML, not a dominant filter panel. */
export function KeyAttributes({ attrs }: { attrs: string[] }) {
  if (!attrs.length) return null;
  return (
    <details className="rounded-xl border bg-white dark:bg-navy-800 px-4 py-3 group">
      <summary className="cursor-pointer list-none text-sm font-medium text-navy-800 dark:text-gray-200 flex items-center justify-between gap-3">
        <span>Refine results</span>
        <span className="text-xs text-gray-500 group-open:hidden">Show filters</span>
        <span className="text-xs text-gray-500 hidden group-open:inline">Hide</span>
      </summary>
      <ul className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-navy-700">
        {attrs.map((a) => (
          <li
            key={a}
            className="text-sm px-3 py-1 rounded-full bg-navy-100 dark:bg-navy-900 text-navy-800 dark:text-gray-200"
          >
            {a}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function FullCatalogueCta() {
  return (
    <div className="flex justify-center">
      <Link
        href="/properties"
        className="btn-gold cta-breathe inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold ring-2 ring-[#c9a961]/55 ring-offset-2 ring-offset-cream dark:ring-offset-navy-900"
      >
        View Full Properties Catalogue
      </Link>
    </div>
  );
}

export function AskingRentSnapshot({
  marketAnswer,
  showCityOverviewLink = false,
}: {
  marketAnswer?: {
    headline?: string | null;
    has_enough_data?: boolean;
    range_text?: string | null;
    asking_rent_note?: string;
    sample_size?: number;
  } | null;
  showCityOverviewLink?: boolean;
}) {
  if (!marketAnswer?.has_enough_data || !marketAnswer.headline) return null;
  return (
    <section className="rounded-xl border bg-white dark:bg-navy-800 p-5">
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-2">Asking rent snapshot</h2>
      <p className="font-serif text-xl text-navy-800 dark:text-white">{marketAnswer.headline}</p>
      {marketAnswer.range_text && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{marketAnswer.range_text}</p>
      )}
      <p className="text-xs text-gray-500 mt-3">
        {marketAnswer.asking_rent_note ||
          "Figures are asking rents from eligible listing observations, not confirmed lease transactions."}
        {marketAnswer.sample_size != null ? ` Sample size: ${marketAnswer.sample_size}.` : ""}
      </p>
      <p className="mt-3 text-sm flex flex-wrap gap-x-3 gap-y-1">
        <Link href="/research/kigali-rental-market/prices" className="text-gold-600 underline">
          Kigali rental prices research
        </Link>
        {showCityOverviewLink && (
          <Link href="/rentals/kigali" className="text-gold-600 underline">
            City market overview
          </Link>
        )}
      </p>
    </section>
  );
}

export function RentalListingsSection({
  listings,
  matchMode = "exact",
  emptyHref = "/properties",
  emptyLabel = "View Full Properties Catalogue",
}: {
  listings: RentalListingCardData[];
  matchMode?: "exact" | "closest" | string;
  emptyHref?: string;
  emptyLabel?: string;
}) {
  const showingClosest = matchMode === "closest" && listings.length > 0;

  return (
    <section>
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Current availability</p>
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-6">
        {showingClosest ? "Closest available rentals" : "Latest rental listings"}
      </h2>
      {listings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 bg-white dark:bg-navy-800">
          <p className="text-navy-800 dark:text-white font-medium mb-2">No exact matches right now</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <Link href={emptyHref} className="text-gold-600 underline">
              {emptyLabel}
            </Link>
          </p>
        </div>
      ) : (
        <>
          {showingClosest ? (
            <div className="mb-5 rounded-lg border border-amber-200/80 bg-amber-50/80 dark:bg-navy-800 dark:border-navy-700 px-4 py-3">
              <p className="text-navy-800 dark:text-white font-medium">No exact matches right now</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Here are the closest available rentals.
              </p>
            </div>
          ) : null}
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((p, index) => (
              <li
                key={p.id}
                className={`bg-white dark:bg-navy-800 rounded-xl overflow-hidden border${
                  index >= 6 ? " max-md:hidden" : ""
                }`}
              >
                <Link href={getPropertyHref(p)} className="block">
                  <div className="relative aspect-[4/3] bg-navy-700">
                    {p.primary_image ? (
                      <Image
                        src={p.primary_image}
                        alt={getPropertyImageAlt({
                          title: p.title,
                          neighborhood_name: p.neighborhood_name ?? undefined,
                          district_name: p.district_name ?? undefined,
                          bedrooms: p.bedrooms ?? undefined,
                          property_type_name: p.property_type_name ?? undefined,
                        })}
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 100vw, 33vw"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif font-semibold text-navy-800 dark:text-white line-clamp-2">{p.title}</h3>
                    <p className="text-gold-600 font-semibold mt-1">
                      ${(p.usd_price ?? p.price).toLocaleString()}/month
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {[
                        p.neighborhood_name,
                        p.bedrooms != null ? `${p.bedrooms} bed` : null,
                        p.bathrooms != null ? `${p.bathrooms} bath` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function MarketBlock({ snap, title }: { snap: LandingSnap | null | undefined; title: string }) {
  if (!snap || snap.sample_size < 3) {
    return (
      <section className="rounded-2xl border border-dashed p-6 bg-white dark:bg-navy-800">
        <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-500">Not enough data yet to show statistics for this section.</p>
      </section>
    );
  }
  const isExternal = title.toLowerCase().includes("external");
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
      <p className="text-xs text-gray-500 mt-4">
        {isExternal ? "External Market Observations — not verified by KigaliRent." : "KigaliRent Verified listings only."}
        {snap.period_end ? ` · Data through ${snap.period_end}` : ""}
      </p>
    </section>
  );
}

export function DataInsights({ insights }: { insights: string[] }) {
  if (!insights.length) return null;
  return (
    <section className="rounded-2xl border p-6 bg-white dark:bg-navy-800">
      <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-3">What the data shows</h2>
      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc pl-5">
        {insights.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

export function TrendCharts({
  verified,
  external,
}: {
  verified?: TrendPoint[];
  external?: TrendPoint[];
}) {
  const series = (verified?.length || 0) >= 2 ? verified : (external?.length || 0) >= 2 ? external : null;
  if (!series) return null;
  return (
    <ResearchChart
      kind="line"
      title="Asking rent over time"
      subtitle="Combined eligible observations · USD/month"
      points={(series || []).map((p) => ({
        label: p.label,
        value: p.median_usd || 0,
        sample_size: p.sample_size,
      }))}
      emptyText="Not enough historical data yet."
    />
  );
}

export function RelatedNeighborhoods({
  items,
}: {
  items: { slug: string; name: string; path: string; listing_count: number }[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Related neighborhoods</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((n) => (
          <li key={n.slug}>
            <Link href={n.path} className="text-sm px-3 py-1.5 rounded-full border hover:border-gold-500 bg-white dark:bg-navy-800">
              {n.name} ({n.listing_count})
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type RelatedRentalSearchItem = {
  path: string;
  h1: string;
  title?: string;
  match_count?: number | null;
};

/** Shared related rental search links used on /rentals hubs, landings, and property detail. */
export function RelatedRentalSearches({
  items,
  heading = "Related rental searches",
  showMatchCount = false,
  className,
}: {
  items: RelatedRentalSearchItem[];
  heading?: string;
  showMatchCount?: boolean;
  className?: string;
}) {
  const unique = items
    .filter((s) => s.path?.startsWith("/rentals/"))
    .reduce<RelatedRentalSearchItem[]>((acc, s) => {
      const label = (s.h1 || s.title || "").trim().toLowerCase();
      if (acc.some((x) => x.path === s.path)) return acc;
      if (label && acc.some((x) => (x.h1 || x.title || "").trim().toLowerCase() === label)) return acc;
      acc.push(s);
      return acc;
    }, [])
    .slice(0, 6);

  if (!unique.length) return null;

  return (
    <section className={className}>
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">{heading}</h2>
      <ul className="grid sm:grid-cols-2 gap-3">
        {unique.map((s) => (
          <li key={s.path}>
            <Link
              href={s.path}
              className="block rounded-lg border bg-white dark:bg-navy-800 px-4 py-3 hover:border-gold-500 transition"
            >
              <span className="text-navy-800 dark:text-white font-medium">{s.h1}</span>
              {showMatchCount && s.match_count != null ? (
                <span className="text-xs text-gray-500 ml-2">({s.match_count} matches)</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
