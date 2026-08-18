import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Detect pasted or stored plain-text Markdown (not already HTML). */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/<\/?(?:p|div|table|h[1-6]|ul|ol|blockquote|img|a)\b/i.test(trimmed)) return false;

  return /(^|\n)(#{1,6}\s|\*\*[^*]+\*\*|__[^_]+__|\|[^\n]+\|[^\n]+\||^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\))/m.test(
    trimmed
  );
}

/** Convert Markdown to HTML without altering the underlying text content. */
export function markdownToHtml(markdown: string): string {
  if (!markdown?.trim()) return "";
  const html = marked.parse(markdown, { async: false }) as string;
  return html.trim();
}
