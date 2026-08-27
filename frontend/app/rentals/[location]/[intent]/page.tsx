import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AskingRentSnapshot,
  FullCatalogueCta,
  KeyAttributes,
  RelatedNeighborhoods,
  RelatedRentalSearches,
  RentalListingsSection,
} from "@/components/rentals/rental-landing-sections";
import { fetchRentalLandingSafe } from "@/lib/market-api";

interface Props {
  params: Promise<{ location: string; intent: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location, intent } = await params;
  const page = await fetchRentalLandingSafe(location, intent);
  if (!page) return { title: "Rentals", robots: { index: false } };
  return {
    title: page.title,
    description: page.meta_description,
    alternates: { canonical: page.canonical },
    robots: page.robots.includes("noindex")
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

function truncateIntro(text: string, max = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function shortIntro(page: {
  meta_description?: string;
  intro_html?: string;
  intro?: string;
  answer?: string;
}): string | null {
  if (page.meta_description?.trim()) return page.meta_description.trim();
  if (page.intro_html) {
    const text = page.intro_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) return truncateIntro(text);
  }
  const fallback = (page.intro || page.answer || "").trim();
  return fallback ? truncateIntro(fallback) : null;
}

export default async function RentalLandingPage({ params }: Props) {
  const { location, intent } = await params;
  const page = await fetchRentalLandingSafe(location, intent);
  if (!page) notFound();

  const intro = shortIntro(page);
  const listings = (page.verified_matches || []).slice(0, 8);

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-gray-300 mb-4">
            <Link href="/rentals" className="hover:text-gold-400">
              Rentals
            </Link>
            {" / "}
            <Link href={`/rentals/${page.location_slug}`} className="hover:text-gold-400">
              {page.location_slug.replace(/-/g, " ")}
            </Link>
          </nav>
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">Rental search</p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3">{page.h1}</h1>
          {intro && <p className="text-base text-gray-200 max-w-3xl leading-relaxed">{intro}</p>}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <RentalListingsSection listings={listings} />

        <FullCatalogueCta />

        {page.related.length > 0 && <RelatedRentalSearches items={page.related} />}

        {(page.related_neighborhoods?.length || 0) > 0 && (
          <RelatedNeighborhoods items={page.related_neighborhoods!} />
        )}

        <AskingRentSnapshot marketAnswer={page.market_answer} />

        {!!page.key_attributes?.length && <KeyAttributes attrs={page.key_attributes} />}

        {page.answer && (
          <section className="text-sm text-gray-600 dark:text-gray-300 max-w-3xl">
            <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-2">
              About this search
            </h2>
            <p>{page.answer}</p>
          </section>
        )}
      </div>
    </div>
  );
}
