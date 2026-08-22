import { Suspense } from "react";
import type { Metadata } from "next";
import { HeroSection } from "@/features/home/hero-section";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { DeferredSearchBar } from "@/components/search/deferred-search-bar";
import { HomePageContent, HomePageFallback } from "@/features/home/home-page-content";
import { DEFAULT_HERO_IMAGE } from "@/lib/hero-image";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

export const revalidate = 120;

export const metadata: Metadata = {
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
  },
  twitter: {
    card: "summary_large_image",
    title: "Kigali Rent | Houses for Rent & Sale in Kigali",
    description:
      "Kigali housing costs, neighbourhood guides, and current rentals and homes for sale.",
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
