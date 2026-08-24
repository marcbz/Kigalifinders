import type { Metadata } from "next";
import Link from "next/link";
import { CiteThisResearch, ResearchTransparency } from "@/components/research/research-transparency";
import { fetchResearchMethodologySafe } from "@/lib/market-api";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Research Methodology & Data Sources | KigaliRent",
  description: "How KigaliRent collects rental research, distinguishes verified inventory from external observations, and documents CSV import references.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/methodology" },
};

export default async function MethodologyPage() {
  const data = await fetchResearchMethodologySafe();
  const transparency = data?.transparency;
  return (
    <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
      <div>
        <p className="text-sm mb-4">
          <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
        </p>
        <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-6">
          {data?.title || "Methodology & Data Sources"}
        </h1>
        <p className="text-gray-700 dark:text-gray-200 mb-6 leading-relaxed">{data?.body}</p>
      </div>

      {transparency && <ResearchTransparency data={transparency} compact />}

      <section>
        <h2 className="font-serif text-xl font-bold mb-4">Rules</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-200">
          {(data?.rules || []).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {(data?.import_batches?.length || 0) > 0 && (
        <section>
          <h2 className="font-serif text-xl font-bold mb-4">Import references</h2>
          <p className="text-sm text-gray-600 mb-4">
            Each CSV import receives a public reference. Raw CSV files are not published.
          </p>
          <ul className="text-sm space-y-2">
            {data!.import_batches!.map((b) => (
              <li key={b.reference} className="border rounded-lg p-3 bg-white dark:bg-navy-800">
                <span className="font-mono font-medium">{b.reference}</span>
                {" · "}
                {new Date(b.imported_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                {b.rows_processed} rows
                {(b.sources?.length || 0) > 0 && ` · ${b.sources!.join(", ")}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <CiteThisResearch
        title="Kigali Rental Market Research — Methodology"
        citationText={transparency?.citation_text}
        canonicalUrl="https://kigalirent.com/research/kigali-rental-market/methodology"
        lastUpdated={transparency?.last_updated_display}
      />
    </div>
  );
}
