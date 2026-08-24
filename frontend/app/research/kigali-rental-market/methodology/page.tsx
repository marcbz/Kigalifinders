import type { Metadata } from "next";
import Link from "next/link";
import { fetchResearchMethodologySafe } from "@/lib/market-api";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Research Methodology | KigaliRent",
  description: "How KigaliRent calculates rental statistics and distinguishes verified inventory from market observations.",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/methodology" },
};

export default async function MethodologyPage() {
  const data = await fetchResearchMethodologySafe();
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href="/research/kigali-rental-market" className="text-gold-600 underline">← Research hub</Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-6">{data?.title || "Methodology"}</h1>
      <p className="text-gray-700 dark:text-gray-200 mb-6 leading-relaxed">{data?.body}</p>
      <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-200">
        {(data?.rules || []).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
