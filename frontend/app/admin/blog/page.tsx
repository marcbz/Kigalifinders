"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Shimmer, TableSkeleton } from "@/components/ui/shimmer";

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    featured_image: "",
    is_published: false,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: adminService.blogPosts,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing?.id) {
        return adminService.updateBlogPost(editing.id as string, form);
      }
      return adminService.createBlogPost(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      setEditing(null);
      setForm({ title: "", excerpt: "", content: "", featured_image: "", is_published: false });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteBlogPost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blog"] }),
  });

  if (isLoading) {
    return (
      <div>
        <Shimmer className="h-8 w-48 mb-6" />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Blog Management</h2>
        <Button className="rounded-full gap-2" onClick={() => { setEditing(null); setForm({ title: "", excerpt: "", content: "", featured_image: "", is_published: false }); }}>
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-card rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold">{editing ? "Edit Post" : "Create Post"}</h3>
          <input className="lux-input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="lux-input" placeholder="Featured image URL" value={form.featured_image} onChange={(e) => setForm({ ...form, featured_image: e.target.value })} />
          <input className="lux-input" placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          <textarea className="lux-input min-h-[160px]" placeholder="Content (markdown)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
            Published
          </label>
          <Button className="rounded-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : editing ? "Update Post" : "Create Post"}
          </Button>
        </div>

        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-800 border-b">
              <tr>
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(posts as { id: string; title: string; is_published?: boolean }[]).map((post) => (
                <tr key={post.id} className="border-b">
                  <td className="p-4">{post.title}</td>
                  <td className="p-4 capitalize">{post.is_published ? "published" : "draft"}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button type="button" className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => setEditing(post)}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => deleteMutation.mutate(post.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
