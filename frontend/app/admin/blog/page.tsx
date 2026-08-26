"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Shimmer, TableSkeleton } from "@/components/ui/shimmer";
import { ImageUrlOrUpload } from "@/components/admin/image-url-or-upload";
import type { BlogPost } from "@/types";
import { formatDateTime } from "@/lib/utils";
import {
  clearAdminDraft,
  draftHasContent,
  formatDraftSavedAt,
  loadAdminDraft,
  saveAdminDraft,
} from "@/lib/admin-drafts";

const BlogRichTextEditor = dynamic(
  () => import("@/components/admin/blog-rich-text-editor").then((m) => m.BlogRichTextEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[240px] rounded-lg border bg-gray-50 dark:bg-navy-900 animate-pulse" aria-hidden />,
  },
);
function blogDraftKey(postId?: string | null) {
  return postId ? `blog:${postId}` : "blog:new";
}

interface BlogFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  content_format: string;
  featured_image: string;
  meta_title: string;
  meta_description: string;
  read_time_minutes: number;
  status: string;
  is_featured: boolean;
}

const emptyForm: BlogFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  content_format: "html",
  featured_image: "",
  meta_title: "",
  meta_description: "",
  read_time_minutes: 5,
  status: "draft",
  is_featured: false,
};

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogFormState>(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const skipNextDraftSave = useRef(false);
  const draftKey = blogDraftKey(editingId);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog"],
    queryFn: adminService.blogPosts,
  });

  const { data: editingPost, isLoading: loadingPost } = useQuery({
    queryKey: ["admin-blog-post", editingId],
    queryFn: () => adminService.blogPost(editingId!),
    enabled: !!editingId,
  });

  useEffect(() => {
    skipNextDraftSave.current = true;
    setDraftNotice(null);

    if (editingId && !editingPost) return;

    const serverForm: BlogFormState | null = editingPost
      ? {
          title: editingPost.title || "",
          slug: editingPost.slug || "",
          excerpt: editingPost.excerpt || "",
          content: editingPost.content || "",
          content_format: editingPost.content_format || "html",
          featured_image: editingPost.featured_image || "",
          meta_title: editingPost.meta_title || "",
          meta_description: editingPost.meta_description || "",
          read_time_minutes: editingPost.read_time_minutes || 5,
          status: editingPost.status || (editingPost.is_published ? "published" : "draft"),
          is_featured: editingPost.is_featured ?? false,
        }
      : null;

    const draft = loadAdminDraft<BlogFormState>(draftKey);
    if (draft && draftHasContent(draft.data)) {
      setForm({ ...emptyForm, ...draft.data });
      setDraftNotice(`Unsaved draft restored (saved ${formatDraftSavedAt(draft.savedAt)}).`);
      return;
    }

    if (serverForm) {
      setForm(serverForm);
    } else if (!editingId) {
      setForm(emptyForm);
    }
  }, [editingPost, editingId, draftKey]);

  useEffect(() => {
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (!draftHasContent(form)) {
        clearAdminDraft(draftKey);
        return;
      }
      saveAdminDraft(draftKey, form);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [form, draftKey]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSaveError(null);
    setDraftNotice(null);
    skipNextDraftSave.current = true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || undefined,
        featured_image: form.featured_image.trim() || undefined,
        meta_title: form.meta_title.trim() || undefined,
        meta_description: form.meta_description.trim() || undefined,
        read_time_minutes: form.read_time_minutes || estimateReadTime(form.content),
      };
      if (editingId) {
        return adminService.updateBlogPost(editingId, payload);
      }
      return adminService.createBlogPost(payload);
    },
    onSuccess: () => {
      clearAdminDraft(draftKey);
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      resetForm();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(typeof detail === "string" ? detail : "Failed to save post");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blog"] });
      if (editingId) resetForm();
    },
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
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Blog Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Informational articles about the Kigali real estate market — optimized for SEO and brand awareness.
          </p>
        </div>
        <Button className="rounded-full gap-2" onClick={resetForm}>
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-card rounded-xl border p-6 space-y-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
          <h3 className="font-semibold">{editingId ? "Edit Post" : "Create Post"}</h3>

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

          {loadingPost && editingId ? (
            <Shimmer className="h-40 w-full" />
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</label>
                <input
                  className="lux-input mt-1"
                  placeholder="e.g. Understanding Kigali's rental market in 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">URL slug (SEO)</label>
                <input
                  className="lux-input mt-1"
                  placeholder="auto-generated from title if empty"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>

              <ImageUrlOrUpload
                label="Featured image"
                hint="Hero image for the article and social previews. Paste an image URL."
                folder="kigalifinders/blog"
                allowUpload={false}
                value={form.featured_image}
                onChange={(url) => setForm({ ...form, featured_image: url })}
                previewClassName="h-32 w-full rounded-lg object-cover border"
              />

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Excerpt</label>
                <p className="text-xs text-gray-400 mb-1">Short summary for blog cards and search snippets (150–160 chars ideal).</p>
                <textarea
                  className="lux-input min-h-[72px]"
                  placeholder="A concise intro that hooks readers and supports SEO..."
                  value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Article content</label>
                <p className="text-xs text-gray-400">
                  Paste Markdown, HTML, or rich text — tables, headings, links, and lists are converted automatically.
                  Use Preview to see exactly how the article will appear.
                </p>
                <BlogRichTextEditor
                  value={form.content}
                  contentFormat={form.content_format}
                  onChange={(html) => {
                    const readTime = estimateReadTime(html);
                    setForm((prev) => ({
                      ...prev,
                      content: html,
                      content_format: "html",
                      read_time_minutes: readTime,
                    }));
                  }}
                  placeholder="Write an informative article about Kigali real estate — market trends, neighborhoods, buying tips..."
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta title (SEO)</label>
                  <input
                    className="lux-input mt-1"
                    placeholder="Page title for Google (≤60 chars)"
                    value={form.meta_title}
                    onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Read time (min)</label>
                  <input
                    type="number"
                    min={1}
                    className="lux-input mt-1"
                    value={form.read_time_minutes}
                    onChange={(e) => setForm({ ...form, read_time_minutes: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meta description (SEO)</label>
                  <textarea
                    className="lux-input min-h-[72px] mt-1"
                    placeholder="Search result description (≤160 chars)"
                    value={form.meta_description}
                    onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                  <select
                    className="lux-input mt-1"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_featured}
                      onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                    />
                    Featured on homepage
                  </label>
                </div>
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              <div className="flex gap-3">
                <Button
                  className="rounded-full"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !form.title.trim() || !form.content.trim()}
                >
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update Post" : "Create Post"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-800 border-b">
              <tr>
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Published</th>
                <th className="text-left p-4">Created</th>
                <th className="text-right p-4">Views</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(posts as BlogPost[]).map((post) => (
                <tr key={post.id} className="border-b">
                  <td className="p-4">
                    {post.slug && post.status === "published" ? (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1.5 font-medium hover:text-gold-500 transition"
                      >
                        <span>{post.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 mt-0.5 opacity-0 group-hover:opacity-100 transition shrink-0" />
                      </Link>
                    ) : (
                      <div className="font-medium">{post.title}</div>
                    )}
                    {post.slug && <div className="text-xs text-gray-400 mt-0.5">/blog/{post.slug}</div>}
                  </td>
                  <td className="p-4 capitalize">{post.status || (post.is_published ? "published" : "draft")}</td>
                  <td className="p-4 text-gray-500 text-sm">
                    {post.published_at ? formatDateTime(post.published_at) : "—"}
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {post.created_at ? formatDateTime(post.created_at) : "—"}
                  </td>
                  <td className="p-4 text-right text-gray-600">{(post.views_count ?? 0).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg"
                        onClick={() => {
                          setEditingId(post.id);
                          setSaveError(null);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        onClick={() => deleteMutation.mutate(post.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <p className="p-6 text-center text-gray-500 text-sm">No blog posts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
