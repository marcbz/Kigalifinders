import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SiteChromeWithSettings } from "@/components/layout/site-chrome-wrapper";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: {
    default: "Kigalifinders | Luxury Real Estate in Kigali, Rwanda",
    template: "%s | Kigalifinders",
  },
  description: "Find furnished houses, rental homes, and plots for sale in Kigali. Book property visits and discover your next home with Kigalifinders.",
  openGraph: {
    title: "Kigalifinders | Luxury Real Estate in Kigali, Rwanda",
    description: "Rwanda's most trusted real estate agency. Houses for rent, furnished homes, and plots for sale in Kigali.",
    type: "website",
    locale: "en_RW",
    siteName: "Kigalifinders",
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <Providers>
          <SiteChromeWithSettings>{children}</SiteChromeWithSettings>
        </Providers>
      </body>
    </html>
  );
}
