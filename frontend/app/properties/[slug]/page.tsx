import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { Bath, Bed, CalendarCheck, MapPin, Ruler } from "lucide-react";
import { PropertyGallery } from "@/components/property/property-gallery";
import { PropertyDescription } from "@/components/property/property-description";
import { PropertyFeaturesTable } from "@/components/property/property-features-table";
import { PropertyInquiryForm } from "@/components/property/property-inquiry-form";
import { PropertyPrice } from "@/components/property/property-price";
import { TrackPropertyView } from "@/components/property/track-property-view";
import { RelatedRentalSearches } from "@/components/rentals/rental-landing-sections";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { getListingBadge, getPropertyImageAlt } from "@/lib/property-features";
import { fetchPropertyRelatedSearchesSafe, fetchPropertySafe } from "@/lib/server-api";
import { buildPropertyListingJsonLd } from "@/lib/property-jsonld";
import { buildPropertyMetaDescription, normalizeSeoTitle } from "@/lib/seo-metadata";
import { SITE_BOOKING_URL } from "@/lib/site-defaults";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const RelatedPropertiesSection = dynamic(
  () => import("@/components/property/related-properties-section").then((mod) => ({ default: mod.RelatedPropertiesSection })),
  { loading: () => <div className="py-16 px-6 bg-cream dark:bg-secondary min-h-[200px]" aria-hidden /> },
);

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await fetchPropertySafe(slug);
  if (!property) {
    return { title: "Property Not Found", robots: { index: false, follow: false } };
  }
  const propertyUrl = `https://kigalirent.com/properties/${slug}`;
  const title = normalizeSeoTitle(property.meta_title || property.title);
  const description = buildPropertyMetaDescription(property);
  const imageAlt = getPropertyImageAlt(property);
  const images = property.primary_image
    ? [{ url: property.primary_image, width: 1200, height: 630, alt: imageAlt }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: propertyUrl },
    openGraph: {
      title,
      description,
      url: propertyUrl,
      type: "website",
      siteName: "Kigali Rent",
      locale: "en_RW",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: property.primary_image ? [property.primary_image] : undefined,
    },
  };
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;
  const property = await fetchPropertySafe(slug);
  if (!property) {
    notFound();
  }

  const relatedSearches = await fetchPropertyRelatedSearchesSafe(slug, 6);

  const images =
    property.images?.length
      ? property.images.map((img) => ({ id: img.id, url: img.url, alt_text: img.alt_text }))
      : property.primary_image
        ? [{ id: "primary", url: property.primary_image }]
        : [{ id: "fallback", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200" }];

  const bookingUrl = SITE_BOOKING_URL;
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641";
  const listingBadge = getListingBadge(property);
  const propertyUrl = `https://kigalirent.com/properties/${slug}`;
  const pricePeriod = property.listing_type !== "sale" ? property.price_period : null;
  const priceLabel = formatPrice(property.price, property.currency, pricePeriod);

  return (
    <>
      <TrackPropertyView property={property} />
      <div className="bg-navy-800 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="badge-gold px-3 py-1 rounded text-xs inline-block">{listingBadge}</span>
            {property.is_available === false && (
              <span className="bg-white/15 text-white text-xs font-bold tracking-widest uppercase px-3 py-1 rounded border border-white/30">
                No longer available
              </span>
            )}
            {property.previous_price != null && property.previous_price > property.price && (
              <span className="bg-red-600 text-white text-xs font-bold tracking-widest uppercase px-3 py-1 rounded">
                Price reduced
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold mb-3">{property.title}</h1>
          {property.short_description?.trim() && (
            <p className="text-gray-200 max-w-3xl mb-3 leading-relaxed">{property.short_description}</p>
          )}
          <p className="text-gold-400 text-xl font-semibold mb-3">{priceLabel}</p>
          {property.is_available === false && (
            <p className="text-amber-200 mb-3 max-w-3xl">
              {property.availability_note || "This property is no longer verified as available."} Similar available listings are recommended below.
            </p>
          )}
          <div className="flex items-center gap-2 text-gray-200">
            <MapPin className="w-4 h-4 text-gold-500" />
            {property.address || `${property.neighborhood_name || ""}${property.district_name ? `, ${property.district_name}` : ""}`}
          </div>
        </div>
      </div>

      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <PropertyGallery images={images} title={property.title} />

            <div className="flex flex-wrap gap-6 text-sm border-b pb-6 mb-8">
              {property.bedrooms != null && (
                <span className="flex items-center gap-2"><Bed className="text-gold-500" /> {property.bedrooms} Beds</span>
              )}
              {property.bathrooms != null && (
                <span className="flex items-center gap-2"><Bath className="text-gold-500" /> {property.bathrooms} Baths</span>
              )}
              {property.area_sqm && (
                <span className="flex items-center gap-2"><Ruler className="text-gold-500" /> {property.area_sqm}m²</span>
              )}
            </div>

            <PropertyFeaturesTable property={property} />

            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Description</h2>
            <div className="mb-8">
              <PropertyDescription content={property.description} />
            </div>

            {(property.amenities?.length ?? 0) > 0 && (
              <>
                <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Amenities</h2>
                <div className="flex flex-wrap gap-3 mb-8">
                  {property.amenities.map((a) => (
                    <span key={a} className="px-4 py-2 bg-cream dark:bg-secondary rounded-full text-sm">{a}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-white dark:bg-card rounded-2xl shadow-xl p-8 border">
              <PropertyPrice
                className="mb-6"
                price={property.price}
                currency={property.currency}
                period={property.listing_type !== "sale" ? property.price_period : null}
                previousPrice={property.previous_price}
              />
              {property.agent_name && (
                <p className="text-sm text-gray-500 mb-6">Agent: <strong>{property.agent_name}</strong></p>
              )}
              <div className="space-y-3">
                {property.is_available !== false ? (
                  <>
                    <Button asChild className="w-full rounded-full">
                      <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                        <CalendarCheck className="w-4 h-4" /> Schedule Viewing
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-full gap-2">
                      <a
                        href={`https://wa.me/${whatsapp}?text=Interested in ${encodeURIComponent(property.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
                        WhatsApp Inquiry
                      </a>
                    </Button>
                    <PropertyInquiryForm propertyId={property.id} propertyTitle={property.title} />
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    This listing is no longer verified as available. See similar properties below.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {relatedSearches.length > 0 ? (
        <div className="px-6 pb-4 bg-white dark:bg-background">
          <div className="max-w-7xl mx-auto py-8 border-t">
            <RelatedRentalSearches items={relatedSearches} showMatchCount />
          </div>
        </div>
      ) : null}

      <RelatedPropertiesSection slug={slug} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildPropertyListingJsonLd(property, propertyUrl)),
        }}
      />
    </>
  );
}
