"use client";

import Link from "next/link";
import { CalendarCheck, Home } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

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
  tagline = "RWANDA'S #1 LUXURY REAL ESTATE",
  title = "Find Your Dream Home in Kigali",
  subtitle = "Discover an exclusive collection of furnished houses, rental homes, and prime plots for sale across Kigali. Premium properties. Trusted service. Unmatched expertise.",
  backgroundImage = "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=80",
  ctaPrimary = "Book a Visit",
  ctaSecondary = "Browse Properties",
  bookingUrl = "https://secure-guard.setmore.com/",
}: HeroProps) {
  const titleParts = title.split("Dream Home");

  return (
    <section
      id="home"
      className="min-h-[92vh] flex items-center text-white relative"
      style={{
        backgroundImage: `linear-gradient(rgba(6,19,43,0.55), rgba(6,19,43,0.7)), url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-20 w-full">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">{tagline}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif text-5xl md:text-7xl font-bold leading-[1.05] mb-6"
          >
            {titleParts.length > 1 ? (
              <>Find Your <span className="gold-text italic">Dream Home</span>{titleParts[1]}</>
            ) : (
              title
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl leading-relaxed"
          >
            {subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Button asChild size="lg" className="rounded-full">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                <CalendarCheck className="w-5 h-5" />
                {ctaPrimary}
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="btn-outline-white rounded-full border-white/60 bg-white/10 text-white hover:bg-white hover:text-navy-800">
              <Link href="/properties">
                <Home className="w-5 h-5" />
                {ctaSecondary}
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
