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
    default: "Kigali Rent | Luxury Real Estate in Kigali, Rwanda",
    template: "%s | Kigali Rent",
  },
  description: "Find furnished houses, rental homes, and plots for sale in Kigali. Book property visits and discover your next home with Kigali Rent.",
  openGraph: {
    title: "Kigali Rent | Luxury Real Estate in Kigali, Rwanda",
    description: "Rwanda's most trusted real estate agency. Houses for rent, furnished homes, and plots for sale in Kigali.",
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
