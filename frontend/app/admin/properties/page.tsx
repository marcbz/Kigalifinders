"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { propertyService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { PropertyFormModal } from "@/features/admin/property-form-modal";
import type { PropertyListItem, PropertySearchParams } from "@/types";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { TableSkeleton } from "@/components/ui/shimmer";

const PAGE_SIZE = 10;

type AdminSortOption =
  | "views"
  | "latest"
  | "oldest"
  | "rent"
  | "sale"
  | "unfurnished"
  | "furnished";

const SORT_OPTIONS: { value: AdminSortOption; label: string }[] = [
  { value: "views", label: "Views" },
  { value: "latest", label: "Latest listing" },
  { value: "oldest", label: "Oldest listing" },
  { value: "rent", label: "Rent" },
  { value: "sale", label: "Sale" },
  { value: "unfurnished", label: "Unfurnished" },
  { value: "furnished", label: "Furnished" },
];

function buildListParams(sortBy: AdminSortOption, page: number): PropertySearchParams {
  const base = { page, page_size: PAGE_SIZE };
  switch (sortBy) {
    case "views":
      return { ...base, sort_by: "views_count", sort_order: "desc" };
    case "latest":
      return { ...base, sort_by: "created_at", sort_order: "desc" };
    case "oldest":
      return { ...base, sort_by: "created_at", sort_order: "asc" };
    case "rent":
      return { ...base, listing_type: "rent", sort_by: "created_at", sort_order: "desc" };
    case "sale":
      return { ...base, listing_type: "sale", sort_by: "created_at", sort_order: "desc" };
    case "unfurnished":
      return { ...base, listing_type: "unfurnished", sort_by: "created_at", sort_order: "desc" };
    case "furnished":
      return { ...base, listing_type: "furnished", sort_by: "created_at", sort_order: "desc" };
    default:
      return { ...base, sort_by: "created_at", sort_order: "desc" };
  }
}

export default function AdminPropertiesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyListItem | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<AdminSortOption>("latest");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-properties", page, sortBy],
    queryFn: () => propertyService.listAdmin(buildListParams(sortBy, page)),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => propertyService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-properties"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (property: PropertyListItem) => {
    setEditing(property);
    setModalOpen(true);
  };

  const handleDelete = (property: PropertyListItem) => {
    if (!window.confirm(`Delete "${property.title}"? This cannot be undone.`)) return;
    deleteMutation.mutate(property.id);
  };

  const handleSortChange = (value: AdminSortOption) => {
    setSortBy(value);
    setPage(1);
  };

  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Property Management</h2>
        <Button className="rounded-full gap-2 self-start sm:self-auto" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <label className="text-sm text-gray-500 font-medium" htmlFor="admin-sort">
          Sort by
        </label>
        <select
          id="admin-sort"
          className="lux-input max-w-xs"
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as AdminSortOption)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {data && (
          <span className="text-sm text-gray-400">
            {data.total} {data.total === 1 ? "property" : "properties"}
          </span>
        )}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4">Failed to load properties. Please sign in again.</p>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-800 border-b">
              <tr>
                <th className="text-left p-4 font-semibold">Title</th>
                <th className="text-left p-4 font-semibold">Type</th>
                <th className="text-left p-4 font-semibold">Price</th>
                <th className="text-left p-4 font-semibold">Status</th>
                <th className="text-left p-4 font-semibold">Views</th>
                <th className="text-right p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-navy-800/50">
                  <td className="p-4">
                    <Link href={`/properties/${p.slug}`} className="font-medium hover:text-gold-500">{p.title}</Link>
                  </td>
                  <td className="p-4 capitalize text-gray-500">{p.listing_type}</td>
                  <td className="p-4">${p.price.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">
                    {(p.views_count ?? 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg"
                        aria-label="Edit property"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        disabled={deleteMutation.isPending}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
                        aria-label="Delete property"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data?.items || data.items.length === 0) && (
            <p className="text-center text-gray-500 py-12">No properties yet. Add your first listing.</p>
          )}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`min-w-9 h-9 rounded-full text-sm font-medium transition ${
                    p === page
                      ? "bg-navy-800 text-gold-500"
                      : "border border-gray-200 dark:border-border hover:border-gold-500"
                  }`}
                >
                  {p}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <PropertyFormModal
        open={modalOpen}
        property={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
