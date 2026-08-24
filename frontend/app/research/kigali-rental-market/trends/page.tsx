import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchTrendsSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Rental Market Trends | KigaliRent Research",
  description: "Median asking rent over time and observed listing activity for Kigali — with accessible textual summaries.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/trends" },
};

export default async function ResearchTrendsPage() {
  const data = await fetchResearchTrendsSafe();
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">Trends</h1>
      <p className="text-gray-600 mb-8">{data?.summary}</p>
      <h2 className="font-semibold mb-3">Median asking rent over time (verified)</h2>
      <ul className="space-y-2 mb-10 text-sm">
        {(data?.median_series || []).map((p) => (
          <li key={p.period_end} className="flex justify-between border-b py-2">
            <span>{p.period_end}</span>
            <span>
              {p.median_usd != null ? `$${p.median_usd.toLocaleString()}` : "—"} (n={p.sample_size})
            </span>
          </li>
        ))}
        {!data?.median_series?.length && <li className="text-gray-500">No trend series yet.</li>}
      </ul>
      <h2 className="font-semibold mb-3">Observed listing activity</h2>
      <p className="text-sm text-gray-600 mb-4">{data?.disclaimer}</p>
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {(data?.observation_activity || []).map((a) => (
          <li key={a.month} className="border rounded-lg p-3 bg-white dark:bg-navy-800">
            <div className="text-gray-500">{a.month}</div>
            <div className="text-xl font-serif">{a.observations}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
