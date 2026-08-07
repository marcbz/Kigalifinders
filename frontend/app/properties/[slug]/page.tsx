import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { Bath, Bed, CalendarCheck, MapPin, Ruler } from "lucide-react";
import { PropertyGallery } from "@/components/property/property-gallery";
import { PropertyDescription } from "@/components/property/property-description";
import { PropertyMap } from "@/components/property/property-map";
import { PropertyFeaturesTable } from "@/components/property/property-features-table";
import { PropertyInquiryForm } from "@/components/property/property-inquiry-form";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { formatPrice } from "@/lib/utils";
import { getListingBadge } from "@/lib/property-features";
import { fetchPropertySafe } from "@/lib/server-api";
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
    return { title: "Property Not Found" };
  }
  return {
    title: property.meta_title || property.title,
    description: property.meta_description || property.short_description,
    openGraph: { images: property.primary_image ? [property.primary_image] : [] },
  };
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;
  const property = await fetchPropertySafe(slug);
  if (!property) {
    notFound();
  }

  const images =
    property.images?.length
      ? property.images.map((img) => ({ id: img.id, url: img.url, alt_text: img.alt_text }))
      : property.primary_image
        ? [{ id: "primary", url: property.primary_image }]
        : [{ id: "fallback", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200" }];

  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL || "https://secure-guard.setmore.com/";
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641";
  const listingBadge = getListingBadge(property);

  return (
    <>
      <div className="bg-navy-800 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <span className="badge-gold px-3 py-1 rounded text-xs mb-4 inline-block">{listingBadge}</span>
          <h1 className="font-serif text-3xl md:text-5xl font-bold mb-3">{property.title}</h1>
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

            <PropertyMap address={property.address} title={property.title} />

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
              <div className="font-serif text-3xl font-bold text-navy-800 dark:text-white mb-6">
                {formatPrice(property.price, property.currency, property.listing_type !== "sale" ? property.price_period : null)}
              </div>
              {property.agent_name && (
                <p className="text-sm text-gray-500 mb-6">Agent: <strong>{property.agent_name}</strong></p>
              )}
              <div className="space-y-3">
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
              </div>
              <PropertyInquiryForm propertyId={property.id} propertyTitle={property.title} />
            </div>
          </div>
        </div>
      </section>

      <RelatedPropertiesSection slug={slug} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateListing",
            name: property.title,
            description: property.description,
            offers: { "@type": "Offer", price: property.price, priceCurrency: property.currency },
          }),
        }}
      />
    </>
  );
}
