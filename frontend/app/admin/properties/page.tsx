"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { propertyService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminPropertiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => propertyService.list({ page_size: 50 }),
    retry: false,
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Property Management</h2>
        <Button className="rounded-full gap-2">
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </div>

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
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg"><Pencil className="w-4 h-4" /></button>
                      <button className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data?.items || data.items.length === 0) && (
            <p className="text-center text-gray-500 py-12">No properties yet. Run the seed script or add via API.</p>
          )}
        </div>
      )}
    </div>
  );
}
