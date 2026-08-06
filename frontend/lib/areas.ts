export type NeighborhoodSummary = {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  property_count: number;
  district_name?: string | null;
};

export function getAreaHref(slug: string): string {
  return `/areas/${encodeURIComponent(slug.trim().toLowerCase())}`;
}

export function getPropertiesFilterHref(slug: string): string {
  return `/properties?neighborhood_slug=${encodeURIComponent(slug.trim().toLowerCase())}`;
}
