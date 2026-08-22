import { SITE_ADDRESS, SITE_SOCIAL } from "@/lib/site-defaults";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

const graph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "RealEstateAgent", "LocalBusiness"],
      "@id": `${siteUrl}/#organization`,
      name: "Kigali Rent",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
      image: `${siteUrl}/logo.png`,
      description:
        "Kigali rental and property marketplace — housing costs, neighbourhood guides, and current listings for rent and sale.",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kigali",
        addressCountry: "RW",
        streetAddress: SITE_ADDRESS,
      },
      areaServed: [
        { "@type": "City", name: "Kigali" },
        { "@type": "Country", name: "Rwanda" },
      ],
      sameAs: Object.values(SITE_SOCIAL),
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Kigali Rent",
      description: "Kigali's rental and property marketplace.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-RW",
    },
  ],
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
