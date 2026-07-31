"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { propertyService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { PropertyFormModal } from "@/features/admin/property-form-modal";
import type { PropertyListItem } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminPropertiesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyListItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => propertyService.listAdmin({ page_size: 100 }),
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Property Management</h2>
        <Button className="rounded-full gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4">Failed to load properties. Please sign in again.</p>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading properties...</p>
      ) : (
        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-800 border-b">
              <tr>
                <th className="text-left p-4 font-semibold">Title</th>
                <th className="text-left p-4 font-semibold">Type</th>
                <th className="text-left p-4 font-semibold">Price</th>
                <th className="text-left p-4 font-semibold">Status</th>
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
