import { Suspense } from "react";
import { preload } from "react-dom";
import { HeroSection } from "@/features/home/hero-section";
import { HomePageContent, HomePageFallback } from "@/features/home/home-page-content";
import { DEFAULT_HERO_IMAGE } from "@/lib/hero-image";

export const revalidate = 120;

export default function HomePage() {
  preload(DEFAULT_HERO_IMAGE, { as: "image", fetchPriority: "high" });

  return (
    <>
      <HeroSection backgroundImage={DEFAULT_HERO_IMAGE} />
      <Suspense fallback={<HomePageFallback />}>
        <HomePageContent />
      </Suspense>
    </>
  );
}
