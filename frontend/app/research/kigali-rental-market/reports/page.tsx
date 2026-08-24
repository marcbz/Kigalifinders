import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchReportsSafe } from "@/lib/market-api";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kigali Rental Market Reports | KigaliRent",
  description: "Index of KigaliRent rental market research reports.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/reports" },
};

export default async function ReportsPage() {
  const data = await fetchResearchReportsSafe();
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-6">Reports</h1>
      <ul className="space-y-3">
        {(data?.reports || []).map((r) => (
          <li key={r.slug}>
            <Link href={r.path} className="text-gold-600 underline text-lg">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
