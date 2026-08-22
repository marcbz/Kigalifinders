import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, Bed, MapPin, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropertyListItem } from "@/types";
import { getListingBadge, getPropertyAreaLabel } from "@/lib/property-features";
import { getPropertyHref } from "@/lib/property-url";
import { PropertyCardActions } from "@/components/property/property-card-actions";
import { PropertyImageFrame } from "@/components/property/property-image-frame";
import { PropertyPrice } from "@/components/property/property-price";

interface PropertyCardProps {
  property: PropertyListItem;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const listingBadge = getListingBadge(property);
  const areaLabel = getPropertyAreaLabel(property);
  const isPlot = property.listing_type === "sale" && property.lot_size_sqm;
  const href = getPropertyHref(property);
  const priceReduced =
    property.previous_price != null && property.previous_price > property.price;

  return (
    <article className="property-card group relative">
      <Link
        href={href}
        prefetch={false}
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
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 items-start">
          <span className="badge-gold px-3 py-1 rounded">{listingBadge}</span>
          {priceReduced && (
            <span className="bg-red-600 text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded">
              Price reduced
            </span>
          )}
        </div>
        <PropertyCardActions property={property} />
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

        <div className="flex justify-between items-end gap-3">
          <div className="min-w-0">
            {!isPlot && <div className="text-[11px] tracking-widest text-gray-400 uppercase">From</div>}
            <PropertyPrice
              price={property.price}
              currency={property.currency}
              period={property.listing_type !== "sale" ? property.price_period : null}
              previousPrice={property.previous_price}
            />
          </div>
          <Button asChild size="sm" className="rounded-full gap-1.5 pointer-events-auto shrink-0">
            <Link href={href} prefetch={false}>
              View Listing <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
