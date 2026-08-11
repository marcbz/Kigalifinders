const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kigali Rent",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
};

export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
