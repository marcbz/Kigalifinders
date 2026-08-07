import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, Bed, MapPin, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropertyListItem } from "@/types";
import { formatPrice } from "@/lib/utils";
import { getListingBadge, getPropertyAreaLabel } from "@/lib/property-features";
import { getPropertyHref } from "@/lib/property-url";
import { PropertyCardActions } from "@/components/property/property-card-actions";
import { PropertyImageFrame } from "@/components/property/property-image-frame";

interface PropertyCardProps {
  property: PropertyListItem;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const listingBadge = getListingBadge(property);
  const areaLabel = getPropertyAreaLabel(property);
  const isPlot = property.listing_type === "sale" && property.lot_size_sqm;
  const href = getPropertyHref(property);

  return (
    <article className="property-card group relative">
      <Link
        href={href}
        prefetch
        className="absolute inset-0 z-[1] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        aria-label={`View ${property.title}`}
      />

      <PropertyImageFrame className="relative overflow-hidden h-64 select-none">
        <Image
          src={property.primary_image || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"}
          alt={property.title}
          fill
          loading="lazy"
          fetchPriority="low"
          className="object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
          sizes="(max-width: 768px) 100vw, 33vw"
          draggable={false}
        />
        <span className="absolute top-4 left-4 badge-gold px-3 py-1 rounded z-10">
          {listingBadge}
        </span>
        <PropertyCardActions />
      </PropertyImageFrame>

      <div className="p-6 relative z-[2] pointer-events-none">
        <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-2 group-hover:text-gold-600 transition-colors">
          {property.title}
        </h3>
        <div className="text-gray-500 text-sm mb-4 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-gold-500" />
          {property.neighborhood_name
            ? `${property.neighborhood_name}${property.district_name ? `, ${property.district_name}` : ""}`
            : property.district_name || "Kigali"}
        </div>

        <div className="flex flex-wrap gap-5 text-sm text-gray-700 dark:text-gray-300 border-y py-3 mb-4">
          {property.bedrooms != null && (
            <span className="flex items-center gap-1"><Bed className="w-4 h-4 text-gold-500" /> {property.bedrooms} Beds</span>
          )}
          {property.bathrooms != null && (
            <span className="flex items-center gap-1"><Bath className="w-4 h-4 text-gold-500" /> {property.bathrooms} Baths</span>
          )}
          {areaLabel && (
            <span className="flex items-center gap-1">
              <Ruler className="w-4 h-4 text-gold-500" />
              {areaLabel}
            </span>
          )}
          {isPlot && property.has_title_deed && (
            <span className="text-gold-500">Title Deed</span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div>
            {!isPlot && <div className="text-[11px] tracking-widest text-gray-400 uppercase">From</div>}
            <div className="font-serif text-2xl font-bold text-navy-800 dark:text-white">
              {formatPrice(property.price, property.currency, property.listing_type !== "sale" ? property.price_period : null)}
            </div>
          </div>
          <Button asChild size="sm" className="rounded-full gap-2 pointer-events-auto">
            <Link href={href} prefetch>
              View in Catalogue <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
