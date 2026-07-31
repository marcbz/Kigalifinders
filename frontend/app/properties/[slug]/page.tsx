import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, Bed, CalendarCheck, MapPin, Ruler } from "lucide-react";
import { PropertyCard } from "@/components/property/property-card";
import { PropertyGallery } from "@/components/property/property-gallery";
import { PropertyInquiryForm } from "@/components/property/property-inquiry-form";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { formatPrice } from "@/lib/utils";
import { getCachedProperty, getCachedRelated } from "@/lib/server-api";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const property = await getCachedProperty(slug);
    return {
      title: property.meta_title || property.title,
      description: property.meta_description || property.short_description,
      openGraph: { images: property.primary_image ? [property.primary_image] : [] },
    };
  } catch {
    return { title: "Property Not Found" };
  }
}

export default async function PropertyDetailPage({ params }: Props) {
  const { slug } = await params;
  let property;
  let related = [];
  try {
    [property, related] = await Promise.all([getCachedProperty(slug), getCachedRelated(slug)]);
  } catch {
    notFound();
  }

  const images =
    property.images?.length
      ? property.images.map((img) => ({ id: img.id, url: img.url, alt_text: img.alt_text }))
      : property.primary_image
        ? [{ id: "primary", url: property.primary_image }]
        : [{ id: "fallback", url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200" }];

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "250784806641";

  return (
    <>
      <div className="bg-navy-800 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          {property.badge_label && (
            <span className="badge-gold px-3 py-1 rounded text-xs mb-4 inline-block">{property.badge_label}</span>
          )}
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
            <PropertyGallery
              images={images}
              title={property.title}
              latitude={property.latitude}
              longitude={property.longitude}
              address={property.address}
            />

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

            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Description</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-8">{property.description}</p>

            {property.amenities.length > 0 && (
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
                  <a href="https://secure-guard.setmore.com/" target="_blank" rel="noopener noreferrer">
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

      {related.length > 0 && (
        <section className="py-16 px-6 bg-cream dark:bg-secondary">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-serif text-3xl font-bold text-navy-800 dark:text-white mb-8">Related Properties</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {related.map((p, i) => <PropertyCard key={p.id} property={p} index={i} />)}
            </div>
          </div>
        </section>
      )}

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
