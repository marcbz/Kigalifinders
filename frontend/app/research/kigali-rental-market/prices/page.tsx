import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchPricesSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Rental Prices",
  description: "Typical asking rents for Kigali from combined eligible rental observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/prices" },
};

export default async function ResearchPricesPage() {
  const data = await fetchResearchPricesSafe("kigali");
  const answer = data?.answer;

  return (
    <div className="max-w-4xl mx-auto px-6 py-14 space-y-8">
      <div>
        <p className="text-sm mb-4">
          <Link href="/research/kigali-rental-market" className="underline">
            ← Research hub
          </Link>
        </p>
        <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">
          How much does renting in Kigali typically cost?
        </h1>
        {answer?.has_enough_data ? (
          <div className="rounded-2xl border bg-white dark:bg-navy-800 p-6 mb-6">
            <p className="text-3xl font-serif text-navy-800 dark:text-white">{answer.headline}</p>
            {answer.range_text && <p className="text-sm text-gray-600 mt-2">{answer.range_text}</p>}
            <p className="text-sm text-gray-600 mt-2">{answer.summary}</p>
            {answer.last_updated_display && (
              <p className="text-xs text-gray-500 mt-2">Updated {answer.last_updated_display}.</p>
            )}
          </div>
        ) : (
          <p className="text-gray-600 mb-6">{answer?.summary || data?.note}</p>
        )}
      </div>

      <section>
        <h2 className="font-serif text-xl font-bold mb-4">Price detail</h2>
        <ul className="space-y-4">
          {(data?.items || []).map((item, i) => (
            <li key={`${item.label}-${i}`} className="border rounded-xl p-5 bg-white dark:bg-navy-800">
              <p className="text-sm text-gray-500 mb-1">{item.label || "Market estimate"}</p>
              <p className="text-navy-800 dark:text-white font-medium">
                {item.median_usd != null ? `Typical asking rent: $${item.median_usd.toLocaleString()}/month` : item.summary}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Based on {item.sample_size} observed listings
                {item.p25_usd != null && item.p75_usd != null
                  ? ` · most between $${item.p25_usd.toLocaleString()}–$${item.p75_usd.toLocaleString()}`
                  : ""}
              </p>
            </li>
          ))}
          {!data?.items?.length && (
            <li className="text-gray-500">Not enough data yet to publish price estimates.</li>
          )}
        </ul>
      </section>

      <p className="text-xs text-gray-500">{data?.note}</p>
    </div>
  );
}
