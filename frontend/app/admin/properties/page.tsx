"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { propertyService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { PropertyFormModal } from "@/features/admin/property-form-modal";
import { WatermarkExistingPanel } from "@/features/admin/watermark-existing-panel";
import type { PropertyListItem, PropertySearchParams } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
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

function buildListParams(sortBy: AdminSortOption, page: number, q: string): PropertySearchParams {
  const base = { page, page_size: PAGE_SIZE, ...(q ? { q } : {}) };
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-properties", page, sortBy, search],
    queryFn: () => propertyService.listAdmin(buildListParams(sortBy, page, search)),
    placeholderData: keepPreviousData,
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

      <WatermarkExistingPanel />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            className="lux-input w-full pl-9 pr-9"
            placeholder="Search by title, address, or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search properties"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
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
            {search ? ` matching “${search}”` : ""}
            {isFetching ? " · searching…" : ""}
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
                <th className="text-left p-4 font-semibold">Published</th>
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
                  <td className="p-4 text-gray-500 text-sm">
                    {p.published_at ? formatDateTime(p.published_at) : "—"}
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
            <p className="text-center text-gray-500 py-12">
              {search ? `No properties match “${search}”.` : "No properties yet. Add your first listing."}
            </p>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
