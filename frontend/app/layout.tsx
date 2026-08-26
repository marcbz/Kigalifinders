import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SiteChromeWithSettings } from "@/components/layout/site-chrome-wrapper";
import { OrganizationJsonLd } from "@/components/seo/organization-jsonld";
import { Providers } from "@/components/providers";
import { getPublicApiOrigin } from "@/lib/api-origin";
import { DEFAULT_HERO_IMAGE, DEFAULT_HERO_IMAGE_MOBILE } from "@/lib/hero-image";
import "./globals.css";

// Variable fonts = one file each (avoids CSS → multi-weight font critical chain).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "optional",
  adjustFontFallback: true,
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";
const apiOrigin = getPublicApiOrigin();

export const metadata: Metadata = {
  title: {
    default: "Kigali Rent | Kigali's Rental and Property Marketplace",
    template: "%s | Kigali Rent",
  },
  description: "Kigali housing costs, neighbourhood guides, and current rentals and homes for sale. See what is actually available with Kigali Rent.",
  openGraph: {
    title: "Kigali Rent | Kigali's Rental and Property Marketplace",
    description: "We know what housing costs in Kigali, where to live, and which properties are actually available.",
    type: "website",
    locale: "en_RW",
    siteName: "Kigali Rent",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Kigali Rent logo" }],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {apiOrigin ? (
          <>
            <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={apiOrigin} />
          </>
        ) : null}
        {/* Mobile LCP: preload the small local WebP only on small viewports */}
        <link
          rel="preload"
          as="image"
          href={DEFAULT_HERO_IMAGE_MOBILE}
          type="image/webp"
          media="(max-width: 767px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href={DEFAULT_HERO_IMAGE}
          type="image/webp"
          media="(min-width: 768px)"
          fetchPriority="high"
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <OrganizationJsonLd />
        <Providers>
          <SiteChromeWithSettings>{children}</SiteChromeWithSettings>
        </Providers>
      </body>
    </html>
  );
}
