import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchPricesSafe } from "@/lib/market-api";
import { ResearchChart } from "@/components/research/research-charts";
import {
  BudgetBandsTable,
  CombinedTrendChart,
  MarketAnswerBlock,
  ResearchNarrativeSections,
} from "@/components/research/research-narrative";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Kigali Rental Prices 2026: Cost of Renting in Kigali",
  description:
    "Typical asking rents in Kigali with middle-50% ranges, bedroom and neighbourhood comparisons, trends, and sample sizes from combined eligible observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/prices" },
};

export default async function ResearchPricesPage() {
  const data = await fetchResearchPricesSafe("kigali");
  const answer = data?.answer;
  const sections = data?.sections;

  return (
    <div className="max-w-4xl mx-auto px-6 py-14 space-y-10">
      <div>
        <p className="text-sm mb-4">
          <Link href="/research/kigali-rental-market" className="underline">
            ← Research hub
          </Link>
        </p>
        <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-3">
          Kigali Rental Prices 2026: Cost of Renting in Kigali
        </h1>
        <p className="text-gray-600 max-w-2xl">
          Asking-rent estimates for journalists, researchers, NGOs, investors, relocation teams, and
          institutions — built from the full eligible observation set, not a single listing inventory.
        </p>
      </div>

      <MarketAnswerBlock answer={answer} />

      {(data?.bedroom_answers?.length || 0) > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold">How much does a 2-bedroom rental cost in Kigali?</h2>
          <p className="text-sm text-gray-600">Bedroom comparisons when enough eligible observations exist.</p>
          <ul className="grid sm:grid-cols-2 gap-4">
            {(data?.bedroom_answers || []).map((a) => (
              <li key={a.question} className="rounded-xl border bg-white dark:bg-navy-800 p-5">
                <h3 className="text-sm text-gray-500 mb-1">{a.question}</h3>
                <p className="text-2xl font-serif">{a.headline}</p>
                {a.plain_english && <p className="text-sm text-gray-600 mt-2">{a.plain_english}</p>}
                <p className="text-xs text-gray-500 mt-2">
                  Based on {a.sample_size} eligible observations
                  {a.period_end ? ` · period through ${a.period_end}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResearchChart
        title="Asking rent by bedroom"
        subtitle="Combined eligible observations · median and middle 50% on hover"
        points={(data?.by_bedroom || [])
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

      {(data?.property_type_answers?.length || 0) > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold">What is the typical rent for apartments in Kigali?</h2>
          <ul className="grid sm:grid-cols-2 gap-4">
            {(data?.property_type_answers || []).map((a) => (
              <li key={a.question} className="rounded-xl border bg-white dark:bg-navy-800 p-5">
                <h3 className="text-sm text-gray-500 mb-1">{a.question}</h3>
                <p className="text-2xl font-serif">{a.headline}</p>
                <p className="text-xs text-gray-500 mt-2">Based on {a.sample_size} eligible observations</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResearchChart
        title="Asking rent by neighbourhood"
        subtitle="Which Kigali neighbourhoods have the highest asking rents?"
        points={(data?.by_neighborhood || [])
          .filter((n) => n.median_usd != null)
          .slice(0, 12)
          .map((n) => ({
            label: n.label,
            value: n.median_usd || 0,
            sample_size: n.sample_size,
            p25: n.p25_usd,
            p75: n.p75_usd,
          }))}
        emptyText="Not enough neighbourhood data yet."
      />

      {data?.furnished_breakdown &&
        ((data.furnished_breakdown.furnished?.sample_size || 0) >= 5 ||
          (data.furnished_breakdown.unfurnished?.sample_size || 0) >= 5) && (
          <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
            <h2 className="font-serif text-xl font-bold mb-3">Furnished vs unfurnished</h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Furnished (typical asking rent)</dt>
                <dd className="text-2xl font-serif">
                  {data.furnished_breakdown.furnished?.median_usd != null
                    ? `$${data.furnished_breakdown.furnished.median_usd.toLocaleString()}/month`
                    : "Not enough data"}
                </dd>
                <p className="text-xs text-gray-500 mt-1">
                  n={data.furnished_breakdown.furnished?.sample_size || 0}
                  {data.furnished_breakdown.furnished?.p25_usd != null &&
                    data.furnished_breakdown.furnished?.p75_usd != null &&
                    ` · middle 50%: $${data.furnished_breakdown.furnished.p25_usd.toLocaleString()}–$${data.furnished_breakdown.furnished.p75_usd.toLocaleString()}`}
                </p>
              </div>
              <div>
                <dt className="text-gray-500">Unfurnished (typical asking rent)</dt>
                <dd className="text-2xl font-serif">
                  {data.furnished_breakdown.unfurnished?.median_usd != null
                    ? `$${data.furnished_breakdown.unfurnished.median_usd.toLocaleString()}/month`
                    : "Not enough data"}
                </dd>
                <p className="text-xs text-gray-500 mt-1">
                  n={data.furnished_breakdown.unfurnished?.sample_size || 0}
                </p>
              </div>
            </dl>
          </section>
        )}

      <BudgetBandsTable bands={data?.budget_bands} />

      <CombinedTrendChart trend={data?.trend} hasHistory={data?.has_trend_history} />

      {(data?.insights?.length || 0) > 0 && !sections?.what_the_data_shows?.length && (
        <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
          <h2 className="font-serif text-xl font-bold mb-3">What the data shows</h2>
          <ul className="text-sm space-y-2 list-disc pl-5">
            {data!.insights!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <ResearchNarrativeSections sections={sections} />

      <p className="text-xs text-gray-500">{data?.note}</p>
    </div>
  );
}
