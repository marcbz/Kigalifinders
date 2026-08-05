"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, Bed, Heart, MapPin, Ruler, Share2, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { PropertyListItem } from "@/types";
import { formatPrice } from "@/lib/utils";
import { getListingBadge, getPropertyAreaLabel } from "@/lib/property-features";
import { blockPropertyImageContextMenu } from "@/lib/property-image-protect";

interface PropertyCardProps {
  property: PropertyListItem;
  index?: number;
}

export function PropertyCard({ property, index = 0 }: PropertyCardProps) {
  const listingBadge = getListingBadge(property);
  const areaLabel = getPropertyAreaLabel(property);
  const isPlot = property.listing_type === "sale" && property.lot_size_sqm;

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="property-card"
    >
      <div
        className="relative overflow-hidden h-64 select-none"
        onContextMenu={blockPropertyImageContextMenu}
      >
        <Image
          src={property.primary_image || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"}
          alt={property.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
          sizes="(max-width: 768px) 100vw, 33vw"
          draggable={false}
        />
        <span className="absolute top-4 left-4 badge-gold px-3 py-1 rounded z-10">
          {listingBadge}
        </span>
        <div className="absolute top-3.5 right-3.5 flex gap-2 z-10">
          {[Heart, ArrowLeftRight, Share2].map((Icon, i) => (
            <button
              key={i}
              className="w-9 h-9 rounded-full bg-white/95 text-navy-800 flex items-center justify-center hover:bg-gold-500 hover:text-white transition"
              aria-label={["Save", "Compare", "Share"][i]}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-2">{property.title}</h3>
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
          <Button asChild size="sm" className="rounded-full gap-2">
            <Link href={`/properties/${property.slug}`}>
              View in Catalogue <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
