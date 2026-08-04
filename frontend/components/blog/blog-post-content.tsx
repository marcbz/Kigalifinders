import { isRichHtml, sanitizePropertyHtml } from "@/lib/sanitize-html";

interface BlogPostContentProps {
  content?: string | null;
  contentFormat?: string;
}

export function BlogPostContent({ content, contentFormat = "html" }: BlogPostContentProps) {
  if (!content?.trim()) {
    return <p className="text-gray-500 dark:text-gray-400">No content yet.</p>;
  }

  const isHtml = contentFormat === "html" || isRichHtml(content);

  if (!isHtml) {
    return (
      <div className="property-description text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
        {content}
      </div>
    );
  }

  const sanitized = sanitizePropertyHtml(content);

  return (
    <div
      className="property-description text-gray-600 dark:text-gray-400 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
