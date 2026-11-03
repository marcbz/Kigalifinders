const RECENT_KEY = "kigalirent_recently_viewed";
const MAX_RECENT = 12;

export type SavedPropertySnapshot = {
  id: string;
  title: string;
  slug: string;
  primary_image?: string | null;
  price: number;
  currency: string;
  price_period?: string | null;
  listing_type: string;
  neighborhood_name?: string | null;
  district_name?: string | null;
  previous_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqm?: number | null;
  lot_size_sqm?: number | null;
  is_furnished?: boolean;
  has_title_deed?: boolean;
  property_type_name?: string | null;
  viewedAt?: string;
};

function readList(key: string): SavedPropertySnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key: string, items: SavedPropertySnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event("kigalirent-storage"));
  } catch {
    // ignore
  }
}

export function getRecentlyViewed(): SavedPropertySnapshot[] {
  return readList(RECENT_KEY);
}

export function clearRecentlyViewed() {
  writeList(RECENT_KEY, []);
}

export function trackRecentlyViewed(property: SavedPropertySnapshot) {
  const list = getRecentlyViewed().filter((p) => p.id !== property.id);
  list.unshift({ ...property, viewedAt: new Date().toISOString() });
  writeList(RECENT_KEY, list.slice(0, MAX_RECENT));
}

export function toSavedSnapshot(property: {
  id: string;
  title: string;
  slug: string;
  primary_image?: string | null;
  price: number;
  currency: string;
  price_period?: string | null;
  listing_type: string;
  neighborhood_name?: string | null;
  district_name?: string | null;
  previous_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqm?: number | null;
  lot_size_sqm?: number | null;
  is_furnished?: boolean;
  has_title_deed?: boolean;
  property_type_name?: string | null;
}): SavedPropertySnapshot {
  return {
    id: property.id,
    title: property.title,
    slug: property.slug,
    primary_image: property.primary_image,
    price: property.price,
    currency: property.currency,
    price_period: property.price_period,
    listing_type: property.listing_type,
    neighborhood_name: property.neighborhood_name,
    district_name: property.district_name,
    previous_price: property.previous_price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area_sqm: property.area_sqm,
    lot_size_sqm: property.lot_size_sqm,
    is_furnished: property.is_furnished,
    has_title_deed: property.has_title_deed,
    property_type_name: property.property_type_name,
  };
}
