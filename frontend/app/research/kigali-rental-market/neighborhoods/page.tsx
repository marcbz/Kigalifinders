import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchNeighborhoodsSafe } from "@/lib/market-api";
import { ResearchDatasetJsonLd } from "@/components/research/research-dataset-jsonld";
import { pageOpenGraph } from "@/lib/seo-metadata";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Rent Prices by Neighbourhood (2026)",
  description:
    "Compare typical monthly asking rents across Kigali neighbourhoods, from Kibagabaga and Kimironko to Nyarutarama and Gacuriro, with ranges and sample sizes.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/neighborhoods" },
  openGraph: pageOpenGraph({
    title: "Kigali Rent Prices by Neighbourhood (2026)",
    url: "https://kigalirent.com/research/kigali-rental-market/neighborhoods",
  }),
};

export default async function ResearchNeighborhoodsPage() {
  const data = await fetchResearchNeighborhoodsSafe();
  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <ResearchDatasetJsonLd
        name="Kigali Rent by Neighbourhood"
        description="Typical monthly asking rents and common ranges for Kigali neighbourhoods such as Kibagabaga, Kimironko, Gacuriro, Nyarutarama and Rebero."
        path="/research/kigali-rental-market/neighborhoods"
        observationCount={(data?.items || []).reduce((sum, n) => sum + (n.sample_size || 0), 0) || null}
        keywords={(data?.items || []).slice(0, 8).map((n) => `${n.label} rent`)}
      />
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="underline">
          ← Research hub
        </Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">
        Kigali rent prices by neighbourhood
      </h1>
      <p className="text-gray-600 mb-4">
        Typical asking rent (USD/month) from combined eligible observations. Neighborhoods without enough
        data are omitted.
      </p>
      <p className="mb-8">
        <Link href="/research/kigali-rental-market/compare" className="underline font-medium">
          Compare two neighborhoods side by side →
        </Link>
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Neighborhood</th>
            <th className="py-2">Typical</th>
            <th className="py-2">Common range</th>
            <th className="py-2">n</th>
          </tr>
        </thead>
        <tbody>
          {(data?.items || []).map((n) => (
            <tr key={n.label} className="border-b">
              <td className="py-3">
                <Link
                  href={`/rentals/${encodeURIComponent((n.label || "").toLowerCase().replace(/\s+/g, "-"))}`}
                  className="underline"
                >
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
      {!data?.items?.length && (
        <p className="text-gray-500 mt-6">Not enough neighborhood data yet.</p>
      )}
    </div>
  );
}
