import type { Metadata } from "next";
import { Bath, Bed, CalendarCheck, Car, MapPin, Ruler, Trees } from "lucide-react";
import { notFound } from "next/navigation";
import { PropertyGallery } from "@/components/property/property-gallery";
import { PropertyDescription } from "@/components/property/property-description";
import { PropertyFeaturesTable } from "@/components/property/property-features-table";
import { PropertyInquiryForm } from "@/components/property/property-inquiry-form";
import { PropertyPrice } from "@/components/property/property-price";
import { TrackPropertyView } from "@/components/property/track-property-view";
import { RelatedPropertiesSection } from "@/components/property/related-properties-section";
import { RelatedRentalSearches } from "@/components/rentals/rental-landing-sections";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { FAQSection } from "@/features/home/faq-section";
import { buildPropertyFaqs, getListingBadge, getPropertyImageAlt } from "@/lib/property-features";
import { fetchPropertyRelatedSearchesSafe, fetchPropertySafe, fetchRelatedSafe } from "@/lib/server-api";
import { buildPropertyListingJsonLd } from "@/lib/property-jsonld";
import { buildPropertyMetaDescription, buildFaqPageJsonLd, normalizeSeoTitle } from "@/lib/seo-metadata";
import { SITE_BOOKING_URL } from "@/lib/site-defaults";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

  const [relatedSearches, relatedInitial] = await Promise.all([
    fetchPropertyRelatedSearchesSafe(slug, 6),
    fetchRelatedSafe(slug, 1, 6),
  ]);

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

  const propertyFaqs = buildPropertyFaqs(property);
  const faqJsonLd = buildFaqPageJsonLd(propertyFaqs);

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

            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm border-b pb-6 mb-8">
              {property.bedrooms != null && (
                <span className="flex items-center gap-2">
                  <Bed className="text-gold-500" /> {property.bedrooms} Bedrooms
                </span>
              )}
              {property.bathrooms != null && (
                <span className="flex items-center gap-2">
                  <Bath className="text-gold-500" /> {property.bathrooms} Bathrooms
                </span>
              )}
              {property.parking_spaces != null && property.parking_spaces > 0 ? (
                <span className="flex items-center gap-2">
                  <Car className="text-gold-500" /> {property.parking_spaces} Parking space{property.parking_spaces === 1 ? "" : "s"}
                </span>
              ) : property.has_parking ? (
                <span className="flex items-center gap-2">
                  <Car className="text-gold-500" /> Parking available
                </span>
              ) : null}
              {property.area_sqm != null && (
                <span className="flex items-center gap-2">
                  <Ruler className="text-gold-500" /> {property.area_sqm}m² Living area
                </span>
              )}
              {property.lot_size_sqm != null && property.lot_size_sqm !== property.area_sqm && (
                <span className="flex items-center gap-2">
                  <Trees className="text-gold-500" /> {property.lot_size_sqm}m² Plot
                </span>
              )}
              {property.has_garden && (
                <span className="flex items-center gap-2">
                  <Trees className="text-gold-500" /> Garden
                </span>
              )}
              {property.has_pool && (
                <span className="flex items-center gap-2 text-gold-600 font-medium">
                  Swimming pool
                </span>
              )}
              {property.is_furnished && (
                <span className="flex items-center gap-2 text-gold-600 font-medium">
                  Furnished
                </span>
              )}
              {property.pets_allowed && (
                <span className="flex items-center gap-2">
                  Pets allowed
                </span>
              )}
            </div>

            <PropertyFeaturesTable property={property} />

            <article
              itemScope
              itemType="https://schema.org/Article"
              aria-labelledby="property-description-heading"
              className="mb-8"
            >
              <meta itemProp="author" content="Kigali Rent" />
              <meta itemProp="datePublished" content={property.published_at || property.created_at || new Date().toISOString().slice(0, 10)} />
              <meta itemProp="dateModified" content={property.last_verified_at || property.published_at || property.created_at || new Date().toISOString().slice(0, 10)} />
              <meta
                itemProp="headline"
                content={`${property.title} — ${[property.neighborhood_name, property.district_name].filter(Boolean).join(", ") || "Kigali"}`}
              />
              <h2
                id="property-description-heading"
                itemProp="name"
                className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4"
              >
                About this property
              </h2>
              {property.short_description?.trim() && property.description?.trim() && property.short_description.trim() !== property.description.trim().slice(0, property.short_description.length) && (
                <p
                  itemProp="abstract"
                  className="mb-6 p-5 bg-cream dark:bg-secondary rounded-xl border border-gray-200 dark:border-border text-navy-800 dark:text-gray-300 leading-relaxed font-medium"
                >
                  {property.short_description}
                </p>
              )}
              <div itemProp="articleBody description" className="property-description-block">
                <PropertyDescription content={property.description} />
              </div>
              <noscript aria-hidden="true">
                <div className="hidden-llm-text">
                  {property.title} in {[property.neighborhood_name, property.district_name].filter(Boolean).join(", ") || "Kigali"}, Rwanda.{" "}
                  {property.short_description?.trim() || ""}
                  {property.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || ""}
                </div>
              </noscript>
            </article>

            {(property.amenities?.length ?? 0) > 0 && (
              <section aria-labelledby="amenities-heading" className="mb-8">
                <h2 id="amenities-heading" className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Amenities</h2>
                <div className="flex flex-wrap gap-3" role="list">
                  {property.amenities.map((a) => (
                    <span
                      key={a}
                      role="listitem"
                      className="px-4 py-2 bg-cream dark:bg-secondary rounded-full text-sm border border-gray-200 dark:border-border"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <div className="mb-8 p-5 bg-white dark:bg-card rounded-2xl border shadow-sm hidden-print">
              <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-3">
                {property.title} — Quick Summary
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Location</dt>
                  <dd className="text-navy-800 dark:text-white font-medium">
                    {[property.neighborhood_name, property.district_name].filter(Boolean).join(", ") || "Kigali"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Price</dt>
                  <dd className="text-navy-800 dark:text-white font-medium">{priceLabel}</dd>
                </div>
                {property.bedrooms != null && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Bedrooms</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">{property.bedrooms}</dd>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Bathrooms</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">{property.bathrooms}</dd>
                  </div>
                )}
                {property.area_sqm != null && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Living area</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">{property.area_sqm} m²</dd>
                  </div>
                )}
                {property.lot_size_sqm != null && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Plot area</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">{property.lot_size_sqm} m²</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Furnished</dt>
                  <dd className="text-navy-800 dark:text-white font-medium">{property.is_furnished ? "Yes" : "No"}</dd>
                </div>
                {property.has_pool && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Pool</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">Yes</dd>
                  </div>
                )}
                {property.has_garden && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Garden</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">Yes</dd>
                  </div>
                )}
                {property.has_parking && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Parking</dt>
                    <dd className="text-navy-800 dark:text-white font-medium">Yes</dd>
                  </div>
                )}
              </dl>
            </div>
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

      {propertyFaqs.length > 0 && (
        <div className="px-6 py-12 bg-white dark:bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">
                QUESTIONS ABOUT THIS LISTING
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy-800 dark:text-white mt-3 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                Everything you need to know about {property.title || "this property"} in{" "}
                {property.neighborhood_name || property.district_name || "Kigali"}.
              </p>
            </div>
            <FAQSection faqs={propertyFaqs} />
          </div>
        </div>
      )}

      {relatedSearches.length > 0 ? (
        <div className="px-6 pb-4 bg-white dark:bg-background">
          <div className="max-w-7xl mx-auto py-8 border-t">
            <RelatedRentalSearches items={relatedSearches} showMatchCount />
          </div>
        </div>
      ) : null}

      <RelatedPropertiesSection slug={slug} initialData={relatedInitial} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildPropertyListingJsonLd(property, propertyUrl)),
        }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
    </>
  );
}
