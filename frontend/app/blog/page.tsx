import type { Metadata } from "next";
import Link from "next/link";
import { fetchBlogPostsSafe } from "@/lib/server-api";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog",
  description: "Real estate insights and guides for Kigali.",
};

export default async function BlogPage() {
  const posts = await fetchBlogPostsSafe();

  return (
    <div className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">INSIGHTS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3">Blog</h1>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group">
              <h2 className="font-serif text-xl font-bold group-hover:text-gold-500 transition">{post.title}</h2>
              <p className="text-gray-500 text-sm mt-2">{post.excerpt}</p>
            </Link>
          ))}
        </div>
        {posts.length === 0 && (
          <p className="text-center text-gray-500">No blog posts yet.</p>
        )}
      </div>
    </div>
  );
}
