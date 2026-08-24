import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchResearchChartsSafe,
  fetchResearchReportsSafe,
} from "@/lib/market-api";
import { ResearchChart } from "@/components/research/research-charts";
import {
  AboutThisDataBlock,
  CiteThisResearch,
} from "@/components/research/research-transparency";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Kigali Rental Market Data & Research",
  description:
    "Independent Kigali rental market research: typical asking rents, trends, and neighborhood comparisons from combined eligible observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market" },
};

export default async function ResearchHubPage() {
  const [reports, charts] = await Promise.all([
    fetchResearchReportsSafe(),
    fetchResearchChartsSafe(),
  ]);

  const primary = charts?.primary_answer;
  const about = charts?.about;
  const citation = charts?.citation;

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-[0.2em] uppercase text-gray-300 mb-3">Market research</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
            {charts?.title || "Kigali Rental Market Data & Research"}
          </h1>
          <p className="text-lg text-gray-100 max-w-3xl">
            Useful asking-rent estimates for Kigali, built from eligible observed rental listings.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <nav className="flex flex-wrap gap-3 text-sm">
          {(reports?.reports || []).map((r) => (
            <Link
              key={r.slug}
              href={r.path}
              className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800 hover:border-gold-500"
            >
              {r.title}
            </Link>
          ))}
          <Link
            href="/research/kigali-rental-market/methodology"
            className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800 text-gray-600"
          >
            Data sources &amp; methodology
          </Link>
        </nav>

        {/* Answer-first primary result */}
        <section className="rounded-2xl border bg-white dark:bg-navy-800 p-8 space-y-3">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">
            {primary?.question || "How much does renting in Kigali typically cost?"}
          </h2>
          {primary?.has_enough_data ? (
            <>
              <p className="text-3xl md:text-4xl font-serif text-navy-800 dark:text-white">
                {primary.headline}
              </p>
              {primary.range_text && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{primary.range_text}</p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300">{primary.summary}</p>
              {primary.last_updated_display && (
                <p className="text-xs text-gray-500">Updated {primary.last_updated_display}.</p>
              )}
              {primary.asking_rent_note && (
                <p className="text-xs text-gray-500">{primary.asking_rent_note}</p>
              )}
            </>
          ) : (
            <p className="text-gray-600">
              {primary?.summary ||
                "Not enough eligible observations yet to publish a defensible market estimate."}
            </p>
          )}
        </section>

        {(charts?.bedroom_answers?.length || 0) > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">By bedrooms</h2>
            <ul className="grid sm:grid-cols-2 gap-4">
              {charts!.bedroom_answers!.map((a) => (
                <li key={a.question} className="rounded-xl border bg-white dark:bg-navy-800 p-5">
                  <h3 className="text-sm text-gray-500 mb-1">{a.question}</h3>
                  <p className="text-2xl font-serif text-navy-800 dark:text-white">{a.headline}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Based on {a.sample_size} observed listings
                    {a.last_updated_display ? ` · Updated ${a.last_updated_display}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(charts?.insights?.length || 0) > 0 && (
          <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
            <h2 className="font-serif text-xl font-bold mb-3">What the data shows</h2>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc pl-5">
              {charts!.insights!.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        <ResearchChart
          title="Asking rent over time"
          subtitle="Combined eligible observations · USD/month"
          kind="line"
          points={
            charts?.has_trend_history
              ? (charts.trend || [])
                  .filter((t) => t.median_usd != null)
                  .map((t) => ({
                    label: (t.label || t.period_end || "").slice(0, 7),
                    value: t.median_usd || 0,
                    sample_size: t.sample_size,
                  }))
              : []
          }
          emptyText="Not enough historical data yet for a trend line."
        />

        <ResearchChart
          title="Asking rent by bedroom"
          subtitle="Combined eligible observations · USD/month"
          points={(charts?.by_bedroom || [])
            .filter((b) => b.median_usd != null)
            .map((b) => ({
              label: b.label || `${b.bedrooms}`,
              value: b.median_usd || 0,
              sample_size: b.sample_size,
              p25: b.p25_usd,
              p75: b.p75_usd,
            }))}
          emptyText="Not enough bedroom breakdown data yet."
        />

        <ResearchChart
          title="Asking rent by neighborhood"
          subtitle="Neighborhoods with enough observations · USD/month"
          points={(charts?.by_neighborhood || [])
            .filter((n) => n.median_usd != null)
            .slice(0, 12)
            .map((n) => ({
              label: n.label,
              value: n.median_usd || 0,
              sample_size: n.sample_size,
              p25: n.p25_usd,
              p75: n.p75_usd,
            }))}
          emptyText="Not enough neighborhood data yet."
        />

        {charts?.furnished_breakdown &&
          (charts.furnished_breakdown.furnished.sample_size >= 5 ||
            charts.furnished_breakdown.unfurnished.sample_size >= 5) && (
            <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
              <h2 className="font-serif text-xl font-bold mb-3">Furnished vs unfurnished</h2>
              <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Furnished (typical)</dt>
                  <dd className="text-2xl font-serif">
                    {charts.furnished_breakdown.furnished.median_usd != null
                      ? `$${charts.furnished_breakdown.furnished.median_usd.toLocaleString()}`
                      : "Not enough data"}
                  </dd>
                  <p className="text-xs text-gray-500 mt-1">
                    n={charts.furnished_breakdown.furnished.sample_size}
                  </p>
                </div>
                <div>
                  <dt className="text-gray-500">Unfurnished (typical)</dt>
                  <dd className="text-2xl font-serif">
                    {charts.furnished_breakdown.unfurnished.median_usd != null
                      ? `$${charts.furnished_breakdown.unfurnished.median_usd.toLocaleString()}`
                      : "Not enough data"}
                  </dd>
                  <p className="text-xs text-gray-500 mt-1">
                    n={charts.furnished_breakdown.unfurnished.sample_size}
                  </p>
                </div>
              </dl>
            </section>
          )}

        <AboutThisDataBlock about={about} />

        <CiteThisResearch
          title={citation?.title || charts?.title || "Kigali Rental Market Data & Research"}
          citationText={citation?.text}
          canonicalUrl={citation?.canonical_url || "https://kigalirent.com/research/kigali-rental-market"}
          lastUpdated={citation?.last_updated || about?.last_updated_display}
        />

        <section className="text-sm border-t pt-8">
          <p className="text-gray-600 dark:text-gray-300 mb-2">Looking for a place to rent?</p>
          <Link href="/rentals" className="text-gold-600 underline">
            View currently verified rental listings
          </Link>
        </section>
      </div>
    </div>
  );
}
