import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchOverviewSafe, fetchResearchReportsSafe } from "@/lib/market-api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Kigali Rental Market Research | KigaliRent",
  description:
    "USD-first research on Kigali rental prices, neighborhoods, and trends — clearly separating verified KigaliRent inventory from market observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market" },
};

export default async function ResearchHubPage() {
  const [overview, reports] = await Promise.all([
    fetchResearchOverviewSafe(),
    fetchResearchReportsSafe(),
  ]);

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">Research</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
            {overview?.title || "Kigali Rental Market Research"}
          </h1>
          <p className="text-lg text-gray-100 max-w-3xl">
            {overview?.summary ||
              "Transparent rental-market statistics for Kigali, with verified inventory clearly labeled apart from external observations."}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <nav className="flex flex-wrap gap-3 text-sm">
          {(reports?.reports || []).map((r) => (
            <Link key={r.slug} href={r.path} className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800 hover:border-gold-500">
              {r.title}
            </Link>
          ))}
          <Link href="/research/kigali-rental-market/methodology" className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800">
            Methodology
          </Link>
          <Link href="/research/kigali-rental-market/sources" className="px-4 py-2 rounded-full border bg-white dark:bg-navy-800">
            Sources
          </Link>
        </nav>

        <section>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Neighborhood comparison</h2>
          <p className="text-sm text-gray-600 mb-6">Median asking rent from verified KigaliRent listings (USD/month). Sample size shown.</p>
          <ul className="space-y-3">
            {(overview?.neighborhoods || []).map((n) => (
              <li key={n.label} className="flex justify-between gap-4 border-b pb-3 text-sm">
                <span className="text-navy-800 dark:text-white font-medium">{n.label}</span>
                <span className="text-gray-600">
                  {n.median_usd != null ? `$${n.median_usd.toLocaleString()}` : "—"} · n={n.sample_size}
                </span>
              </li>
            ))}
            {!overview?.neighborhoods?.length && (
              <li className="text-gray-500 text-sm">Rebuild research aggregates in admin to populate neighborhood medians.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Observed listing activity</h2>
          <p className="text-sm text-gray-600 mb-4">
            Count of external observations over time. This is not total market supply.
          </p>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {(overview?.activity_series || []).map((a) => (
              <li key={a.month} className="bg-white dark:bg-navy-800 border rounded-lg p-3">
                <div className="text-gray-500">{a.month}</div>
                <div className="text-xl font-serif text-navy-800 dark:text-white">{a.observations}</div>
              </li>
            ))}
            {!overview?.activity_series?.length && (
              <li className="text-gray-500 col-span-2">No external observations imported yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
