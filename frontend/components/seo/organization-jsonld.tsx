import { SITE_ADDRESS, SITE_SOCIAL } from "@/lib/site-defaults";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

const brandAlternateNames = ["Kigali Rent", "kigalirent.com"] as const;

const graph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "RealEstateAgent", "LocalBusiness"],
      "@id": `${siteUrl}/#organization`,
      name: "KigaliRent",
      alternateName: [...brandAlternateNames],
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
      name: "KigaliRent",
      alternateName: [...brandAlternateNames],
      description: "Kigali's rental and property marketplace.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-RW",
    },
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/#webpage`,
      url: siteUrl,
      name: "KigaliRent — Houses for Rent & Sale in Kigali",
      description:
        "Find houses for rent, furnished homes, and properties for sale in Kigali. Neighbourhood guides, real prices, and listings that are actually available.",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#organization` },
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
