import { SITE_GEO, SITE_PHONE, SITE_PLUS_CODE, SITE_SOCIAL, SITE_STREET_ADDRESS } from "@/lib/site-defaults";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com").replace(/\/+$/, "");

const brandAlternateNames = ["KigaliRent", "kigalirent.com"] as const;

const graph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "RealEstateAgent", "LocalBusiness"],
      "@id": `${siteUrl}/#organization`,
      name: "Kigali Rent",
      alternateName: [...brandAlternateNames],
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
      image: `${siteUrl}/logo.png`,
      description:
        "Kigali rental and property marketplace — housing costs, neighbourhood guides, and current listings for rent and sale.",
      telephone: SITE_PHONE,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kigali",
        addressCountry: "RW",
        streetAddress: SITE_STREET_ADDRESS,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: SITE_GEO.latitude,
        longitude: SITE_GEO.longitude,
      },
      hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE_PLUS_CODE)}`,
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          opens: "09:00",
          closes: "17:00",
        },
      ],
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: SITE_PHONE,
          contactType: "customer service",
          areaServed: "RW",
          url: `${siteUrl}/contact`,
        },
      ],
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
      alternateName: [...brandAlternateNames],
      description: "Kigali's rental and property marketplace.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-RW",
    },
  ],
};

const homeWebPage = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${siteUrl}/#webpage`,
  url: siteUrl,
  name: "Kigali Rent — Houses for Rent & Sale in Kigali",
  description:
    "Find houses for rent, furnished homes, and properties for sale in Kigali. Neighbourhood guides, real prices, and listings that are actually available.",
  isPartOf: { "@id": `${siteUrl}/#website` },
  about: { "@id": `${siteUrl}/#organization` },
  publisher: { "@id": `${siteUrl}/#organization` },
  inLanguage: "en-RW",
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

/** Homepage-only: the root layout renders on every route, so this must not live in `graph`. */
export function HomeWebPageJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(homeWebPage) }}
    />
  );
}
