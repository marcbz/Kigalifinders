import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchResearchChartsSafe,
  fetchResearchOverviewSafe,
  fetchResearchReportsSafe,
} from "@/lib/market-api";
import { ResearchChart, ResearchRangeCard } from "@/components/research/research-charts";
import { CiteThisResearch, ResearchTransparency } from "@/components/research/research-transparency";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Kigali Rental Market Data & Research | KigaliRent",
  description:
    "Continuously updated Kigali rental market research — KigaliRent Verified listings and External Market Observations shown separately with full source attribution.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market" },
};

export default async function ResearchHubPage() {
  const [overview, reports, charts] = await Promise.all([
    fetchResearchOverviewSafe(),
    fetchResearchReportsSafe(),
    fetchResearchChartsSafe(),
  ]);

  const externalCount = charts?.external_active_count ?? 0;
  const activityPoints = (charts?.observation_activity || []).map((a) => ({
    label: a.month,
    value: a.observations,
  }));

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">Research</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
            {overview?.title || "Kigali Rental Market Research"}
          </h1>
          <p className="text-lg text-gray-100 max-w-3xl">
            {overview?.summary ||
              charts?.transparency?.combined_summary ||
              "Transparent rental-market statistics for Kigali, with verified inventory clearly labeled apart from external observations."}
          </p>
          {(charts?.transparency?.last_updated_display || charts?.last_updated) && (
            <p className="text-sm text-gray-300 mt-4">
              Updated {charts?.transparency?.last_updated_display || charts?.last_updated}
              {charts?.transparency?.total_count
                ? ` · ${charts.transparency.total_count} observations`
                : ""}
            </p>
          )}
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
            className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800"
          >
            Methodology
          </Link>
          <Link
            href="/research/kigali-rental-market/sources"
            className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800"
          >
            Sources
          </Link>
        </nav>

        <ResearchTransparency data={charts?.transparency} />

        <section className="grid md:grid-cols-2 gap-6">
          <ResearchRangeCard
            label={charts?.verified_label || "KigaliRent Verified"}
            typicalText={charts?.price_range?.verified?.typical_text}
            rangeText={charts?.price_range?.verified?.range_text || "Not enough historical data yet."}
            sampleSize={charts?.price_range?.verified?.sample_size || 0}
            periodEnd={charts?.price_range?.verified?.period_end}
          />
          <ResearchRangeCard
            label={charts?.external_label || "External Market Observations"}
            typicalText={charts?.price_range?.external?.typical_text}
            rangeText={
              externalCount > 0
                ? charts?.price_range?.external?.range_text || "Not enough historical data yet."
                : "No external observations imported yet."
            }
            sampleSize={charts?.price_range?.external?.sample_size || externalCount}
            periodEnd={charts?.price_range?.external?.period_end}
            disclaimer={charts?.external_disclaimer}
          />
        </section>

        <ResearchChart
          title="Asking rent by bedroom"
          subtitle="KigaliRent verified inventory · USD/month"
          points={(charts?.by_bedroom || [])
            .filter((b) => b.median_usd != null)
            .map((b) => ({
              label: `${b.bedrooms}+`,
              value: b.median_usd || 0,
              sample_size: b.sample_size,
              p25: b.p25_usd,
              p75: b.p75_usd,
            }))}
        />

        <ResearchChart
          title="External asking rent by bedroom"
          subtitle="External Market Observations · USD/month"
          points={(charts?.by_bedroom_external || [])
            .filter((b) => b.median_usd != null)
            .map((b) => ({
              label: `${b.bedrooms}+`,
              value: b.median_usd || 0,
              sample_size: b.sample_size,
              p25: b.p25_usd,
              p75: b.p75_usd,
            }))}
          emptyText={
            externalCount > 0
              ? "Not enough bedroom breakdown data yet."
              : "No external observations imported yet."
          }
        />

        <ResearchChart
          title="Asking rent by neighborhood"
          subtitle="KigaliRent verified inventory · typical asking rent (USD/month)"
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
        />

        <ResearchChart
          title="External asking rent by neighborhood"
          subtitle="External Market Observations · typical asking rent (USD/month)"
          points={(charts?.by_neighborhood_external || [])
            .filter((n) => n.median_usd != null)
            .slice(0, 12)
            .map((n) => ({
              label: n.label,
              value: n.median_usd || 0,
              sample_size: n.sample_size,
              p25: n.p25_usd,
              p75: n.p75_usd,
            }))}
          emptyText={
            externalCount > 0
              ? "Not enough neighborhood breakdown data yet."
              : "No external observations imported yet."
          }
        />

        <ResearchChart
          title="Median asking rent over time"
          subtitle="KigaliRent verified · enough history required"
          kind="line"
          points={
            charts?.has_trend_history
              ? (charts.trend || [])
                  .filter((t) => t.median_usd != null)
                  .map((t) => ({
                    label: t.period_end.slice(0, 7),
                    value: t.median_usd || 0,
                    sample_size: t.sample_size,
                  }))
              : []
          }
          emptyText="Not enough historical data yet."
        />

        <ResearchChart
          title="External median asking rent over time"
          subtitle="External Market Observations · enough history required"
          kind="line"
          points={
            charts?.has_external_trend_history
              ? (charts.trend_external || [])
                  .filter((t) => t.median_usd != null)
                  .map((t) => ({
                    label: t.period_end.slice(0, 7),
                    value: t.median_usd || 0,
                    sample_size: t.sample_size,
                  }))
              : []
          }
          emptyText={
            externalCount > 0
              ? "Not enough historical data yet."
              : "No external observations imported yet."
          }
        />

        <ResearchChart
          title="External observed listing activity"
          subtitle={`Count of external observations over time — ${externalCount} active observation(s) · not total market supply`}
          kind="line"
          unitPrefix=""
          points={activityPoints}
          emptyText={
            externalCount > 0
              ? "Not enough historical data yet."
              : "No external observations imported yet."
          }
        />

        <CiteThisResearch
          title={overview?.title || "Kigali Rental Market Research"}
          citationText={charts?.transparency?.citation_text}
          canonicalUrl="https://kigalirent.com/research/kigali-rental-market"
          lastUpdated={charts?.transparency?.last_updated_display}
        />

        <p className="text-xs text-gray-500 border-t pt-6">
          Charts use aggregated database snapshots only. External Market Observations are never shown as
          KigaliRent inventory. {charts?.external_disclaimer}
        </p>
      </div>
    </div>
  );
}
