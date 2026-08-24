import Link from "next/link";
import { ResearchChart } from "@/components/research/research-charts";

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

export function KeyAttributes({ attrs }: { attrs: string[] }) {
  if (!attrs.length) return null;
  return (
    <section className="rounded-2xl border p-6 bg-white dark:bg-navy-800">
      <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-3">Search filters</h2>
      <ul className="flex flex-wrap gap-2">
        {attrs.map((a) => (
          <li key={a} className="text-sm px-3 py-1 rounded-full bg-navy-100 dark:bg-navy-900 text-navy-800 dark:text-gray-200">
            {a}
          </li>
        ))}
      </ul>
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
  const hasVerified = (verified?.length || 0) >= 2;
  const hasExternal = (external?.length || 0) >= 2;
  if (!hasVerified && !hasExternal) return null;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {hasVerified && (
        <ResearchChart
          kind="line"
          title="Verified rent trend"
          subtitle="KigaliRent Verified — monthly median when enough history exists"
          points={(verified || []).map((p) => ({
            label: p.label,
            value: p.median_usd || 0,
            sample_size: p.sample_size,
          }))}
          emptyText="Not enough verified history yet."
        />
      )}
      {hasExternal && (
        <ResearchChart
          kind="line"
          title="External observation trend"
          subtitle="Observed asking rents — not confirmed vacancies"
          points={(external || []).map((p) => ({
            label: p.label,
            value: p.median_usd || 0,
            sample_size: p.sample_size,
          }))}
          emptyText="Not enough external history yet."
        />
      )}
    </div>
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
