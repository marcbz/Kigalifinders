"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropertyListItem } from "@/types";
import {
  locationService,
  propertyService,
  type PropertyCreatePayload,
  type PropertyUpdatePayload,
} from "@/services/api";
import { getApiErrorMessage } from "@/lib/utils";

interface PropertyFormModalProps {
  property?: PropertyListItem | null;
  open: boolean;
  onClose: () => void;
}

const defaultForm = {
  title: "",
  description: "",
  short_description: "",
  listing_type: "rent",
  status: "draft",
  price: "",
  price_period: "month",
  currency: "USD",
  bedrooms: "",
  bathrooms: "",
  area_sqm: "",
  district_id: "",
  neighborhood_id: "",
  property_type_id: "",
  is_featured: false,
  is_furnished: false,
  has_title_deed: false,
  badge_label: "",
  address: "",
  latitude: "",
  longitude: "",
};

type ImageRow = { url: string; is_primary: boolean };

export function PropertyFormModal({ property, open, onClose }: PropertyFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [imageRows, setImageRows] = useState<ImageRow[]>([{ url: "", is_primary: true }]);
  const [error, setError] = useState("");

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
    if (property) {
      const detail = propertyDetail;
      setForm({
        title: property.title,
        description: detail?.description || "",
        short_description: property.short_description || "",
        listing_type: property.listing_type,
        status: property.status,
        price: String(property.price),
        price_period: property.price_period || "month",
        currency: property.currency || "USD",
        bedrooms: property.bedrooms != null ? String(property.bedrooms) : "",
        bathrooms: property.bathrooms != null ? String(property.bathrooms) : "",
        area_sqm: property.area_sqm != null ? String(property.area_sqm) : "",
        district_id: "",
        neighborhood_id: "",
        property_type_id: "",
        is_featured: property.is_featured,
        is_furnished: property.is_furnished,
        has_title_deed: property.has_title_deed,
        badge_label: property.badge_label || "",
        address: detail?.address || "",
        latitude: detail?.latitude != null ? String(detail.latitude) : "",
        longitude: detail?.longitude != null ? String(detail.longitude) : "",
      });
      const imgs = detail?.images?.length
        ? detail.images.map((img) => ({ url: img.url, is_primary: img.is_primary }))
        : [{ url: property.primary_image || "", is_primary: true }];
      setImageRows(imgs.length ? imgs : [{ url: "", is_primary: true }]);
    } else {
      setForm(defaultForm);
      setImageRows([{ url: "", is_primary: true }]);
    }
    setError("");
  }, [open, property, propertyDetail]);

  const filteredNeighborhoods = neighborhoods.filter(
    (n: { district_name?: string; id: string; name: string }) =>
      !form.district_id ||
      districts.find((d: { id: string; name: string }) => d.id === form.district_id)?.name === n.district_name,
  );

  const buildPayload = (): PropertyCreatePayload => ({
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    short_description: form.short_description.trim() || undefined,
    listing_type: form.listing_type,
    status: form.status,
    price: parseFloat(form.price),
    price_period: form.price_period ? form.price_period : undefined,
    currency: form.currency,
    bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
    bathrooms: form.bathrooms ? parseInt(form.bathrooms) : undefined,
    area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : undefined,
    district_id: form.district_id || undefined,
    neighborhood_id: form.neighborhood_id || undefined,
    property_type_id: form.property_type_id || undefined,
    is_featured: form.is_featured,
    is_furnished: form.is_furnished,
    has_title_deed: form.has_title_deed,
    badge_label: form.badge_label.trim() || undefined,
    address: form.address.trim() || undefined,
    latitude: form.latitude ? parseFloat(form.latitude) : undefined,
    longitude: form.longitude ? parseFloat(form.longitude) : undefined,
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">TITLE *</label>
              <input className="lux-input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
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
                {filteredNeighborhoods.map((n: { id: string; name: string }) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">PROPERTY TYPE</label>
              <select className="lux-input mt-1" value={form.property_type_id} onChange={(e) => setForm({ ...form, property_type_id: e.target.value })}>
                <option value="">Select type</option>
                {propertyTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">BEDROOMS</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">BATHROOMS</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">AREA (m²)</label>
              <input type="number" min="0" className="lux-input mt-1" value={form.area_sqm} onChange={(e) => setForm({ ...form, area_sqm: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">SHORT DESCRIPTION</label>
              <input className="lux-input mt-1" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">DESCRIPTION</label>
              <textarea className="lux-input mt-1 min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-500">ADDRESS</label>
              <input className="lux-input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">LATITUDE</label>
              <input className="lux-input mt-1" placeholder="-1.944072" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">LONGITUDE</label>
              <input className="lux-input mt-1" placeholder="30.058775" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-3">
              <label className="text-xs font-semibold text-gray-500">PROPERTY IMAGES (URLs)</label>
              <p className="text-xs text-gray-400">Mark one as featured — it appears on the homepage catalogue. Others show on the detail page gallery.</p>
              {imageRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    className="lux-input flex-1"
                    placeholder="https://..."
                    value={row.url}
                    onChange={(e) => {
                      const next = [...imageRows];
                      next[idx] = { ...next[idx], url: e.target.value };
                      setImageRows(next);
                    }}
                  />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="radio"
                      checked={row.is_primary}
                      onChange={() => setImageRows(imageRows.map((r, i) => ({ ...r, is_primary: i === idx })))}
                    />
                    Featured
                  </label>
                  <button type="button" className="text-red-500 text-sm px-2" onClick={() => setImageRows(imageRows.filter((_, i) => i !== idx))}>×</button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setImageRows([...imageRows, { url: "", is_primary: false }])}>
                Add image URL
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_furnished} onChange={(e) => setForm({ ...form, is_furnished: e.target.checked })} />
                Furnished
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
