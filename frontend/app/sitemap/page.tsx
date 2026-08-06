import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";
import { getPropertyHref } from "@/lib/property-url";
import { fetchLegalSafe, fetchPropertiesSafe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Sitemap",
  description: "Browse all pages on Kigali Rent — properties and key information.",
};

const STATIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/about", label: "About Us" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export default async function SitemapPage() {
  const [legal, properties] = await Promise.all([
    fetchLegalSafe(),
    fetchPropertiesSafe({ page_size: 200 }),
  ]);

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
        </section>

        {properties.items.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">
              Properties ({properties.total})
            </h2>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {properties.items.map((property) => (
                <li key={property.id}>
                  <Link
                    href={getPropertyHref(property)}
                    className="text-gold-600 hover:text-gold-500 hover:underline"
                  >
                    {property.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
