import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { fetchLegalSafe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Sitemap",
  description: "Browse main pages on Kigali Rent — properties, neighborhoods, blog, and key information.",
};

const STATIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/area", label: "Neighborhoods" },
  { href: "/about", label: "About Us" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/agents", label: "Our Agents" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default async function SitemapPage() {
  const legal = await fetchLegalSafe();

  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">SITEMAP</span>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-6">
          Site Map
        </h1>
        <LegalDocument content={legal.sitemap_intro} />

        <section className="mt-10">
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Main Pages</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {STATIC_PAGES.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className="text-gold-600 hover:text-gold-500 hover:underline">
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-500 mt-6">
            For search engines, the full XML sitemap index is available at{" "}
            <Link href="/sitemap.xml" className="text-gold-600 hover:underline">
              /sitemap.xml
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
