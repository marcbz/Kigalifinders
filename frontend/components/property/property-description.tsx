import DOMPurify from "isomorphic-dompurify";

interface PropertyDescriptionProps {
  content?: string | null;
}

function isRichHtml(text: string): boolean {
  return /<(p|br|strong|em|a|h\d|ul|ol|li|span)\b/i.test(text);
}

export function PropertyDescription({ content }: PropertyDescriptionProps) {
  if (!content?.trim()) {
    return <p className="text-gray-500 dark:text-gray-400">No description provided.</p>;
  }

  if (!isRichHtml(content)) {
    return (
      <div className="property-description text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
        {content}
      </div>
    );
  }

  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "a", "ul", "ol", "li", "h2", "h3", "span", "s"],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  });

  return (
    <div
      className="property-description text-gray-600 dark:text-gray-400 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
