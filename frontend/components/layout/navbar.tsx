"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CalendarCheck, Menu, X } from "lucide-react";
import { BookingLink } from "@/components/booking/booking-link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandName } from "@/components/brand/brand-name";
import { CurrencyToggle } from "@/lib/currency";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/#home", label: "Home" },
  { href: "/rentals", label: "Rentals" },
  { href: "/properties", label: "Properties" },
  { href: "/contact", label: "Contact" },
];

interface NavbarProps {
  bookingUrl?: string;
}

export function Navbar({ bookingUrl }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/95 dark:bg-navy-900/95 border-b border-gray-100 dark:border-navy-800 overflow-x-clip">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-navy-800 flex items-center justify-center shrink-0">
              <span className="font-serif text-gold-500 text-[11px] sm:text-sm font-bold leading-none">
                KR
              </span>
            </div>
            <div className="leading-none">
              {/* Mobile: one compact word. Desktop: spaced brand + tagline. */}
              <BrandName
                compact
                className="text-[13px] sm:hidden"
              />
              <BrandName
                size="md"
                className="hidden sm:inline-block text-xl tracking-wide"
              />
              <div className="mt-1 text-[11px] tracking-[0.22em] font-semibold text-navy-700 dark:text-gold-400 truncate hidden sm:block">
                RENTALS & PROPERTY
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex gap-8 text-sm font-medium text-navy-800 dark:text-gray-200 mx-auto">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Keep currency/theme out of the tight mobile bar so List stays fully visible. */}
            <div className="hidden sm:block">
              <CurrencyToggle />
            </div>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Button asChild className="rounded-full shadow-sm h-9 px-3 sm:h-9 sm:px-4" size="sm">
              <Link href="/list-your-property" aria-label="List your property" className="gap-1.5">
                <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="whitespace-nowrap text-xs sm:text-sm">List property</span>
              </Link>
            </Button>
            {bookingUrl && (
              <Button asChild className="hidden md:inline-flex rounded-full" size="sm" variant="navy">
                <BookingLink href={bookingUrl}>
                  <CalendarCheck className="w-4 h-4" />
                  Book Visit
                </BookingLink>
              </Button>
            )}
            <button
              className="lg:hidden text-navy-800 dark:text-white p-1.5 shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-[55] bg-navy-800 text-white p-8 lg:hidden transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-4 mb-10">
          <BrandName variant="admin" compact className="text-2xl" />
          <div className="flex items-center gap-3 shrink-0">
            <CurrencyToggle onDark />
            <ThemeToggle />
            <button className="text-gold-500" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-5 text-lg">
          <Button asChild className="rounded-full w-full mb-2" size="lg">
            <Link href="/list-your-property" onClick={() => setMobileOpen(false)}>
              <Building2 className="w-5 h-5" />
              List your property
            </Link>
          </Button>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-gold-500"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {bookingUrl && (
            <Button asChild className="rounded-full mt-4 btn-outline-white border-2">
              <BookingLink href={bookingUrl} onClick={() => setMobileOpen(false)}>
                Book Visit
              </BookingLink>
            </Button>
          )}
        </nav>
      </div>
    </>
  );
}
