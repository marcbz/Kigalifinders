import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, Bed, MapPin, Ruler, CalendarCheck, MessageCircle } from "lucide-react";
import { propertyService } from "@/services/api";
import { PropertyCard } from "@/components/property/property-card";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const property = await propertyService.getBySlug(slug);
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
    property = await propertyService.getBySlug(slug);
    related = await propertyService.related(slug);
  } catch {
    notFound();
  }

  const images = property.images?.length ? property.images : [{ id: "1", url: property.primary_image || "", is_primary: true }];

  return (
    <>
      <div className="relative h-[50vh] md:h-[60vh]">
        <Image
          src={images[0]?.url || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200"}
          alt={property.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-7xl mx-auto">
          {property.badge_label && (
            <span className="badge-gold px-3 py-1 rounded text-xs mb-4 inline-block">{property.badge_label}</span>
          )}
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-2">{property.title}</h1>
          <div className="flex items-center gap-2 text-gray-200">
            <MapPin className="w-4 h-4 text-gold-500" />
            {property.address || `${property.neighborhood_name}, ${property.district_name}`}
          </div>
        </div>
      </div>

      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap gap-6 text-sm border-b pb-6 mb-8">
              {property.bedrooms != null && <span className="flex items-center gap-2"><Bed className="text-gold-500" /> {property.bedrooms} Beds</span>}
              {property.bathrooms != null && <span className="flex items-center gap-2"><Bath className="text-gold-500" /> {property.bathrooms} Baths</span>}
              {property.area_sqm && <span className="flex items-center gap-2"><Ruler className="text-gold-500" /> {property.area_sqm}m²</span>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {images.slice(0, 4).map((img) => (
                <div key={img.id} className="relative h-32 rounded-lg overflow-hidden">
                  <Image src={img.url} alt={property.title} fill className="object-cover" sizes="25vw" />
                </div>
              ))}
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
                  <Link href="/contact"><CalendarCheck className="w-4 h-4" /> Schedule Viewing</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full">
                  <a href={`https://wa.me/250784806641?text=Interested in ${property.title}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" /> WhatsApp Inquiry
                  </a>
                </Button>
              </div>
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
