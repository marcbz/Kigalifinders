export type FeaturedImageSeoInput = {
  title: string;
  bedrooms?: string;
  neighborhoodId?: string;
  districtId?: string;
  propertyTypeIds?: string[];
  neighborhoods?: { id: string; name: string }[];
  propertyTypes?: { id: string; name: string }[];
  imageUrl?: string;
  altText?: string;
};

export type FeaturedImageSeoCheck = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

/** Suggested alt text for the featured image (Google Image + accessibility). */
export function suggestFeaturedImageAlt(input: FeaturedImageSeoInput): string {
  const title = input.title.trim();
  if (title) return title.slice(0, 125);

  const beds = input.bedrooms ? `${input.bedrooms}-bedroom ` : "";
  const typeName =
    input.propertyTypes?.find((pt) => input.propertyTypeIds?.includes(pt.id))?.name?.toLowerCase() ||
    "property";
  const neighborhood = input.neighborhoods?.find((n) => n.id === input.neighborhoodId)?.name;
  const place = neighborhood ? ` in ${neighborhood}, Kigali` : " in Kigali";
  return `${beds}${typeName} for rent${place}`.replace(/\s+/g, " ").trim().slice(0, 125);
}

export function buildFeaturedImageSeoChecks(input: FeaturedImageSeoInput): FeaturedImageSeoCheck[] {
  const url = (input.imageUrl || "").trim();
  const alt = (input.altText || "").trim();
  const hasListingContext = Boolean(input.title.trim() || input.bedrooms || input.neighborhoodId);

  return [
    {
      id: "url",
      label: "Featured image URL added",
      ok: url.length > 0,
      hint: "Required for Google Images, listing cards, and social previews.",
    },
    {
      id: "https",
      label: "Image served over HTTPS",
      ok: !url || url.startsWith("https://"),
      hint: "Use a secure URL (Cloudinary links are ideal).",
    },
    {
      id: "alt",
      label: "Descriptive alt text (10–125 characters)",
      ok: alt.length >= 10 && alt.length <= 125,
      hint: "Describe the home + neighborhood, e.g. “2-bedroom apartment for rent in Kimironko”.",
    },
    {
      id: "context",
      label: "Listing title or location filled in",
      ok: hasListingContext,
      hint: "Helps generate stronger alt text and page metadata.",
    },
  ];
}

export function featuredImageSeoScore(checks: FeaturedImageSeoCheck[]): number {
  if (!checks.length) return 0;
  return Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
}
