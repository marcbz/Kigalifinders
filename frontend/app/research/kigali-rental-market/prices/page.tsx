import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchPricesSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Rental Prices | KigaliRent Research",
  description: "Median, P25, and P75 asking rents for Kigali in USD, with sample sizes and source labels.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/prices" },
};

export default async function ResearchPricesPage() {
  const data = await fetchResearchPricesSafe("kigali");
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">Rental prices</h1>
      <p className="text-gray-600 mb-8">{data?.note}</p>
      <ul className="space-y-6">
        {(data?.items || []).map((item, i) => (
          <li key={`${item.data_kind}-${item.period_end}-${i}`} className="border rounded-xl p-5 bg-white dark:bg-navy-800">
            <p className="text-sm text-gray-500 mb-2">
              {item.data_kind} · ending {item.period_end} · n={item.sample_size}
            </p>
            <p className="text-navy-800 dark:text-white">{item.summary}</p>
          </li>
        ))}
        {!data?.items?.length && <li className="text-gray-500">No price snapshots yet. Run research rebuild in admin.</li>}
      </ul>
    </div>
  );
}
