import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contentService } from "@/services/api";
import { BlogPostContent } from "@/components/blog/blog-post-content";
import { TrackBlogView } from "@/components/blog/track-blog-view";
import { buildFaqJsonLd, extractBlogFaqs } from "@/lib/blog-faq-schema";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await contentService.blogPost(slug);
    return {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
    };
  } catch {
    return { title: "Post Not Found" };
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  let post;
  try {
    post = await contentService.blogPost(slug);
  } catch {
    notFound();
  }

  const faqJsonLd = buildFaqJsonLd(extractBlogFaqs(post.content, post.content_format));

  return (
    <article className="py-20 px-6">
      <TrackBlogView slug={slug} />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <div className="max-w-3xl mx-auto">
        <Link href="/blog" className="text-gold-500 text-sm mb-6 inline-block hover:underline">
          ← Back to Blog
        </Link>
        <div className="text-xs text-gold-500 tracking-widest mb-4">
          {post.category_name?.toUpperCase()} · {post.read_time_minutes} MIN READ
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mb-8">
          {post.title}
        </h1>
        {post.featured_image && (
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-10">
            <Image src={post.featured_image} alt={post.title} fill className="object-cover" priority />
          </div>
        )}
        <BlogPostContent content={post.content} contentFormat={post.content_format} />
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t">
            {post.tags.map((tag: string) => (
              <span key={tag} className="px-3 py-1 bg-cream dark:bg-secondary rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
