import type { Metadata } from "next";
import Link from "next/link";
import { CiteThisResearch } from "@/components/research/research-transparency";
import { fetchResearchSourcesSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Research Sources | KigaliRent",
  description: "Data sources behind KigaliRent market research, with verified inventory labeled separately from external observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/sources" },
};

export default async function SourcesPage() {
  const data = await fetchResearchSourcesSafe();
  const external = (data?.sources || []).filter((s) => s.kind === "market_observation");
  const verified = (data?.sources || []).find((s) => s.kind === "verified_kigali_rent");

  return (
    <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
      <div>
        <p className="text-sm mb-4">
          <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
        </p>
        <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">Sources</h1>
        {data?.combined_summary && (
          <p className="text-sm text-gray-600 mb-6">{data.combined_summary}</p>
        )}
        <p className="text-sm text-gray-600">
          External listings are observed on third-party sites. They are not verified by KigaliRent and availability is not confirmed.
        </p>
      </div>

      {verified && (
        <section className="border rounded-xl p-4 bg-white dark:bg-navy-800">
          <h2 className="font-medium text-navy-800 dark:text-white">KigaliRent Verified</h2>
          <p className="text-sm text-gray-500 mt-1">{verified.attribution || "Reviewed listings on KigaliRent only."}</p>
          <Link href="/properties" className="text-sm text-gold-600 underline mt-2 inline-block">
            Browse verified listings
          </Link>
        </section>
      )}

      <section>
        <h2 className="font-serif text-xl font-bold mb-4">External Market Observations</h2>
        <ul className="space-y-4">
          {external.map((s) => (
            <li key={s.source_key || s.source} className="border rounded-xl p-4 bg-white dark:bg-navy-800">
              <div className="font-medium text-navy-800 dark:text-white">
                {s.source_url ? (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="text-gold-600 underline">
                    {s.source}
                  </a>
                ) : (
                  s.source
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {s.attribution || `External market observation — Source: ${s.source}`}
              </p>
              {s.observation_count != null && (
                <p className="text-xs text-gray-400 mt-1">{s.observation_count} observations in database</p>
              )}
            </li>
          ))}
          {!external.length && (
            <li className="text-sm text-gray-500">No external observation sources imported yet.</li>
          )}
        </ul>
      </section>

      <CiteThisResearch
        title="Kigali Rental Market Research — Sources"
        canonicalUrl="https://kigalirent.com/research/kigali-rental-market/sources"
      />
    </div>
  );
}
