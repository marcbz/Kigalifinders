import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchSourcesSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Research Sources | KigaliRent",
  description: "Data sources behind KigaliRent market research, with verified inventory labeled separately from observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/sources" },
};

export default async function SourcesPage() {
  const data = await fetchResearchSourcesSafe();
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-6">Sources</h1>
      <p className="text-sm text-gray-600 mb-6">
        External listings are observed on third-party sites. They are not verified by KigaliRent and availability is not confirmed.
      </p>
      <ul className="space-y-4">
        {(data?.sources || []).map((s) => (
          <li key={s.source_key || s.source} className="border rounded-xl p-4 bg-white dark:bg-navy-800">
            <div className="font-medium text-navy-800 dark:text-white">
              {s.kind === "market_observation" ? (
                <>
                  External market observation — Source:{" "}
                  {s.source_url ? (
                    <a href={s.source_url} target="_blank" rel="noreferrer" className="text-gold-600 underline">
                      {s.source}
                    </a>
                  ) : (
                    s.source
                  )}
                </>
              ) : (
                s.source
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {s.observation_count != null ? `${s.observation_count} observations` : "Verified inventory"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
