import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyAttributes, RelatedNeighborhoods } from "@/components/rentals/rental-landing-sections";
import { fetchRentalLandingSafe } from "@/lib/market-api";
import { getPropertyHref } from "@/lib/property-url";

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

function truncateIntro(text: string, max = 200): string {
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

  return (
    <div className="bg-cream dark:bg-navy-900 min-h-screen">
      <header className="bg-navy-800 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-gray-300 mb-4">
            <Link href="/rentals" className="hover:text-gold-400">Rentals</Link>
            {" / "}
            <Link href={`/rentals/${page.location_slug}`} className="hover:text-gold-400">
              {page.location_slug.replace(/-/g, " ")}
            </Link>
          </nav>
          <p className="text-gold-400 text-xs tracking-[0.25em] uppercase mb-3">Rental search</p>
          <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3">{page.h1}</h1>
          {intro && (
            <p className="text-base text-gray-200 max-w-3xl leading-relaxed">{intro}</p>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {!!page.key_attributes?.length && <KeyAttributes attrs={page.key_attributes} />}

        <section>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Available verified rentals</p>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-6">
            {page.match_count} verified {page.match_count === 1 ? "property" : "properties"}
          </h2>

          {page.verified_matches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 bg-white dark:bg-navy-800">
              <p className="text-navy-800 dark:text-white font-medium mb-2">
                No verified listings match this exact search right now.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <Link href="/properties" className="text-gold-600 underline">
                  Browse all rentals
                </Link>
              </p>
            </div>
          ) : (
            <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {page.verified_matches.map((p) => (
                <li key={p.id} className="bg-white dark:bg-navy-800 rounded-xl overflow-hidden border shadow-sm">
                  <Link href={getPropertyHref(p)} className="block">
                    <div className="relative aspect-[4/3] bg-navy-700">
                      {p.primary_image ? (
                        <Image src={p.primary_image} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
                      ) : null}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                        <span className="bg-gold-500/15 text-gold-700 px-2 py-0.5 rounded">Verified</span>
                        {p.is_furnished && <span className="bg-navy-100 text-navy-700 px-2 py-0.5 rounded">Furnished</span>}
                      </div>
                      <h3 className="font-serif text-lg font-semibold text-navy-800 dark:text-white line-clamp-2">{p.title}</h3>
                      <p className="text-gold-600 font-semibold">${(p.usd_price ?? p.price).toLocaleString()}/month</p>
                      <p className="text-xs text-gray-500">
                        {p.neighborhood_name}
                        {p.bedrooms != null ? ` · ${p.bedrooms} bed` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {page.related.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Related rental searches</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {page.related.map((r) => (
                <li key={r.path}>
                  <Link href={r.path} className="block rounded-lg border bg-white dark:bg-navy-800 px-4 py-3 hover:border-gold-500 transition">
                    <span className="text-navy-800 dark:text-white font-medium">{r.h1}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(page.related_neighborhoods?.length || 0) > 0 && (
          <RelatedNeighborhoods items={page.related_neighborhoods!} />
        )}
      </div>
    </div>
  );
}
