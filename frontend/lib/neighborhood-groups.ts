/** Hub areas that expand to multiple neighborhoods when filtering. */
export const NEIGHBORHOOD_GROUP_EXPANSIONS: Record<string, string[]> = {
  nyarugenge: ["nyarugenge", "kiyovu", "nyamirambo"],
  gasabo: [
    "gasabo",
    "nyarutarama",
    "kibagabaga",
    "gisozi",
    "remera",
    "gacuriro",
    "kacyiru",
    "kimihurura",
    "kimironko",
    "kagugu",
  ],
  kicukiro: ["kicukiro", "rebero", "kagarama"],
  bugesera: ["bugesera"],
  musanze: ["musanze"],
};

export const NEIGHBORHOOD_HUB_SLUGS = new Set(Object.keys(NEIGHBORHOOD_GROUP_EXPANSIONS));

/** Neighborhood slugs shown in search filter, sitemaps, and area landing pages. */
export const SEARCH_FILTER_NEIGHBORHOOD_SLUGS = new Set(
  Object.values(NEIGHBORHOOD_GROUP_EXPANSIONS).flat(),
);

export function neighborhoodsForSearchFilter<
  T extends { slug: string; property_count: number; name: string },
>(neighborhoods: T[]): T[] {
  return neighborhoods
    .filter((area) => SEARCH_FILTER_NEIGHBORHOOD_SLUGS.has(area.slug))
    .sort((a, b) => b.property_count - a.property_count || a.name.localeCompare(b.name));
}

export function neighborhoodFilterLabel(name: string, slug?: string): string {
  if (slug && NEIGHBORHOOD_HUB_SLUGS.has(slug.toLowerCase())) {
    return `${name} area`;
  }
  return name;
}
