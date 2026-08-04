import sanitizeHtml from "sanitize-html";

const PROPERTY_DESCRIPTION_OPTIONS = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "a", "ul", "ol", "li", "h2", "h3", "span", "s"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["style", "class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
};

export function sanitizePropertyHtml(html: string): string {
  return sanitizeHtml(html, PROPERTY_DESCRIPTION_OPTIONS);
}

export function isRichHtml(text: string): boolean {
  return /<(p|br|strong|em|a|h\d|ul|ol|li|span)\b/i.test(text);
}
