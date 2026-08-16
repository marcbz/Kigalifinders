import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SiteChromeWithSettings } from "@/components/layout/site-chrome-wrapper";
import { OrganizationJsonLd } from "@/components/seo/organization-jsonld";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "optional",
  adjustFontFallback: true,
  preload: true,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

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
  robots: { index: true, follow: true },
  metadataBase: new URL(siteUrl),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          as="image"
          href="/images/hero-kigali-mobile.webp"
          type="image/webp"
          fetchPriority="high"
          media="(max-width: 768px)"
        />
        <link
          rel="preload"
          as="image"
          href="/images/hero-kigali.webp"
          type="image/webp"
          fetchPriority="high"
          media="(min-width: 769px)"
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
