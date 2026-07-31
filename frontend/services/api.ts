import axios from "axios";
import type {
  BlogPost,
  FAQ,
  HomepageData,
  PaginatedResponse,
  PropertyDetail,
  PropertyListItem,
  PropertySearchParams,
  PropertyType,
  Testimonial,
} from "@/types";
import { clearAuthTokens } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/admin") && path !== "/admin/login") {
        clearAuthTokens();
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  },
);

export interface PropertyCreatePayload {
  title: string;
  description?: string;
  short_description?: string;
  listing_type: string;
  status: string;
  price: number;
  price_period?: string;
  currency?: string;
  bedrooms?: number;
  bathrooms?: number;
  area_sqm?: number;
  lot_size_sqm?: number;
  district_id?: string;
  neighborhood_id?: string;
  property_type_id?: string;
  is_featured?: boolean;
  is_furnished?: boolean;
  has_title_deed?: boolean;
  badge_label?: string;
  address?: string;
}

export type PropertyUpdatePayload = Partial<PropertyCreatePayload>;

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export const propertyService = {
  list: (params?: PropertySearchParams) =>
    api.get<PaginatedResponse<PropertyListItem>>("/properties", { params }).then((r) => r.data),
  listAdmin: (params?: PropertySearchParams) =>
    api.get<PaginatedResponse<PropertyListItem>>("/properties/manage", { params }).then((r) => r.data),
  featured: (limit = 6, listing_type?: string) =>
    api.get<PropertyListItem[]>("/properties/featured", { params: { limit, listing_type } }).then((r) => r.data),
  getBySlug: (slug: string) =>
    api.get<PropertyDetail>(`/properties/${slug}`).then((r) => r.data),
  related: (slug: string) =>
    api.get<PropertyListItem[]>(`/properties/${slug}/related`).then((r) => r.data),
  create: (data: PropertyCreatePayload) =>
    api.post<PropertyListItem>("/properties", data).then((r) => r.data),
  update: (id: string, data: PropertyUpdatePayload) =>
    api.patch<PropertyListItem>(`/properties/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/properties/${id}`),
};

export const locationService = {
  districts: () => api.get("/locations/districts").then((r) => r.data),
  neighborhoods: () => api.get("/locations/neighborhoods").then((r) => r.data),
  propertyTypes: () => api.get<PropertyType[]>("/locations/property-types").then((r) => r.data),
};

export const contentService = {
  homepage: () => api.get<HomepageData>("/homepage").then((r) => r.data),
  testimonials: () => api.get<Testimonial[]>("/testimonials").then((r) => r.data),
  faqs: () => api.get<FAQ[]>("/faqs").then((r) => r.data),
  blogPosts: () => api.get<BlogPost[]>("/blog").then((r) => r.data),
  blogPost: (slug: string) => api.get(`/blog/${slug}`).then((r) => r.data),
  contact: (data: { name: string; email: string; phone?: string; subject?: string; message: string }) =>
    api.post("/contact", data),
  newsletter: (email: string) => api.post("/newsletter", { email }),
  appointment: (data: Record<string, unknown>) => api.post("/appointments", data),
  viewingRequest: (data: Record<string, unknown>) => api.post("/viewing-requests", data),
};

export const authService = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  register: (data: { email: string; password: string; first_name?: string; last_name?: string }) =>
    api.post("/auth/register", data).then((r) => r.data),
  me: () => api.get<UserProfile>("/auth/me").then((r) => r.data),
};

export const adminService = {
  dashboard: () => api.get("/admin/dashboard").then((r) => r.data),
};
