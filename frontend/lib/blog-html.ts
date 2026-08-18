import sanitizeHtml from "sanitize-html";
import { isRichHtml } from "@/lib/sanitize-html";
import { looksLikeMarkdown, markdownToHtml } from "@/lib/markdown-to-html";

const BLOG_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "span",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "div",
];

const BLOG_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  table: ["class"],
  div: ["class"],
  "*": ["class"],
};

function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  return /^(https?:|mailto:)/i.test(value);
}

function isSafeImgSrc(src: string): boolean {
  const value = src.trim();
  if (!value) return false;
  if (value.startsWith("/")) return true;
  return /^https?:/i.test(value);
}

/** Normalize blog content to HTML (legacy markdown posts stay readable). */
export function blogContentToHtml(content: string, contentFormat?: string): string {
  if (!content?.trim()) return "";
  if (contentFormat === "markdown" || (!isRichHtml(content) && looksLikeMarkdown(content))) {
    return markdownToHtml(content);
  }
  return content;
}

/** Sanitize blog HTML while preserving tables, images, blockquotes, and internal links. */
export function sanitizeBlogHtml(html: string): string {
  let out = sanitizeHtml(html, {
    allowedTags: BLOG_ALLOWED_TAGS,
    allowedAttributes: BLOG_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        if (!isSafeHref(href)) {
          return { tagName: "span", attribs: {} };
        }
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            href,
            class: "text-gold-600 underline hover:text-gold-500",
            ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          },
        };
      },
      img: (_tagName, attribs) => {
        const src = attribs.src || "";
        if (!isSafeImgSrc(src)) {
          return { tagName: "span", attribs: {} as Record<string, string> };
        }
        return {
          tagName: "img",
          attribs: {
            src,
            alt: attribs.alt || "",
            loading: "lazy",
            class: "rounded-lg max-w-full h-auto my-4",
          },
        };
      },
      table: () => ({
        tagName: "table",
        attribs: { class: "blog-table" },
      }),
    },
  });

  out = out.replace(
    /<table class="blog-table"/g,
    '<div class="blog-table-scroll"><table class="blog-table"'
  );
  out = out.replace(/<\/table>/g, "</table></div>");

  return out;
}

/** Prepare blog content for public display. */
export function renderBlogContent(content: string, contentFormat?: string): string {
  const html = blogContentToHtml(content, contentFormat);
  return sanitizeBlogHtml(html);
}
