export interface PropertyListItem {
  id: string;
  title: string;
  slug: string;
  short_description?: string;
  listing_type: string;
  status: string;
  price: number;
  price_period?: string;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  area_sqm?: number;
  lot_size_sqm?: number;
  is_featured: boolean;
  is_premium: boolean;
  is_furnished: boolean;
  has_title_deed: boolean;
  badge_label?: string;
  district_name?: string;
  neighborhood_name?: string;
  property_type_name?: string;
  primary_image?: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyDetail extends PropertyListItem {
  description?: string;
  address?: string;
  year_built?: number;
  parking_spaces?: number;
  floors?: number;
  virtual_tour_url?: string;
  floor_plan_url?: string;
  tour_360_url?: string;
  views_count: number;
  meta_title?: string;
  meta_description?: string;
  images: { id: string; url: string; alt_text?: string; is_primary: boolean }[];
  amenities: string[];
  agent_name?: string;
  agent_phone?: string;
  published_at?: string;
  created_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string;
  location?: string;
  content: string;
  avatar_url?: string;
  rating: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string;
  category_name?: string;
  read_time_minutes: number;
  published_at?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface District {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  property_count: number;
}

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  property_count: number;
  district_name?: string;
}

export interface SiteStats {
  properties_listed: number;
  happy_clients: number;
  years_experience: number;
  client_rating: number;
}

export interface HomepageData {
  stats: SiteStats;
  featured_properties: PropertyListItem[];
  featured_furnished?: PropertyListItem[];
  featured_plots: PropertyListItem[];
  testimonials: Testimonial[];
  districts: District[];
  neighborhoods: Neighborhood[];
  blog_posts: BlogPost[];
  faqs: FAQ[];
  hero?: {
    tagline?: string;
    title?: string;
    subtitle?: string;
    background_image?: string;
    cta_primary?: string;
    cta_secondary?: string;
  };
  settings?: {
    phone?: string;
    whatsapp?: string;
    address?: string;
    hours?: string;
    booking_url?: string;
    email?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PropertySearchParams {
  q?: string;
  listing_type?: string;
  district_id?: string;
  neighborhood_id?: string;
  property_type_id?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  is_featured?: boolean;
  is_furnished?: boolean;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}

export interface PropertyType {
  id: string;
  name: string;
  slug: string;
}
