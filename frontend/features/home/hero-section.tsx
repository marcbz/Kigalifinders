import Link from "next/link";
import { CalendarCheck, Home } from "lucide-react";
import {
  DEFAULT_HERO_IMAGE,
  DEFAULT_HERO_IMAGE_MOBILE,
  resolveHeroImage,
} from "@/lib/hero-image";
import { SITE_BOOKING_URL } from "@/lib/site-defaults";

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

  const displayTagline = tagline || "KIGALI'S #1 RENTAL AND PROPERTY MARKETPLACE";
  const displayTitle = title || "Find Your Dream Home in Kigali";
  const displaySubtitle =
    subtitle ||
    "We know what housing costs in Kigali, where to live, what neighborhoods are like, and what is actually available.";
  const displayCtaPrimary = ctaPrimary || "Book a Visit";
  const displayCtaSecondary = ctaSecondary || "Browse Properties";
  const displayBookingUrl = bookingUrl || SITE_BOOKING_URL;
  const titleParts = displayTitle.split("Dream Home");

  return (
    <section
      id="home"
      className="relative isolate min-h-[72vh] md:min-h-[68vh] flex items-center text-white overflow-hidden"
    >
      {/* LCP target: flat img paints independently of web-font load */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isLocalHero ? DEFAULT_HERO_IMAGE_MOBILE : displayBg}
        srcSet={
          isLocalHero
            ? `${DEFAULT_HERO_IMAGE_MOBILE} 960w, ${DEFAULT_HERO_IMAGE} 1920w`
            : undefined
        }
        sizes="100vw"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[rgba(6,19,43,0.79)]" aria-hidden />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-14 w-full">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">{displayTagline}</span>
          </div>

          <h1 className="font-serif text-4xl md:text-6xl font-bold leading-[1.05] mb-5">
            {titleParts.length > 1 ? (
              <>
                Find Your <span className="gold-text italic dream-home-mark">Dream Home</span>
                <span className="md:hidden">{titleParts[1]}</span>
                <span className="hidden md:block">In Kigali</span>
              </>
            ) : (
              displayTitle
            )}
          </h1>

          {displaySubtitle ? (
            <p className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl leading-relaxed">{displaySubtitle}</p>
          ) : null}

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
              href="/properties"
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
