import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
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
import { clearAuthTokens, getRefreshToken, setAuthTokens } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    // Use plain axios to avoid interceptor recursion
    const { data } = await axios.post<{
      access_token: string;
      refresh_token: string;
    }>(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
    setAuthTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  clearAuthTokens();
  const path = window.location.pathname;
  if (path.startsWith("/admin") && path !== "/admin/login") {
    window.location.href = "/admin/login";
  }
}

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary — default application/json breaks file uploads.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      config &&
      !config._retry &&
      !config.url?.includes("/auth/login") &&
      !config.url?.includes("/auth/refresh")
    ) {
      config._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      }
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);

export interface PropertyCreatePayload {
  title: string;
  slug?: string;
  description?: string;
  short_description?: string;
  listing_type: string;
  status: string;
  price: number;
  previous_price?: number;
  price_period?: string;
  currency?: string;
  bedrooms?: number;
  bathrooms?: number;
  area_sqm?: number;
  lot_size_sqm?: number;
  district_id?: string;
  neighborhood_id?: string;
  property_type_id?: string;
  property_type_ids?: string[];
  is_featured?: boolean;
  is_furnished?: boolean;
  has_title_deed?: boolean;
  badge_label?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  realtor_name?: string;
  has_balcony?: boolean;
  has_kitchen?: boolean;
  has_pool?: boolean;
  has_parking?: boolean;
  has_jacuzzi?: boolean;
  has_garden?: boolean;
  pets_allowed?: boolean;
  show_features_table?: boolean;
  meta_title?: string;
  meta_description?: string;
  images?: { url: string; alt_text?: string; is_primary?: boolean; sort_order?: number }[];
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
  related: (slug: string, page = 1, pageSize = 12) =>
    api
      .get<PaginatedResponse<PropertyListItem>>(`/properties/${slug}/related`, {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data),
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
  listingAlert: (data: {
    email: string;
    budget?: string;
    area?: string;
    bedrooms?: string;
    intent?: string;
    search_url?: string;
  }) => api.post("/listing-alerts", data),
  appointment: (data: Record<string, unknown>) => api.post("/appointments", data),
  viewingRequest: (data: Record<string, unknown>) => api.post("/viewing-requests", data),
};

export const authService = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  register: (data: { email: string; password: string; first_name?: string; last_name?: string }) =>
    api.post("/auth/register", data).then((r) => r.data),
  me: () => api.get<UserProfile>("/auth/me").then((r) => r.data),
  refresh: (refreshToken: string) =>
    api
      .post<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        refresh_token: refreshToken,
      })
      .then((r) => r.data),
};

export const adminService = {
  dashboard: () => api.get("/admin/dashboard").then((r) => r.data),
  messages: () => api.get("/admin/messages").then((r) => r.data),
  inquiries: () => api.get("/admin/inquiries").then((r) => r.data),
  markMessageRead: (id: string) => api.patch(`/admin/messages/${id}/read`),
  deleteMessage: (id: string) => api.delete(`/admin/messages/${id}`),
  deleteInquiry: (id: string) => api.delete(`/admin/inquiries/${id}`),
  blogPosts: () => api.get("/admin/blog").then((r) => r.data),
  blogPost: (id: string) => api.get(`/admin/blog/${id}`).then((r) => r.data),
  createBlogPost: (data: Record<string, unknown>) => api.post("/admin/blog", data).then((r) => r.data),
  updateBlogPost: (id: string, data: Record<string, unknown>) => api.patch(`/admin/blog/${id}`, data).then((r) => r.data),
  deleteBlogPost: (id: string) => api.delete(`/admin/blog/${id}`),
  uploadImage: (file: File, folder = "kigalifinders") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    return api.post<{ url: string }>("/admin/upload", formData).then((r) => r.data.url);
  },
  faqs: () => api.get("/admin/faqs").then((r) => r.data),
  createFaq: (data: Record<string, unknown>) => api.post("/admin/faqs", data).then((r) => r.data),
  updateFaq: (id: string, data: Record<string, unknown>) => api.patch(`/admin/faqs/${id}`, data).then((r) => r.data),
  deleteFaq: (id: string) => api.delete(`/admin/faqs/${id}`),
  getSettings: () => api.get<Record<string, unknown>>("/admin/settings").then((r) => r.data),
  updateSettings: (updates: { key: string; value: unknown }[]) =>
    api.patch("/admin/settings", updates).then((r) => r.data),
  updateLegalSettings: (data: { privacy_policy: string; terms_of_service: string; sitemap_intro: string }) =>
    api.patch("/admin/settings/legal", data).then((r) => r.data),
  searchIntents: () => api.get("/admin/market/search-intents").then((r) => r.data),
  regenerateSearchIntent: (id: string) => api.post(`/admin/market/search-intents/${id}/regenerate`).then((r) => r.data),
  approveSearchIntent: (id: string) => api.post(`/admin/market/search-intents/${id}/approve`).then((r) => r.data),
  noindexSearchIntent: (id: string) => api.post(`/admin/market/search-intents/${id}/noindex`).then((r) => r.data),
  lockSearchIntent: (id: string, locked = true) =>
    api.post(`/admin/market/search-intents/${id}/lock`, null, { params: { locked } }).then((r) => r.data),
  bulkSearchIntents: (ids: string[], action: string) =>
    api.post("/admin/market/search-intents/bulk", { ids, action }).then((r) => r.data),
  rebuildResearch: () => api.post("/admin/market/research/rebuild").then((r) => r.data),
  runDiscovery: (deep = true) =>
    api.post("/admin/market/automation/discover", null, { params: { deep } }).then((r) => r.data),
  listObservations: (params?: { page?: number; page_size?: number; source?: string; status?: string }) =>
    api.get("/admin/market/observations", { params }).then((r) => r.data),
  bulkObservations: (ids: string[], action: string) =>
    api.post("/admin/market/observations/bulk", { ids, action }).then((r) => r.data),
  marketSources: () => api.get("/admin/market/market-sources").then((r) => r.data),
  reviewMarketSource: (sourceId: string) =>
    api.post(`/admin/market/market-sources/${sourceId}/review`).then((r) => r.data),
  enableMarketSource: (sourceId: string) =>
    api.post(`/admin/market/market-sources/${sourceId}/enable`).then((r) => r.data),
  disableMarketSource: (sourceId: string) =>
    api.post(`/admin/market/market-sources/${sourceId}/disable`).then((r) => r.data),
  runMarketSourceNow: (sourceId: string) =>
    api.post(`/admin/market/market-sources/${sourceId}/run`).then((r) => r.data),
  runExternalResearch: (payload: { source_ids: string[]; mode: string }) =>
    api.post("/admin/market/external-research/run", payload).then((r) => r.data),
  listCollectionRuns: () => api.get("/admin/market/external-research/runs").then((r) => r.data),
  getCollectionRun: (runId: string) =>
    api.get(`/admin/market/external-research/runs/${runId}`).then((r) => r.data),
  importObservationsCsv: (file: File, sourceId?: string) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post("/admin/market/observations/import-csv", form, {
        params: sourceId ? { source_id: sourceId } : undefined,
      })
      .then((r) => r.data);
  },
  gscSuggestions: () => api.get("/admin/market/gsc-suggestions").then((r) => r.data),
};
