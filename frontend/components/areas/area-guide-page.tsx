import Link from "next/link";
import { PropertyCard } from "@/components/property/property-card";
import { Button } from "@/components/ui/button";
import type { AreaSeoContent } from "@/lib/area-content";
import { getAreaHref, getPropertiesFilterHref } from "@/lib/areas";
import type { PaginatedResponse, PropertyListItem } from "@/types";

type AreaGuidePageProps = {
  name: string;
  slug: string;
  districtName?: string | null;
  content: AreaSeoContent;
  properties: PaginatedResponse<PropertyListItem>;
  related: { slug: string; name: string }[];
};

export function AreaGuidePage({
  name,
  slug,
  districtName,
  content,
  properties,
  related,
}: AreaGuidePageProps) {
  const listHref = getPropertiesFilterHref(slug);
  const locationLine = districtName
    ? districtName.toLowerCase() === name.toLowerCase()
      ? "Kigali, Rwanda"
      : `${districtName} · Kigali, Rwanda`
    : "Rwanda";

  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <nav className="text-sm text-gray-300 mb-6" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-gold-500">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/area" className="hover:text-gold-500">
                  Neighborhoods
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-gold-500">{name}</li>
            </ol>
          </nav>
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">KIGALI RENT AREA GUIDE</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">{content.headline}</h1>
          <p className="text-gray-300 mt-3">{locationLine}</p>
        </div>
      </div>

      <section className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-4 mb-10">
            {content.overview.slice(0, 3).map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>

          {related.length > 0 && (
            <ul className="flex flex-wrap gap-2 mb-12">
              {related.map((area) => (
                <li key={area.slug}>
                  <Link
                    href={getAreaHref(area.slug)}
                    className="text-sm px-3 py-1.5 rounded-full border border-gold-500/30 bg-cream/60 dark:bg-secondary/40 text-navy-800 dark:text-gray-200 hover:border-gold-500"
                  >
                    {area.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">
              Listings in {name}
              {properties.total > 0 && (
                <span className="text-lg font-normal text-gray-500 ml-2">({properties.total})</span>
              )}
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={`/rentals/${encodeURIComponent(slug)}`} className="text-gold-600 hover:underline font-medium">
                {name} rental hub
              </Link>
              <span className="text-gray-400" aria-hidden>
                ·
              </span>
              <Link href="/rentals" className="text-gold-600 hover:underline font-medium">
                All Kigali rentals
              </Link>
            </div>
          </div>

          {properties.items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {properties.items.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
              <div className="mt-12 flex justify-center">
                <Button asChild className="rounded-full px-8">
                  <Link href={listHref}>All listings in {name}</Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No live listings in {name} on Kigali Rent right now. Tell us what you need and we will search with you.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-navy-800 text-white px-6 py-3 text-sm font-semibold hover:bg-navy-700 transition"
              >
                Contact Kigali Rent
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
