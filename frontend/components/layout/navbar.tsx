"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandName } from "@/components/brand/brand-name";
import { CurrencyToggle } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Kept in code but hidden from menus to save space — pages still work if linked. */
const HIDDEN_NAV_HREFS = new Set(["/#area", "/#why", "/#faq", "/blog", "/faq"]);

const allNavLinks = [
  { href: "/#home", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/favorites", label: "Saved" },
  { href: "/#area", label: "Areas" },
  { href: "/#why", label: "Why Us" },
  { href: "/blog", label: "Blog" },
  { href: "/#faq", label: "FAQs" },
  { href: "/list-your-property", label: "List property", highlight: true },
  { href: "/contact", label: "Contact" },
];

const navLinks = allNavLinks.filter((link) => !HIDDEN_NAV_HREFS.has(link.href));

interface NavbarProps {
  bookingUrl?: string;
}

function NavLinkLabel({
  label,
  highlight,
  onDark = false,
}: {
  label: string;
  highlight?: boolean;
  onDark?: boolean;
}) {
  if (!highlight) return <>{label}</>;
  return (
    <span
      className={cn(
        "relative inline-block px-1.5 py-0.5 font-semibold",
        onDark ? "text-gold-400" : "text-navy-900 dark:text-gold-400",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 top-1/3 -skew-x-3 rounded-sm opacity-80",
          onDark ? "bg-gold-500/35" : "bg-gold-400/55 dark:bg-gold-500/40",
        )}
      />
      <span className="relative z-[1]">{label}</span>
    </span>
  );
}

export function Navbar({ bookingUrl }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/95 dark:bg-navy-900/95 border-b border-gray-100 dark:border-navy-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0 shrink">
            <div className="w-11 h-11 rounded-full bg-navy-800 flex items-center justify-center shrink-0">
              <span className="font-serif text-gold-500 text-sm font-bold leading-none">KR</span>
            </div>
            <div className="leading-tight min-w-0">
              <BrandName size="md" />
              <div className="mt-1 text-[11px] tracking-[0.22em] font-semibold text-navy-700 dark:text-gold-400 truncate">
                RENTALS & PROPERTY
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex gap-8 text-sm font-medium text-navy-800 dark:text-gray-200 mx-auto">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link">
                <NavLinkLabel label={link.label} highlight={link.highlight} />
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            <CurrencyToggle />
            <ThemeToggle />
            {bookingUrl && (
              <Button asChild className="hidden md:inline-flex rounded-full" size="sm">
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                  <CalendarCheck className="w-4 h-4" />
                  Book Visit
                </a>
              </Button>
            )}
            <button
              className="lg:hidden text-navy-800 dark:text-white"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
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
          <BrandName variant="admin" size="lg" />
          <div className="flex items-center gap-3 shrink-0">
            <CurrencyToggle onDark />
            <button className="text-gold-500" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-5 text-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-gold-500"
              onClick={() => setMobileOpen(false)}
            >
              <NavLinkLabel label={link.label} highlight={link.highlight} onDark />
            </Link>
          ))}
          {bookingUrl && (
            <Button asChild className="rounded-full mt-4">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                Book Visit
              </a>
            </Button>
          )}
        </nav>
      </div>
    </>
  );
}
