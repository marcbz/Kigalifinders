import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchNeighborhoodsSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Neighborhood Rents | KigaliRent Research",
  description: "Compare median asking rents across Kigali neighborhoods using verified inventory samples.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/neighborhoods" },
};

export default async function ResearchNeighborhoodsPage() {
  const data = await fetchResearchNeighborhoodsSafe();
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">Neighborhood comparison</h1>
      <p className="text-gray-600 mb-8">Median asking rent (USD/month) with sample size. Insufficient samples are omitted.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Neighborhood</th>
            <th className="py-2">Median</th>
            <th className="py-2">P25–P75</th>
            <th className="py-2">n</th>
          </tr>
        </thead>
        <tbody>
          {(data?.items || []).map((n) => (
            <tr key={n.label} className="border-b">
              <td className="py-3">
                <Link href={`/area/${encodeURIComponent((n.label || "").toLowerCase().replace(/\s+/g, "-"))}`} className="text-gold-600 underline">
                  {n.label}
                </Link>
              </td>
              <td>{n.median_usd != null ? `$${n.median_usd.toLocaleString()}` : "—"}</td>
              <td>
                {n.p25_usd != null && n.p75_usd != null
                  ? `$${n.p25_usd.toLocaleString()}–$${n.p75_usd.toLocaleString()}`
                  : "—"}
              </td>
              <td>{n.sample_size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
