import { renderBlogContent } from "@/lib/blog-html";

interface PropertyDescriptionProps {
  content?: string | null;
}

export function PropertyDescription({ content }: PropertyDescriptionProps) {
  if (!content?.trim()) {
    return <p className="text-gray-500 dark:text-gray-400">No description provided.</p>;
  }

  const sanitized = renderBlogContent(content);

  return (
    <div
      className="property-description text-gray-600 dark:text-gray-400 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
