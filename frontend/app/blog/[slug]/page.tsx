import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogPostContent } from "@/components/blog/blog-post-content";
import { TrackBlogView } from "@/components/blog/track-blog-view";
import { buildFaqJsonLd, extractBlogFaqs } from "@/lib/blog-faq-schema";
import { fetchBlogPostSafe } from "@/lib/server-api";
import { normalizeSeoTitle } from "@/lib/seo-metadata";

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 120;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchBlogPostSafe(slug);
  if (!post) {
    return { title: "Post Not Found", robots: { index: false, follow: false } };
  }

  const canonical = `https://kigalirent.com/blog/${slug}`;
  const title = normalizeSeoTitle(post.meta_title || post.title);
  const description =
    post.meta_description?.trim() ||
    post.excerpt?.trim() ||
    `${post.title} — insights on renting and property in Kigali from Kigali Rent.`;
  const images = post.featured_image
    ? [{ url: post.featured_image, width: 1200, height: 630, alt: post.title }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      siteName: "Kigali Rent",
      locale: "en_RW",
      images,
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchBlogPostSafe(slug);
  if (!post) notFound();

  const faqJsonLd = buildFaqJsonLd(extractBlogFaqs(post.content, post.content_format));
  const canonical = `https://kigalirent.com/blog/${slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${canonical}#article`,
    mainEntityOfPage: canonical,
    url: canonical,
    headline: post.title,
    description: post.meta_description?.trim() || post.excerpt?.trim() || undefined,
    image: post.featured_image || undefined,
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    author: { "@id": "https://kigalirent.com/#organization", "@type": "Organization", name: "Kigali Rent" },
    publisher: { "@id": "https://kigalirent.com/#organization" },
    articleSection: post.category_name || undefined,
    keywords: post.tags?.length ? post.tags.join(", ") : undefined,
    inLanguage: "en",
    about: { "@type": "City", name: "Kigali", containedInPlace: { "@type": "Country", name: "Rwanda" } },
  };
  const publishedLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <article className="py-20 px-6">
      <TrackBlogView slug={slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
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
        {publishedLabel && post.published_at && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            By Kigali Rent · Published <time dateTime={post.published_at}>{publishedLabel}</time>
          </p>
        )}
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mb-8">
          {post.title}
        </h1>
        {post.excerpt?.trim() && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">{post.excerpt}</p>
        )}
        {post.featured_image && (
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-10">
            <Image src={post.featured_image} alt={post.title} fill className="object-cover" priority />
          </div>
        )}
        <BlogPostContent content={post.content} contentFormat={post.content_format} />
        <nav
          className="mt-10 pt-8 border-t text-sm flex flex-wrap gap-x-3 gap-y-2 text-gray-600 dark:text-gray-400"
          aria-label="Related Kigali Rent resources"
        >
          <Link href="/rentals" className="text-gold-600 hover:underline">
            Browse Kigali rentals
          </Link>
          <span className="text-gray-400" aria-hidden>
            ·
          </span>
          <Link href="/research/kigali-rental-market" className="text-gold-600 hover:underline">
            Kigali rental market research
          </Link>
          <span className="text-gray-400" aria-hidden>
            ·
          </span>
          <Link href="/area" className="text-gold-600 hover:underline">
            Kigali neighbourhood guides
          </Link>
        </nav>
        {post.tags?.length ? (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t">
            {post.tags.map((tag: string) => (
              <span key={tag} className="px-3 py-1 bg-cream dark:bg-secondary rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
