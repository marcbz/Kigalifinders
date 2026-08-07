"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarCheck, Home } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { resolveHeroImage } from "@/lib/hero-image";

interface HeroProps {
  tagline?: string;
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  bookingUrl?: string;
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
  const displayTagline = tagline || "RWANDA'S #1 LUXURY REAL ESTATE";
  const displayTitle = title || "Find Your Dream Home in Kigali";
  const displaySubtitle = subtitle || "";
  const displayBg = resolveHeroImage(backgroundImage);
  const displayCtaPrimary = ctaPrimary || "Book a Visit";
  const displayCtaSecondary = ctaSecondary || "Browse Properties";
  const displayBookingUrl = bookingUrl || "https://secure-guard.setmore.com/";
  const titleParts = displayTitle.split("Dream Home");

  return (
    <section id="home" className="min-h-[68vh] flex items-center text-white relative overflow-hidden">
      <Image
        src={displayBg}
        alt=""
        fill
        priority
        sizes="100vw"
        quality={80}
        className="object-cover object-center -z-20"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(6,19,43,0.72)] to-[rgba(6,19,43,0.86)] -z-10" />

      <div className="max-w-7xl mx-auto px-6 py-14 w-full relative">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">{displayTagline}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-6xl font-bold leading-[1.05] mb-5"
          >
            {titleParts.length > 1 ? (
              <>Find Your <span className="gold-text italic">Dream Home</span>{titleParts[1]}</>
            ) : (
              displayTitle
            )}
          </motion.h1>

          {displaySubtitle && (
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl leading-relaxed"
            >
              {displaySubtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Button asChild size="lg" className="rounded-full">
              <a href={displayBookingUrl} target="_blank" rel="noopener noreferrer">
                <CalendarCheck className="w-5 h-5" />
                {displayCtaPrimary}
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="btn-outline-white rounded-full border-white/60 bg-white/10 text-white hover:bg-white hover:text-navy-800">
              <Link href="/properties">
                <Home className="w-5 h-5" />
                {displayCtaSecondary}
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center text-white/70 text-xs">
        <span className="tracking-widest mb-2">SCROLL</span>
        <div className="w-px h-10 bg-gold-500" />
      </div>
    </section>
  );
}
