const ALLOWED_TAG_PATTERN =
  /<\/?(?:p|br|strong|b|em|i|a|ul|ol|li|h2|h3|span|s)(?:\s[^>]*)?>/gi;

export function isRichHtml(text: string): boolean {
  return /<(p|br|strong|em|a|h\d|ul|ol|li|span)\b/i.test(text);
}

/** Strip dangerous markup while keeping basic formatting tags from the admin editor. */
export function sanitizePropertyHtml(html: string): string {
  let out = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
    const lower = name.toLowerCase();
    const allowed = ["p", "br", "strong", "b", "em", "i", "a", "ul", "ol", "li", "h2", "h3", "span", "s"];
    if (!allowed.includes(lower)) return "";

    if (lower === "a") {
      const hrefMatch = tag.match(/\shref=("([^"]*)"|'([^']*)')/i);
      const href = hrefMatch?.[2] || hrefMatch?.[3] || "";
      if (href && !/^(https?:|mailto:)/i.test(href)) return "";
      const isClose = /^<\//.test(tag);
      if (isClose) return "</a>";
      return ` rel="noopener noreferrer" target="_blank" href="${href.replace(/"/g, "&quot;")}">`;
    }

    return tag.match(/^<\//) ? `</${lower}>` : `<${lower}>`;
  });

  return out;
}
