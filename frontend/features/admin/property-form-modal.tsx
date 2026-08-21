"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogRichTextEditor } from "@/components/admin/blog-rich-text-editor";
import { ImageUrlOrUpload } from "@/components/admin/image-url-or-upload";
import type { PropertyListItem } from "@/types";
import {
  locationService,
  propertyService,
  type PropertyCreatePayload,
  type PropertyUpdatePayload,
} from "@/services/api";
import { getApiErrorMessage } from "@/lib/utils";
import {
  clearAdminDraft,
  draftHasContent,
  formatDraftSavedAt,
  loadAdminDraft,
  saveAdminDraft,
} from "@/lib/admin-drafts";

interface PropertyFormModalProps {
  property?: PropertyListItem | null;
  open: boolean;
  onClose: () => void;
}

type ImageRow = { url: string; is_primary: boolean };

function propertyDraftKey(propertyId?: string | null) {
  return propertyId ? `property:${propertyId}` : "property:new";
}

const defaultForm = {
  title: "",
  slug: "",
  description: "",
  short_description: "",
  meta_title: "",
  meta_description: "",
  listing_type: "rent",
  status: "draft",
  price: "",
  price_period: "month",
  currency: "USD",
  bedrooms: "",
  bathrooms: "",
  area_sqm: "",
  lot_size_sqm: "",
  district_id: "",
  neighborhood_id: "",
  realtor_name: "",
  is_furnished_yn: "",
  has_balcony: "",
  has_kitchen: "",
  has_pool: "",
  has_parking: "",
  has_jacuzzi: "",
  has_garden: "",
  pets_allowed: "",
  show_features_table: true,
  is_featured: false,
  has_title_deed: false,
  badge_label: "",
  property_type_ids: [] as string[],
};

type PropertyDraftData = {
  form: typeof defaultForm;
  imageRows: ImageRow[];
};

function boolToYesNo(value?: boolean): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function yesNoToBool(value: string): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      <select className="lux-input mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

export function PropertyFormModal({ property, open, onClose }: PropertyFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [imageRows, setImageRows] = useState<ImageRow[]>([{ url: "", is_primary: true }]);
  const [error, setError] = useState("");
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const skipNextDraftSave = useRef(false);
  const draftKey = propertyDraftKey(property?.id);

  const { data: districts = [] } = useQuery({
    queryKey: ["districts"],
    queryFn: locationService.districts,
    enabled: open,
    staleTime: 0,
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: locationService.neighborhoods,
    enabled: open,
    staleTime: 0,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["property-types"],
    queryFn: locationService.propertyTypes,
    enabled: open,
    staleTime: 0,
  });

  const { data: propertyDetail } = useQuery({
    queryKey: ["property-detail", property?.slug],
    queryFn: () => propertyService.getBySlug(property!.slug),
    enabled: open && !!property?.slug,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) return;
    skipNextDraftSave.current = true;
    setDraftNotice(null);

    const applyDraftIfAny = (baseForm: typeof defaultForm, baseImages: ImageRow[]) => {
      const draft = loadAdminDraft<PropertyDraftData>(draftKey);
      if (draft && draftHasContent(draft.data)) {
        setForm({ ...defaultForm, ...draft.data.form });
        setImageRows(
          draft.data.imageRows?.length ? draft.data.imageRows : [{ url: "", is_primary: true }],
        );
        setDraftNotice(`Unsaved draft restored (saved ${formatDraftSavedAt(draft.savedAt)}).`);
        return;
      }
      setForm(baseForm);
      setImageRows(baseImages);
    };

    if (property) {
      const detail = propertyDetail;
      if (property.slug && detail === undefined) return;
      applyDraftIfAny(
        {
          title: property.title,
          slug: property.slug || "",
          description: detail?.description || "",
          short_description: property.short_description || "",
          meta_title: detail?.meta_title || "",
          meta_description: detail?.meta_description || "",
          listing_type: property.listing_type,
          status: property.status,
          price: String(property.price),
          price_period: property.price_period || "month",
          currency: property.currency || "USD",
          bedrooms: property.bedrooms != null ? String(property.bedrooms) : "",
          bathrooms: property.bathrooms != null ? String(property.bathrooms) : "",
          area_sqm: property.area_sqm != null ? String(property.area_sqm) : "",
          lot_size_sqm: property.lot_size_sqm != null ? String(property.lot_size_sqm) : "",
          district_id: "",
          neighborhood_id: "",
          property_type_ids:
            detail?.property_type_ids?.length
              ? detail.property_type_ids
              : property.property_type_ids?.length
                ? property.property_type_ids
                : [],
          realtor_name: detail?.realtor_name || "",
          is_furnished_yn: boolToYesNo(property.is_furnished),
          has_balcony: boolToYesNo(detail?.has_balcony),
          has_kitchen: boolToYesNo(detail?.has_kitchen),
          has_pool: boolToYesNo(detail?.has_pool),
          has_parking: boolToYesNo(detail?.has_parking),
          has_jacuzzi: boolToYesNo(detail?.has_jacuzzi),
          has_garden: boolToYesNo(detail?.has_garden),
          pets_allowed: boolToYesNo(detail?.pets_allowed),
          show_features_table: detail?.show_features_table !== false,
          is_featured: property.is_featured,
          has_title_deed: property.has_title_deed,
          badge_label: property.badge_label || "",
        },
        detail?.images?.length
          ? detail.images.map((img) => ({ url: img.url, is_primary: img.is_primary }))
          : [{ url: property.primary_image || "", is_primary: true }],
      );
    } else {
      applyDraftIfAny(defaultForm, [{ url: "", is_primary: true }]);
    }
    setError("");
  }, [open, property, propertyDetail, draftKey]);

  useEffect(() => {
    if (!open) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const payload: PropertyDraftData = { form, imageRows };
      if (!draftHasContent(payload)) {
        clearAdminDraft(draftKey);
        return;
      }
      saveAdminDraft(draftKey, payload);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [form, imageRows, open, draftKey]);

  const filteredNeighborhoods = neighborhoods.filter(
    (n: { district_name?: string; id: string; name: string }) =>
      !form.district_id ||
      districts.find((d: { id: string; name: string }) => d.id === form.district_id)?.name === n.district_name,
  );

  const buildPayload = (): PropertyCreatePayload => ({
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    description:
      form.description.trim() && form.description.trim() !== "<p></p>" ? form.description.trim() : undefined,
    short_description: form.short_description.trim() || undefined,
    meta_title: form.meta_title.trim() || undefined,
    meta_description: form.meta_description.trim() || undefined,
    listing_type: form.listing_type,
    status: form.status,
    price: parseFloat(form.price),
    price_period: form.price_period ? form.price_period : undefined,
    currency: form.currency,
    bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
    bathrooms: form.bathrooms ? parseInt(form.bathrooms) : undefined,
    area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : undefined,
    lot_size_sqm: form.lot_size_sqm ? parseFloat(form.lot_size_sqm) : undefined,
    district_id: form.district_id || undefined,
    neighborhood_id: form.neighborhood_id || undefined,
    property_type_ids: form.property_type_ids.length ? form.property_type_ids : undefined,
    property_type_id: form.property_type_ids[0] || undefined,
    realtor_name: form.realtor_name.trim() || undefined,
    is_furnished: yesNoToBool(form.is_furnished_yn) ?? false,
    has_balcony: yesNoToBool(form.has_balcony) ?? false,
    has_kitchen: yesNoToBool(form.has_kitchen) ?? false,
    has_pool: yesNoToBool(form.has_pool) ?? false,
    has_parking: yesNoToBool(form.has_parking) ?? false,
    has_jacuzzi: yesNoToBool(form.has_jacuzzi) ?? false,
    has_garden: yesNoToBool(form.has_garden) ?? false,
    pets_allowed: yesNoToBool(form.pets_allowed) ?? false,
    show_features_table: form.show_features_table,
    is_featured: form.is_featured,
    has_title_deed: form.has_title_deed,
    badge_label: form.badge_label.trim() || undefined,
    images: imageRows
      .filter((img) => img.url.trim())
      .map((img, i) => ({
        url: img.url.trim(),
        is_primary: img.is_primary,
        sort_order: i,
      })),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload.title || !payload.price) {
        throw new Error("Title and price are required");
      }
      if (property) {
        return propertyService.update(property.id, payload as PropertyUpdatePayload);
      }
      return propertyService.create(payload);
    },
    onSuccess: () => {
      clearAdminDraft(draftKey);
      setDraftNotice(null);
      queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      queryClient.invalidateQueries({ queryKey: ["property-detail"] });
      onClose();
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, "Failed to save property"));
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white">
            {property ? "Edit Property" : "Add Property"}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-navy-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="p-6 space-y-4"
        >
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {draftNotice && (
            <div className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-sm text-navy-800 dark:text-cream flex items-start justify-between gap-3">
              <p>
                {draftNotice} Your work is kept in this browser if you get logged out.
              </p>
              <button
                type="button"
                className="text-xs underline shrink-0"
                onClick={() => {
                  clearAdminDraft(draftKey);
                  setDraftNotice(null);
                }}
              >
                Discard draft
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">TITLE *</label>
              <input
                className="lux-input mt-1"
                placeholder="e.g. Furnished 2-bedroom apartment in Kimironko"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">URL SLUG (SEO)</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-1">Auto-generated from title if empty.</p>
              <input
                className="lux-input"
                placeholder="auto-generated from title if empty"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">LISTING TYPE</label>
              <select className="lux-input mt-1" value={form.listing_type} onChange={(e) => setForm({ ...form, listing_type: e.target.value })}>
                <option value="rent">Rent</option>
                <option value="sale">Sale</option>
                <option value="furnished">Furnished</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">STATUS</label>
              <select className="lux-input mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">PRICE *</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">PRICE PERIOD</label>
              <select className="lux-input mt-1" value={form.price_period} onChange={(e) => setForm({ ...form, price_period: e.target.value })}>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="">None (sale)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">DISTRICT</label>
              <select className="lux-input mt-1" value={form.district_id} onChange={(e) => setForm({ ...form, district_id: e.target.value, neighborhood_id: "" })}>
                <option value="">Select district</option>
                {districts.map((d: { id: string; name: string }) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">NEIGHBORHOOD</label>
              <select className="lux-input mt-1" value={form.neighborhood_id} onChange={(e) => setForm({ ...form, neighborhood_id: e.target.value })}>
                <option value="">Select neighborhood</option>
                {filteredNeighborhoods.map((n: { id: string; name: string; district_name?: string }) => (
                  <option key={n.id} value={n.id}>{n.name}{n.district_name ? ` — ${n.district_name}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">PROPERTY TYPES</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">Select all that apply — e.g. House + Villa so it appears in both searches.</p>
              <div className="flex flex-wrap gap-3">
                {propertyTypes.map((pt) => {
                  const checked = form.property_type_ids.includes(pt.id);
                  return (
                    <label key={pt.id} className="flex items-center gap-2 text-sm border rounded-full px-3 py-1.5 cursor-pointer hover:border-gold-500">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? form.property_type_ids.filter((id) => id !== pt.id)
                            : [...form.property_type_ids, pt.id];
                          setForm({ ...form, property_type_ids: next });
                        }}
                      />
                      {pt.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2 pt-2">
              <h4 className="text-sm font-semibold text-navy-800 dark:text-white mb-1">Property features</h4>
              <p className="text-xs text-gray-400 mb-3">
                Optional table on the property page (realtor, furnished, pool, etc.). Turn off for plots/land where these fields do not apply.
              </p>
              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={form.show_features_table}
                  onChange={(e) => setForm({ ...form, show_features_table: e.target.checked })}
                />
                Show property features table on listing page
              </label>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">REALTOR</label>
              <input className="lux-input mt-1" placeholder="e.g. Ishimwe Marcel" value={form.realtor_name} onChange={(e) => setForm({ ...form, realtor_name: e.target.value })} />
            </div>
            <YesNoField label="FURNISHED" value={form.is_furnished_yn} onChange={(v) => setForm({ ...form, is_furnished_yn: v })} />
            <YesNoField label="BALCONY" value={form.has_balcony} onChange={(v) => setForm({ ...form, has_balcony: v })} />
            <div>
              <label className="text-xs font-semibold text-gray-500">PLOT AREA (m²)</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.lot_size_sqm} onChange={(e) => setForm({ ...form, lot_size_sqm: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">LIVING AREA (m²)</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.area_sqm} onChange={(e) => setForm({ ...form, area_sqm: e.target.value })} />
            </div>
            <YesNoField label="KITCHEN" value={form.has_kitchen} onChange={(v) => setForm({ ...form, has_kitchen: v })} />
            <div>
              <label className="text-xs font-semibold text-gray-500">BEDROOMS</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            </div>
            <YesNoField label="POOL" value={form.has_pool} onChange={(v) => setForm({ ...form, has_pool: v })} />
            <div>
              <label className="text-xs font-semibold text-gray-500">BATHROOMS</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            </div>
            <YesNoField label="PARKING" value={form.has_parking} onChange={(v) => setForm({ ...form, has_parking: v })} />
            <YesNoField label="JACUZZI" value={form.has_jacuzzi} onChange={(v) => setForm({ ...form, has_jacuzzi: v })} />
            <YesNoField label="GARDEN" value={form.has_garden} onChange={(v) => setForm({ ...form, has_garden: v })} />
            <YesNoField label="PETS ALLOWED" value={form.pets_allowed} onChange={(v) => setForm({ ...form, pets_allowed: v })} />
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">SHORT DESCRIPTION (EXCERPT)</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-1">
                Short summary for property cards and search snippets (150–160 chars ideal).
              </p>
              <textarea
                className="lux-input min-h-[72px]"
                placeholder="A concise intro that hooks readers and supports SEO..."
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">DESCRIPTION</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">
                Paste Markdown, HTML, or rich text — tables, headings, links, and lists are converted
                automatically. Use Preview to see exactly how the listing will appear.
              </p>
              <BlogRichTextEditor
                value={form.description}
                onChange={(html) => setForm({ ...form, description: html })}
                placeholder="Describe the property — bedrooms layout, neighborhood perks, nearby amenities..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">META TITLE (SEO)</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-1">Page title for Google (≤60 chars).</p>
              <input
                className="lux-input"
                placeholder="Page title for Google (≤60 chars)"
                value={form.meta_title}
                onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">META DESCRIPTION (SEO)</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-1">Search result description (≤160 chars).</p>
              <textarea
                className="lux-input min-h-[72px]"
                placeholder="Search result description (≤160 chars)"
                value={form.meta_description}
                onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-3">
              <label className="text-xs font-semibold text-gray-500">PROPERTY IMAGES</label>
              <p className="text-xs text-gray-400">
                Paste image URLs. Mark one as featured — it appears on cards and social previews.
              </p>
              {imageRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <ImageUrlOrUpload
                      label=""
                      folder="kigalifinders/properties"
                      allowUpload={false}
                      value={row.url}
                      onChange={(url) => {
                        const next = [...imageRows];
                        next[idx] = { ...next[idx], url };
                        setImageRows(next);
                      }}
                      previewClassName="h-16 w-24 rounded-lg object-cover border mt-2"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap pt-2">
                    <input
                      type="radio"
                      checked={row.is_primary}
                      onChange={() => setImageRows(imageRows.map((r, i) => ({ ...r, is_primary: i === idx })))}
                    />
                    Featured
                  </label>
                  <button
                    type="button"
                    className="text-red-500 text-sm px-2 pt-2"
                    onClick={() => setImageRows(imageRows.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setImageRows([...imageRows, { url: "", is_primary: false }])}
              >
                Add image
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.has_title_deed} onChange={(e) => setForm({ ...form, has_title_deed: e.target.checked })} />
                Title deed
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending} className="rounded-full">
              {saveMutation.isPending ? "Saving..." : property ? "Update Property" : "Create Property"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
