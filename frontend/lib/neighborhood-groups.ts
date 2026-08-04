/** Hub areas that expand to multiple neighborhoods when filtering. */
export const NEIGHBORHOOD_HUB_SLUGS = new Set([
  "nyarugenge",
  "gasabo",
  "kicukiro",
  "bugesera",
  "musanze",
]);

export function neighborhoodFilterLabel(name: string, slug?: string): string {
  if (slug && NEIGHBORHOOD_HUB_SLUGS.has(slug.toLowerCase())) {
    return `${name} area`;
  }
  return name;
}
