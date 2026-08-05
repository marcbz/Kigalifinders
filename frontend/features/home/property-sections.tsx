import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
import { neighborhoodsForHomepageDisplay } from "@/lib/homepage-areas";
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
            <PropertyCard key={property.id} property={property} index={i} />
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
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">Premium Plots for Sale</h2>
          <div className="section-divider mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {properties.map((property, i) => (
            <PropertyCard key={property.id} property={property} index={i} />
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            href="/properties?listing_type=sale&property_type_slug=plot"
            className="inline-flex items-center gap-3 border-2 border-navy-800 dark:border-gold-500 text-navy-800 dark:text-gold-500 hover:bg-navy-800 hover:text-gold-500 dark:hover:bg-gold-500 dark:hover:text-navy-900 px-8 py-3.5 rounded-full font-semibold transition"
          >
            View All Plots <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

interface AreasSectionProps {
  neighborhoods: { id: string; name: string; slug: string; image_url?: string; property_count: number }[];
}

const AREA_GRADIENTS = [
  "from-gold-400 to-amber-600",
  "from-navy-600 to-navy-900",
  "from-amber-500 to-orange-600",
  "from-slate-600 to-slate-800",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-rose-400 to-rose-600",
  "from-cyan-500 to-blue-700",
];

export function AreasSection({ neighborhoods }: AreasSectionProps) {
  const areas = neighborhoodsForHomepageDisplay(neighborhoods);

  return (
    <section id="areas" className="py-20 px-6 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">EXPLORE KIGALI</span>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">Areas We Serve</h2>
          <div className="section-divider mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-5">
            From bustling city centers to tranquil hillside neighborhoods, we know Kigali inside and out.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {areas.map((area, index) => (
            <Link
              key={area.id}
              href={`/properties?neighborhood_slug=${area.slug}`}
              className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-gold-500/15 bg-cream/40 dark:bg-secondary/40 hover:border-gold-500/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${AREA_GRADIENTS[index % AREA_GRADIENTS.length]} flex items-center justify-center shadow-md ring-4 ring-white dark:ring-background group-hover:scale-105 transition-transform`}
              >
                <MapPin className="w-7 h-7 text-white drop-shadow-sm" />
              </div>
              <div className="text-center min-w-0">
                <div className="font-serif text-base md:text-lg font-bold text-navy-800 dark:text-white leading-tight">
                  {area.name}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
