import { blogContentToHtml } from "@/lib/blog-html";

export type FaqPair = { question: string; answer: string };

/** Extract FAQ Q&A pairs from article HTML/Markdown for Google FAQ schema. */
export function extractBlogFaqs(content?: string | null, contentFormat?: string): FaqPair[] {
  if (!content?.trim()) return [];
  const html = blogContentToHtml(content, contentFormat);
  const lower = html.toLowerCase();
  const faqIdx = lower.search(/frequently asked questions|faqs?\b/);
  if (faqIdx < 0) return [];

  const section = html.slice(faqIdx);
  const pairs: FaqPair[] = [];
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;
  const headings: { q: string; index: number; end: number }[] = [];

  while ((match = h3Regex.exec(section)) !== null) {
    const q = stripTags(match[1]).trim();
    if (q) headings.push({ q, index: match.index, end: match.index + match[0].length });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].end;
    const end = i + 1 < headings.length ? headings[i + 1].index : section.length;
    const chunk = section.slice(start, end);
    const pMatch = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const answer = stripTags(pMatch?.[1] || chunk).trim();
    if (headings[i].q && answer) {
      pairs.push({ question: headings[i].q, answer });
    }
  }

  return pairs.slice(0, 12);
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildFaqJsonLd(faqs: FaqPair[]) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
