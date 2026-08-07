import { Suspense } from "react";
import { preload } from "react-dom";
import { HeroSection } from "@/features/home/hero-section";
import { SearchBar } from "@/components/search/search-bar";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";
import { HomePageContent, HomePageFallback } from "@/features/home/home-page-content";
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_MOBILE } from "@/lib/hero-image";

export const revalidate = 120;

export default function HomePage() {
  preload(DEFAULT_HERO_IMAGE_MOBILE, { as: "image", fetchPriority: "high" });
  preload(DEFAULT_HERO_IMAGE, { as: "image", fetchPriority: "high" });

  return (
    <>
      <HeroSection backgroundImage={DEFAULT_HERO_IMAGE} />
      <Suspense fallback={<SearchBarPlaceholder />}>
        <SearchBar />
      </Suspense>
      <Suspense fallback={<HomePageFallback />}>
        <HomePageContent />
      </Suspense>
    </>
  );
}
