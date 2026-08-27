import { Suspense } from "react";
import type { Metadata } from "next";
import { HeroSection } from "@/features/home/hero-section";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { DeferredSearchBar } from "@/components/search/deferred-search-bar";
import { HomePageContent, HomePageFallback } from "@/features/home/home-page-content";
import { DEFAULT_HERO_IMAGE } from "@/lib/hero-image";
import { fetchHomepageSafe } from "@/lib/server-api";
import { getPropertyImageAlt } from "@/lib/property-features";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

export const revalidate = 120;

/**
 * Homepage og:image — prefer a real featured listing photo (marketplace inventory),
 * then a blog cover, then the brand logo. Never the decorative hero background.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { data } = await fetchHomepageSafe();

  const listing =
    data.featured_properties?.find((p) => p.primary_image) ||
    data.featured_furnished?.find((p) => p.primary_image) ||
    data.featured_plots?.find((p) => p.primary_image);

  const blog = data.blog_posts?.find((p) => p.featured_image);

  let ogImage: { url: string; alt: string; width?: number; height?: number };
  if (listing?.primary_image) {
    ogImage = {
      url: listing.primary_image,
      alt: getPropertyImageAlt(listing),
    };
  } else if (blog?.featured_image) {
    ogImage = {
      url: blog.featured_image,
      alt: blog.title?.trim() || "KigaliRent blog article",
    };
  } else {
    ogImage = {
      url: "/logo.png",
      width: 512,
      height: 512,
      alt: "KigaliRent logo",
    };
  }

  return {
    title: "Kigali Rent | Houses for Rent & Sale in Kigali, Rwanda",
    description:
      "Find houses for rent, furnished homes, and properties for sale in Kigali. Neighbourhood guides, real prices, and listings that are actually available.",
    alternates: { canonical: siteUrl },
    openGraph: {
      title: "Kigali Rent | Houses for Rent & Sale in Kigali",
      description:
        "Kigali housing costs, neighbourhood guides, and current rentals and homes for sale.",
      url: siteUrl,
      type: "website",
      locale: "en_RW",
      siteName: "Kigali Rent",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "Kigali Rent | Houses for Rent & Sale in Kigali",
      description:
        "Kigali housing costs, neighbourhood guides, and current rentals and homes for sale.",
      images: [ogImage.url],
    },
    keywords: [
      "Kigali rent",
      "houses for rent Kigali",
      "apartments Kigali",
      "furnished house Kigali",
      "property for sale Kigali",
      "Kigali real estate",
    ],
  };
}

export default function HomePage() {
  return (
    <>
      <HeroSection backgroundImage={DEFAULT_HERO_IMAGE} />
      <Suspense fallback={<SearchBarPlaceholder />}>
        <DeferredSearchBar />
      </Suspense>
      <Suspense fallback={<HomePageFallback />}>
        <HomePageContent />
      </Suspense>
    </>
  );
}
