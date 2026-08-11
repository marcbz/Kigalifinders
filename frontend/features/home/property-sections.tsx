import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
import { NeighborhoodsDirectory } from "@/components/areas/neighborhoods-directory";
import { neighborhoodsForSearchFilter } from "@/lib/neighborhood-groups";
import type { PropertyListItem } from "@/types";

interface PropertyGridProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  properties: PropertyListItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  bgClass?: string;
}

export function PropertyGridSection({
  title,
  subtitle,
  eyebrow = "EXCLUSIVE LISTINGS",
  properties,
  viewAllHref = "/properties",
  viewAllLabel = "View All Properties",
  bgClass = "bg-cream dark:bg-secondary",
}: PropertyGridProps) {
  return (
    <section id="properties" className={`py-20 px-6 ${bgClass}`}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">{eyebrow}</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">{title}</h2>
          <div className="section-divider mx-auto" />
          {subtitle && <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-5">{subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property, i) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>

        {viewAllHref && properties.length > 0 && (
          <div className="text-center mt-12">
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-3 border-2 border-navy-800 dark:border-gold-500 text-navy-800 dark:text-gold-500 hover:bg-navy-800 hover:text-gold-500 dark:hover:bg-gold-500 dark:hover:text-navy-900 px-8 py-3.5 rounded-full font-semibold transition"
            >
              {viewAllLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function FurnishedSection({ properties }: { properties: PropertyListItem[] }) {
  if (!properties.length) return null;
  return (
    <PropertyGridSection
      title="Furnished Homes"
      subtitle="Move-in ready furnished properties — ideal for expats and short-term stays."
      eyebrow="FURNISHED CATALOGUE"
      properties={properties}
      viewAllHref="/properties?listing_type=furnished"
      viewAllLabel="View All Furnished Homes"
      bgClass="bg-white dark:bg-background"
    />
  );
}

interface PlotsSectionProps {
  properties: PropertyListItem[];
}

export function PlotsSection({ properties }: PlotsSectionProps) {
  if (!properties.length) return null;

  return (
    <section className="py-20 px-6 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">INVESTMENT OPPORTUNITIES</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">Properties for Sale</h2>
          <div className="section-divider mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-5">
            Featured houses, apartments, and plots available to buy across Kigali.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            href="/properties?listing_type=sale"
            className="inline-flex items-center gap-3 border-2 border-navy-800 dark:border-gold-500 text-navy-800 dark:text-gold-500 hover:bg-navy-800 hover:text-gold-500 dark:hover:bg-gold-500 dark:hover:text-navy-900 px-8 py-3.5 rounded-full font-semibold transition"
          >
            View All Properties for Sale <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

interface AreasSectionProps {
  neighborhoods: { id: string; name: string; slug: string; image_url?: string; property_count: number; district_name?: string | null }[];
}

export function AreasSection({ neighborhoods }: AreasSectionProps) {
  const areas = neighborhoodsForSearchFilter(neighborhoods);

  return (
    <section id="area" className="py-20 px-6 bg-white dark:bg-background">
      <div className="max-w-5xl mx-auto">
        <NeighborhoodsDirectory neighborhoods={areas} headingLevel="h2" />
      </div>
    </section>
  );
}
