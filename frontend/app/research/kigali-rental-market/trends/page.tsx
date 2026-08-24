import type { Metadata } from "next";
import Link from "next/link";
import { ResearchChart } from "@/components/research/research-charts";
import { fetchResearchTrendsSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Rental Market Trends",
  description: "Asking-rent trends over time for Kigali from combined eligible rental observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/trends" },
};

export default async function ResearchTrendsPage() {
  const data = await fetchResearchTrendsSafe();
  const answer = data?.answer;

  return (
    <div className="max-w-4xl mx-auto px-6 py-14 space-y-10">
      <div>
        <p className="text-sm mb-4">
          <Link href="/research/kigali-rental-market" className="underline">
            ← Research hub
          </Link>
        </p>
        <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">Trends</h1>
        {answer?.has_enough_data ? (
          <div className="mb-6">
            <p className="text-2xl font-serif text-navy-800 dark:text-white">{answer.headline}</p>
            <p className="text-sm text-gray-600 mt-2">{answer.summary}</p>
          </div>
        ) : (
          <p className="text-gray-600 mb-6">{data?.summary}</p>
        )}
      </div>

      <ResearchChart
        title="Median asking rent over time"
        subtitle="Combined eligible observations · USD/month"
        kind="line"
        points={(data?.median_series || [])
          .filter((p) => p.median_usd != null)
          .map((p) => ({
            label: (p.period_end || "").slice(0, 7),
            value: p.median_usd || 0,
            sample_size: p.sample_size,
          }))}
        emptyText="Not enough historical data yet."
      />

      <section>
        <h2 className="font-semibold mb-3">Observation activity</h2>
        <p className="text-sm text-gray-600 mb-4">{data?.disclaimer}</p>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {(data?.observation_activity || []).map((a) => (
            <li key={a.month} className="border rounded-lg p-3 bg-white dark:bg-navy-800">
              <div className="text-gray-500">{a.month}</div>
              <div className="text-xl font-serif">{a.observations}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
