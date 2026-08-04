import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
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
  return (
    <section className="py-20 px-6 bg-white dark:bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">INVESTMENT OPPORTUNITIES</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3">Premium Plots for Sale</h2>
            <div className="section-divider mt-4" />
          </div>
          <Link href="/properties?listing_type=sale&property_type_slug=plot" className="text-gold-500 font-semibold inline-flex items-center gap-2">
            View All Plots <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {properties.map((property, i) => (
            <PropertyCard key={property.id} property={property} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface AreasSectionProps {
  neighborhoods: { id: string; name: string; slug: string; image_url?: string; property_count: number }[];
}

const areaImages: Record<string, string> = {
  kicukiro: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600",
  gasabo: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600",
  nyarugenge: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600",
  nyarutarama: "https://images.unsplash.com/photo-1518481612222-68bbe828ecd1?w=600",
  kibagabaga: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600",
  kacyiru: "https://images.unsplash.com/photo-1564013434775-f71db0030976?w=600",
  rebero: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=600",
  kiyovu: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600",
  gacuriro: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600",
  kimihurura: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600",
  kagugu: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600",
  kagarama: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=600",
  gisozi: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600",
};

export function AreasSection({ neighborhoods }: AreasSectionProps) {
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {neighborhoods.map((area) => (
            <Link key={area.id} href={`/properties?neighborhood_id=${area.id}`} className="area-card group">
              <Image
                src={area.image_url || areaImages[area.slug] || areaImages.gasabo}
                alt={area.name}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute bottom-5 left-5 z-10 text-white">
                <div className="font-serif text-2xl font-bold">{area.name}</div>
                <div className="text-xs text-gold-400 tracking-wider">{area.property_count} Properties</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
