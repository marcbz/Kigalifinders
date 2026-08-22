import { Suspense } from "react";
import { HeroSection } from "@/features/home/hero-section";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { DeferredSearchBar } from "@/components/search/deferred-search-bar";
import { HomePageContent, HomePageFallback } from "@/features/home/home-page-content";
import { DEFAULT_HERO_IMAGE } from "@/lib/hero-image";

export const revalidate = 120;

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
