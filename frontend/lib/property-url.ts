export function getPropertyHref(property: { slug?: string | null; id?: string }) {
  const slug = property.slug?.trim();
  if (!slug) return "/properties";
  return `/properties/${encodeURIComponent(slug)}`;
}
