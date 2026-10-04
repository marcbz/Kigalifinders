const SITE = "https://kigalirent.com";

type Props = {
  name: string;
  description: string;
  path: string;
  observationCount?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dateModified?: string | null;
  keywords?: string[];
};

function isoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** schema.org Dataset so search and AI engines treat the research pages as original data. */
export function ResearchDatasetJsonLd({
  name,
  description,
  path,
  observationCount,
  periodStart,
  periodEnd,
  dateModified,
  keywords = [],
}: Props) {
  const url = `${SITE}${path}`;
  const start = isoDate(periodStart);
  const end = isoDate(periodEnd);
  const json = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name,
    description,
    url,
    isAccessibleForFree: true,
    creator: { "@id": `${SITE}/#organization`, "@type": "Organization", name: "Kigali Rent", url: SITE },
    publisher: { "@id": `${SITE}/#organization` },
    spatialCoverage: {
      "@type": "Place",
      name: "Kigali, Rwanda",
      address: { "@type": "PostalAddress", addressLocality: "Kigali", addressCountry: "RW" },
    },
    ...(start && end ? { temporalCoverage: `${start}/${end}` } : {}),
    ...(isoDate(dateModified) ? { dateModified: isoDate(dateModified) } : {}),
    variableMeasured: [
      { "@type": "PropertyValue", name: "Typical monthly asking rent", unitText: "USD per month" },
      { "@type": "PropertyValue", name: "Middle 50% asking-rent range", unitText: "USD per month" },
      ...(observationCount
        ? [{ "@type": "PropertyValue", name: "Eligible rental observations", value: observationCount }]
        : []),
    ],
    measurementTechnique: "Bedroom-mix-adjusted median of eligible observed asking rents",
    keywords: ["Kigali rent prices", "Kigali rental market", "Rwanda housing costs", ...keywords],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
