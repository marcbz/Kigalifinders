import Link from "next/link";
import { PropertyCard } from "@/components/property/property-card";
import { Button } from "@/components/ui/button";
import type { AreaSeoContent } from "@/lib/area-content";
import { getAreaHref, getPropertiesFilterHref } from "@/lib/areas";
import type { AreaListingStats } from "@/lib/area-listing-stats";
import type { PaginatedResponse, PropertyListItem } from "@/types";

type AreaGuidePageProps = {
  name: string;
  slug: string;
  districtName?: string | null;
  content: AreaSeoContent;
  stats: AreaListingStats;
  properties: PaginatedResponse<PropertyListItem>;
  related: { slug: string; name: string }[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white mb-4">{title}</h2>
      <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export function AreaGuidePage({
  name,
  slug,
  districtName,
  content,
  stats,
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
          <Section title={`What ${name} is like`}>
            {content.overview.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </Section>

          <Section title="Rents and prices on Kigali Rent">
            {stats.rentRangeLabel ? (
              <p>{stats.rentRangeLabel}.</p>
            ) : (
              <p>
                We do not have enough current rental listings in {name} to quote a typical monthly range. Figures below
                are only what is on Kigali Rent right now — not a city-wide index.
              </p>
            )}
            <p>
              {stats.total} live listing{stats.total === 1 ? "" : "s"} on this page
              {stats.rentCount ? ` · ${stats.rentCount} rental` : ""}
              {stats.saleCount ? ` · ${stats.saleCount} for sale` : ""}
              {stats.furnishedCount ? ` · ${stats.furnishedCount} furnished` : ""}.
            </p>
          </Section>

          <Section title="Property types and bedrooms">
            <p>{content.propertyTypes}</p>
            {stats.typeSummary && <p>On current listings: {stats.typeSummary}.</p>}
            {stats.bedroomSummary && <p>Bedroom mix in the current set: {stats.bedroomSummary}.</p>}
          </Section>

          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div>
              <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-3">Why people live here</h2>
              <ul className="list-disc pl-5 text-gray-600 dark:text-gray-400 space-y-2">
                {content.pros.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-3">Trade-offs</h2>
              <ul className="list-disc pl-5 text-gray-600 dark:text-gray-400 space-y-2">
                {content.cons.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <Section title="Getting around">
            <p>{content.transport}</p>
          </Section>
          <Section title="Daily amenities">
            <p>{content.amenities}</p>
          </Section>
          <Section title="Schools">
            <p>{content.schools}</p>
          </Section>
          <Section title="Who it suits">
            <p>{content.bestFor}</p>
          </Section>

          {related.length > 0 && (
            <Section title="Nearby area guides">
              <ul className="flex flex-wrap gap-2">
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
            </Section>
          )}

          <div className="mb-8">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">
              Current Kigali Rent listings in {name}
              {properties.total > 0 && (
                <span className="text-lg font-normal text-gray-500 ml-2">({properties.total})</span>
              )}
            </h2>
            <p className="text-gray-500 text-sm mt-2">Updated from live inventory. Prices change when a listing does.</p>
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
