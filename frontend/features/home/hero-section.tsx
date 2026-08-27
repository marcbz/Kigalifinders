import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Home } from "lucide-react";
import {
  DEFAULT_HERO_IMAGE,
  DEFAULT_HERO_IMAGE_MOBILE,
  resolveHeroImage,
} from "@/lib/hero-image";
import { SITE_BOOKING_URL } from "@/lib/site-defaults";
import { HeroAnimatedTitleLine } from "@/features/home/hero-animated-title";

interface HeroCopyProps {
  tagline?: string;
  title?: string;
  subtitle?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  bookingUrl?: string;
}

interface HeroProps extends HeroCopyProps {
  backgroundImage?: string;
}

export function HeroSection({
  tagline,
  title,
  subtitle,
  backgroundImage,
  ctaPrimary,
  ctaSecondary,
  bookingUrl,
}: HeroProps) {
  const displayBg = resolveHeroImage(backgroundImage) || DEFAULT_HERO_IMAGE;
  const isLocalHero = displayBg.startsWith("/images/hero-kigali");

  const displayTagline = tagline || "KIGALI RENTAL AND PROPERTY MARKETPLACE";
  const displayTitle = title || "Find Your Dream Home in Kigali";
  const displaySubtitle =
    subtitle ||
    "We know what housing costs in Kigali, where to live, what neighborhoods are like, and what is actually available.";
  const displayCtaPrimary = ctaPrimary || "Book a Visit";
  const displayCtaSecondary = ctaSecondary || "Browse Rentals";
  const displayBookingUrl = bookingUrl || SITE_BOOKING_URL;
  const titleParts = displayTitle.split("Dream Home");
  const useAnimatedIntro = titleParts.length > 1;

  return (
    <section
      id="home"
      className="relative isolate min-h-[72vh] md:min-h-[68vh] flex items-center text-white overflow-hidden bg-[#06132b]"
    >
      {isLocalHero ? (
        <>
          {/* Mobile LCP only — already-optimized WebP; skip /_next/image hop */}
          <Image
            src={DEFAULT_HERO_IMAGE_MOBILE}
            alt=""
            fill
            priority
            fetchPriority="high"
            unoptimized
            sizes="100vw"
            className="object-cover object-center md:hidden"
          />
          {/* Desktop via CSS media background so mobile never downloads this file */}
          <div className="absolute inset-0 hidden md:block hero-bg-desktop" aria-hidden />
        </>
      ) : (
        <Image
          src={displayBg}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={75}
          className="object-cover object-center"
        />
      )}
      <div className="absolute inset-0 bg-[rgba(6,19,43,0.79)]" aria-hidden />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-14 w-full">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
            <span className="text-gold-400 tracking-[0.3em] text-xs font-semibold">{displayTagline}</span>
          </div>

          {useAnimatedIntro ? (
            <>
              <h1 className="font-serif text-[2rem] sm:text-4xl md:text-6xl font-bold leading-[1.12] mb-5">
                <span className="whitespace-nowrap">KigaliRent</span>
                <span className="font-semibold text-white/90"> — </span>
                <HeroAnimatedTitleLine />
                <br />
                in Kigali
              </h1>
              {displaySubtitle ? (
                <p className="text-lg md:text-xl text-gray-100 mb-10 max-w-2xl leading-relaxed">
                  {displaySubtitle}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="font-serif text-4xl md:text-6xl font-bold leading-[1.05] mb-5">
                {displayTitle.toLowerCase().includes("kigalirent") ||
                displayTitle.toLowerCase().includes("kigali rent")
                  ? displayTitle
                  : `KigaliRent — ${displayTitle}`}
              </h1>
              {displaySubtitle ? (
                <p className="text-lg md:text-xl text-gray-100 mb-10 max-w-2xl leading-relaxed">
                  {displaySubtitle}
                </p>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap gap-4">
            <a
              href={displayBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold inline-flex items-center justify-center gap-2 h-12 rounded-full px-8 text-sm font-semibold"
            >
              <CalendarCheck className="w-5 h-5" />
              {displayCtaPrimary}
            </a>
            <Link
              href="/rentals"
              className="hero-cta-outline inline-flex h-12 rounded-full px-8 text-sm"
            >
              <Home className="w-5 h-5" />
              {displayCtaSecondary}
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center text-white/70 text-xs z-10">
        <span className="tracking-widest mb-2">SCROLL</span>
        <div className="w-px h-10 bg-gold-500" />
      </div>
    </section>
  );
}
