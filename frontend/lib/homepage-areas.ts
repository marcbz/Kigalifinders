/** Homepage-only — hidden from Areas We Serve display; still available in admin/search. */
export const HOMEPAGE_HIDDEN_AREA_SLUGS = new Set([
  "nyamirambo",
  "kagarama",
  "kiyovu",
  "kacyiru",
  "gacuriro",
]);

export const HOMEPAGE_AREAS_DISPLAY_LIMIT = 12;

export function neighborhoodsForHomepageDisplay<
  T extends { slug: string },
>(neighborhoods: T[]): T[] {
  return neighborhoods
    .filter((area) => !HOMEPAGE_HIDDEN_AREA_SLUGS.has(area.slug))
    .slice(0, HOMEPAGE_AREAS_DISPLAY_LIMIT);
}
