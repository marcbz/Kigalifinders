import { api } from "@/services/api";

/** Admin-only Property CRM client. Imported only from /admin/property-crm routes. */

type Params = Record<string, string | number | boolean | null | undefined>;
export type Body = Record<string, unknown>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  [extra: string]: unknown;
}

export interface Option {
  id: string;
  name: string;
}

export interface Lookups {
  districts: Option[];
  neighborhoods: (Option & { district_id: string })[];
  property_types: Option[];
  users: Option[];
  landlords: Option[];
  vocab: Record<
    | "availability"
    | "landlord_status"
    | "contact_methods"
    | "lead_status"
    | "lead_source"
    | "furnishing"
    | "viewing_status"
    | "interest_level"
    | "deal_status"
    | "commission_type"
    | "commission_status"
    | "follow_up_status"
    | "follow_up_priority"
    | "document_type"
    | "currency",
    string[]
  >;
}

export interface Activity {
  id: string;
  event: string;
  summary: string;
  note: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  user_name: string;
  property_id: string | null;
  property_ref: string | null;
  landlord_id: string | null;
  landlord_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  deal_id: string | null;
}

export interface CrmPropertyRow {
  id: string;
  crm_ref: string;
  slug: string;
  public_url: string | null;
  title: string;
  published: boolean;
  publication_status: string;
  listing_type: string;
  price: number;
  currency: string;
  usd_price: number | null;
  price_period: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  is_furnished: boolean;
  availability_status: string;
  availability_updated_at: string | null;
  availability_verified_at: string | null;
  availability_note: string | null;
  verification_due: boolean;
  landlord_id: string | null;
  landlord_name: string | null;
  district_name: string | null;
  neighborhood_name: string | null;
  property_type_name: string | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_currency: string | null;
  created_at: string;
}

export interface Landlord {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  preferred_contact: string | null;
  status: string;
  notes: string | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_currency: string | null;
  commission_notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  properties_total?: number;
  properties_active?: number;
  properties_rented?: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  district_id: string | null;
  district_name: string | null;
  neighborhood_id: string | null;
  neighborhood_name: string | null;
  area_preference: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: string | null;
  property_type_id: string | null;
  property_type_name: string | null;
  move_in_date: string | null;
  requirements: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface Viewing {
  id: string;
  property_id: string | null;
  property_ref: string | null;
  property_title: string | null;
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  landlord_id: string | null;
  landlord_name: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  client_feedback: string | null;
  interest_level: string | null;
  next_action: string | null;
  created_at: string;
}

export interface Deal {
  id: string;
  property_id: string | null;
  property_ref: string | null;
  property_title: string | null;
  landlord_id: string | null;
  landlord_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  rent_amount: number | null;
  currency: string;
  status: string;
  expected_move_in: string | null;
  lease_start: string | null;
  lease_end: string | null;
  contract_signed_on: string | null;
  completed_at: string | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_currency: string | null;
  commission_amount: number | null;
  commission_amount_usd: number | null;
  commission_status: string;
  commission_overdue: boolean;
  commission_due_date: string | null;
  commission_paid_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  title: string;
  due_at: string;
  priority: string;
  status: string;
  notes: string | null;
  overdue: boolean;
  landlord_id: string | null;
  landlord_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  property_id: string | null;
  property_ref: string | null;
  deal_id: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CrmDocument {
  id: string;
  title: string;
  doc_type: string;
  storage: string;
  file_name: string | null;
  file_format: string | null;
  size_bytes: number | null;
  notes: string | null;
  landlord_id: string | null;
  landlord_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  property_id: string | null;
  property_ref: string | null;
  deal_id: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface EffectiveCommission {
  type: string;
  value: number;
  currency: string | null;
  source: "property" | "landlord";
}

export interface CrmPropertyDetail extends CrmPropertyRow {
  crm_notes: string | null;
  address: string | null;
  area_sqm: number | null;
  availability_verified_by: string | null;
  image_url: string | null;
  verify_after_days: number;
  landlord: Landlord | null;
  effective_commission: EffectiveCommission | null;
  leads: { id: string; name: string; status: string; phone: string | null; note: string | null; linked_at: string }[];
  viewings: Viewing[];
  deals: Deal[];
  follow_ups: FollowUp[];
  documents: CrmDocument[];
  activity: Activity[];
}

export interface LandlordDetail extends Landlord {
  properties: CrmPropertyRow[];
  deals: Deal[];
  commission_summary: { paid_usd: number; pending_usd: number; overdue_usd: number };
  follow_ups: FollowUp[];
  documents: CrmDocument[];
  activity: Activity[];
}

export interface LeadDetail extends Lead {
  properties: (CrmPropertyRow & { link_note: string | null; linked_at: string })[];
  viewings: Viewing[];
  deals: Deal[];
  follow_ups: FollowUp[];
  documents: CrmDocument[];
  activity: Activity[];
}

export interface Dashboard {
  kpis: Record<string, number>;
  needs_verification: {
    id: string;
    crm_ref: string;
    title: string;
    landlord_name: string | null;
    neighborhood_name: string | null;
    availability_verified_at: string | null;
  }[];
  follow_ups: FollowUp[];
  upcoming_viewings: Viewing[];
  recent_leads: Pick<Lead, "id" | "name" | "status" | "source" | "budget_max" | "currency" | "created_at">[];
  recent_deals: Deal[];
  recent_activity: Activity[];
  today: string;
}

export interface Reports {
  date_from: string;
  date_to: string;
  totals: Record<string, number>;
  by_availability: { status: string; count: number }[];
  by_district: { district: string; total: number; available: number; rented: number }[];
  leads_by_source: { source: string; count: number }[];
  landlord_performance: {
    id: string;
    name: string;
    status: string;
    properties_total: number;
    properties_active: number;
    properties_rented: number;
    deals_completed: number;
    commission_paid_usd: number;
  }[];
}

const BASE = "/admin/crm";

function clean(params?: Params): Params | undefined {
  if (!params) return undefined;
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v !== null && v !== undefined && v !== false) out[k] = v;
  }
  return out;
}

const get = async <T>(path: string, params?: Params) => (await api.get<T>(`${BASE}${path}`, { params: clean(params) })).data;
const post = async <T>(path: string, body?: unknown) => (await api.post<T>(`${BASE}${path}`, body ?? {})).data;
const patch = async <T>(path: string, body: unknown) => (await api.patch<T>(`${BASE}${path}`, body)).data;
const put = async <T>(path: string, body: unknown) => (await api.put<T>(`${BASE}${path}`, body)).data;
const del = async (path: string) => {
  await api.delete(`${BASE}${path}`);
};

export const crmApi = {
  settings: () => get<{ verify_after_days: number }>("/settings"),
  saveSettings: (body: { verify_after_days: number }) => put<{ verify_after_days: number }>("/settings", body),
  lookups: () => get<Lookups>("/lookups"),
  dashboard: () => get<Dashboard>("/dashboard"),
  reports: (params?: Params) => get<Reports>("/reports", params),

  properties: (params?: Params) => get<Page<CrmPropertyRow> & { verify_after_days: number }>("/properties", params),
  property: (id: string) => get<CrmPropertyDetail>(`/properties/${id}`),
  updateProperty: (id: string, body: Body) => patch<CrmPropertyDetail>(`/properties/${id}`, body),
  setAvailability: (id: string, status: string, note?: string) =>
    post<CrmPropertyDetail>(`/properties/${id}/availability`, { status, note: note || undefined }),
  confirmAvailable: (id: string, note?: string) =>
    post<CrmPropertyDetail>(`/properties/${id}/confirm-available`, { note: note || undefined }),

  landlords: (params?: Params) => get<Page<Landlord>>("/landlords", params),
  landlord: (id: string) => get<LandlordDetail>(`/landlords/${id}`),
  createLandlord: (body: Body) => post<Landlord>("/landlords", body),
  updateLandlord: (id: string, body: Body) => patch<Landlord>(`/landlords/${id}`, body),
  landlordContacted: (id: string, body: { method?: string; note?: string }) => post<Landlord>(`/landlords/${id}/contacted`, body),
  deleteLandlord: (id: string) => del(`/landlords/${id}`),

  leads: (params?: Params) => get<Page<Lead>>("/leads", params),
  lead: (id: string) => get<LeadDetail>(`/leads/${id}`),
  createLead: (body: Body) => post<LeadDetail>("/leads", body),
  updateLead: (id: string, body: Body) => patch<LeadDetail>(`/leads/${id}`, body),
  leadContacted: (id: string, body: { method?: string; note?: string }) => post<LeadDetail>(`/leads/${id}/contacted`, body),
  deleteLead: (id: string) => del(`/leads/${id}`),
  linkLeadProperty: (id: string, propertyId: string, note?: string) =>
    post<LeadDetail>(`/leads/${id}/properties`, { property_id: propertyId, note: note || undefined }),
  unlinkLeadProperty: async (id: string, propertyId: string) =>
    (await api.delete<LeadDetail>(`${BASE}/leads/${id}/properties/${propertyId}`)).data,
  leadMatches: (id: string) => get<{ items: CrmPropertyRow[] }>(`/leads/${id}/matches`),

  viewings: (params?: Params) => get<Page<Viewing>>("/viewings", params),
  createViewing: (body: Body) => post<Viewing>("/viewings", body),
  updateViewing: (id: string, body: Body) => patch<Viewing>(`/viewings/${id}`, body),
  deleteViewing: (id: string) => del(`/viewings/${id}`),

  deals: (params?: Params) => get<Page<Deal>>("/deals", params),
  createDeal: (body: Body) => post<Deal>("/deals", body),
  updateDeal: (id: string, body: Body) => patch<Deal>(`/deals/${id}`, body),
  deleteDeal: (id: string) => del(`/deals/${id}`),
  commissions: (params?: Params) =>
    get<Page<Deal> & { summary: { expected_usd: number; pending_usd: number; overdue_usd: number; paid_usd: number; overdue_count: number } }>(
      "/commissions",
      params,
    ),

  followUps: (params?: Params) => get<Page<FollowUp>>("/follow-ups", params),
  createFollowUp: (body: Body) => post<FollowUp>("/follow-ups", body),
  updateFollowUp: (id: string, body: Body) => patch<FollowUp>(`/follow-ups/${id}`, body),
  deleteFollowUp: (id: string) => del(`/follow-ups/${id}`),

  documents: (params?: Params) => get<Page<CrmDocument> & { storage_configured: boolean }>("/documents", params),
  uploadDocument: (form: FormData) => post<CrmDocument>("/documents", form),
  addDocumentLink: (body: Body) => post<CrmDocument>("/documents/link", body),
  documentUrl: (id: string) => get<{ url: string; expires_in: number | null }>(`/documents/${id}/download`),
  deleteDocument: (id: string) => del(`/documents/${id}`),

  activity: (params?: Params) => get<Page<Activity>>("/activity", params),
  addNote: (body: Body) => post<{ ok: boolean }>("/activity", body),
};
