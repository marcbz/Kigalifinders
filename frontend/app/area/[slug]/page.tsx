import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/property/property-card";
import { getAreaSeoContent } from "@/lib/area-content";
import { getAreaHref, getAreaIndexHref, getPropertiesFilterHref } from "@/lib/areas";
import {
  fetchNeighborhoodBySlugSafe,
  fetchSearchFilterNeighborhoodsSafe,
  fetchPropertiesSafe,
} from "@/lib/server-api";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return neighborhoods.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const neighborhood = await fetchNeighborhoodBySlugSafe(slug);
  if (!neighborhood) return { title: "Area Not Found" };

  const content = getAreaSeoContent(neighborhood);
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: getAreaHref(neighborhood.slug) },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      type: "website",
    },
  };
}

export default async function AreaLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const neighborhood = await fetchNeighborhoodBySlugSafe(slug);
  if (!neighborhood) notFound();

  const content = getAreaSeoContent(neighborhood);
  const properties = await fetchPropertiesSafe({
    neighborhood_slug: neighborhood.slug,
    page_size: 12,
    sort_by: "created_at",
    sort_order: "desc",
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kigalirent.com";
  const pageUrl = `${siteUrl}${getAreaHref(neighborhood.slug)}`;
  const areaIndexUrl = `${siteUrl}${getAreaIndexHref()}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Neighborhoods", item: areaIndexUrl },
          { "@type": "ListItem", position: 3, name: neighborhood.name, item: pageUrl },
        ],
      },
      {
        "@type": "WebPage",
        name: content.metaTitle,
        description: content.metaDescription,
        url: pageUrl,
        about: {
          "@type": "Place",
          name: `${neighborhood.name}, Kigali`,
          address: {
            "@type": "PostalAddress",
            addressLocality: neighborhood.name,
            addressRegion: neighborhood.district_name || "Kigali",
            addressCountry: "RW",
          },
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <nav className="text-sm text-gray-300 mb-6" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-gold-500">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={getAreaIndexHref()} className="hover:text-gold-500">
                  Neighborhoods
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-gold-500">{neighborhood.name}</li>
            </ol>
          </nav>
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">KIGALI NEIGHBORHOOD</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">{content.headline}</h1>
          {neighborhood.district_name && (
            <p className="text-gray-300 mt-3">
              {neighborhood.district_name} District · Kigali, Rwanda
            </p>
          )}
        </div>
      </div>

      <section className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 leading-relaxed space-y-4 mb-8">
            {content.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
          <ul className="flex flex-wrap gap-2 mb-10">
            {content.highlights.map((item) => (
              <li
                key={item}
                className="text-sm px-3 py-1.5 rounded-full border border-gold-500/30 bg-cream/60 dark:bg-secondary/40 text-navy-800 dark:text-gray-200"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">
              Available Properties
              {properties.total > 0 && (
                <span className="text-lg font-normal text-gray-500 ml-2">({properties.total})</span>
              )}
            </h2>
            <Link
              href={getPropertiesFilterHref(neighborhood.slug)}
              className="text-sm font-semibold text-gold-600 hover:text-gold-500 hover:underline"
            >
              Advanced search in {neighborhood.name} →
            </Link>
          </div>

          {properties.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.items.map((property, index) => (
                <PropertyCard key={property.id} property={property} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No active listings in {neighborhood.name} right now. Contact us and we&apos;ll help you find a match.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-navy-800 text-white px-6 py-3 text-sm font-semibold hover:bg-navy-700 transition"
              >
                Contact Kigali Rent
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
