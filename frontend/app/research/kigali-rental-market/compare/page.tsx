import type { Metadata } from "next";
import Link from "next/link";
import { fetchComparePairsSafe } from "@/lib/market-api";

export const revalidate = 600;

const HUB = "/research/kigali-rental-market";

export const metadata: Metadata = {
  title: "Compare Kigali Neighborhoods: Rent Prices Side by Side",
  description:
    "Head-to-head rent comparisons for Kigali neighborhoods like Kibagabaga, Nyarutarama, Gacuriro and Kimihurura: typical rent, bedrooms, furnished homes and amenities.",
  alternates: { canonical: `https://kigalirent.com${HUB}/compare` },
};

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export default async function CompareIndexPage() {
  const data = await fetchComparePairsSafe();
  const items = data?.items || [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <p className="text-sm mb-4">
        <Link href={HUB} className="underline">
          ← Research hub
        </Link>
      </p>
      <h1 className="font-serif text-4xl font-bold text-navy-800 dark:text-white mb-4">
        Compare Kigali neighborhoods
      </h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-3xl">
        Choosing between two areas? Each comparison puts typical asking rent, rent by bedroom count, furnished
        homes and amenities side by side, using the same data as our{" "}
        <Link href={`${HUB}/neighborhoods`} className="underline">
          neighborhood rent table
        </Link>
        . Only neighborhoods with enough recent listings are included.
      </p>

      {items.length ? (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map((p) => (
            <li key={p.slug}>
              <Link
                href={`${HUB}/compare/${p.slug}`}
                className="flex items-center justify-between gap-4 rounded-xl border bg-white dark:bg-navy-800 px-5 py-4 hover:border-gold-500 transition"
              >
                <span className="font-medium text-navy-800 dark:text-white">
                  {p.a.name} vs {p.b.name}
                </span>
                <span className="text-sm text-gray-500 tabular-nums shrink-0">
                  {money(p.a.typical_usd)} · {money(p.b.typical_usd)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">Not enough neighborhood data for comparisons yet.</p>
      )}
    </div>
  );
}
