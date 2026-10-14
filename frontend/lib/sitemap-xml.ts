export type SitemapImageEntry = {
  loc: string;
  title?: string;
  caption?: string;
};

export type SitemapUrlEntry = {
  loc: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  /** Google image sitemap extension — listing photos for SERP image packs. */
  images?: SitemapImageEntry[];
};

export type SitemapIndexEntry = {
  loc: string;
  lastModified?: Date;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Absolute http(s) URL suitable for <loc>. */
export function isValidSitemapLoc(loc: unknown): loc is string {
  if (typeof loc !== "string") return false;
  const value = loc.trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Require a host and a non-empty pathname root at minimum
    if (!url.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

export function safeLastmod(value?: Date | string | null): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeSitemapEntries(entries: SitemapUrlEntry[]): SitemapUrlEntry[] {
  const seen = new Set<string>();
  const out: SitemapUrlEntry[] = [];

  for (const entry of entries) {
    const loc = typeof entry.loc === "string" ? entry.loc.trim() : "";
    if (!isValidSitemapLoc(loc)) continue;
    // Prefer https host paths without trailing junk duplicates
    const key = loc.replace(/\/$/, "") || loc;
    if (seen.has(key)) continue;
    seen.add(key);

    const lastModified =
      entry.lastModified instanceof Date && !Number.isNaN(entry.lastModified.getTime())
        ? entry.lastModified
        : undefined;

    const priority =
      typeof entry.priority === "number" && Number.isFinite(entry.priority)
        ? Math.min(1, Math.max(0, entry.priority))
        : undefined;

    const images: SitemapImageEntry[] = [];
    for (const img of entry.images || []) {
      const imgLoc = typeof img.loc === "string" ? img.loc.trim() : "";
      if (!isValidSitemapLoc(imgLoc)) continue;
      images.push({
        loc: imgLoc,
        title: img.title?.trim() || undefined,
        caption: img.caption?.trim() || undefined,
      });
      if (images.length >= 10) break;
    }

    out.push({
      loc,
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority,
      ...(images.length ? { images } : {}),
    });
  }

  return out;
}

export function buildUrlSetXml(entries: SitemapUrlEntry[]): string {
  const valid = normalizeSitemapEntries(entries);
  const hasImages = valid.some((entry) => (entry.images?.length || 0) > 0);
  const urls = valid
    .map((entry) => {
      const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
      const lastmod = safeLastmod(entry.lastModified ?? null);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (entry.changeFrequency) parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
      if (entry.priority !== undefined) parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      for (const img of entry.images || []) {
        parts.push(`    <image:image>`);
        parts.push(`      <image:loc>${escapeXml(img.loc)}</image:loc>`);
        if (img.title) parts.push(`      <image:title>${escapeXml(img.title)}</image:title>`);
        if (img.caption) parts.push(`      <image:caption>${escapeXml(img.caption)}</image:caption>`);
        parts.push(`    </image:image>`);
      }
      parts.push(`  </url>`);
      return parts.join("\n");
    })
    .join("\n");

  // Always emit a well-formed urlset. Callers should supply fallbacks so this is rarely empty.
  const imageNs = hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>${
    urls ? `\n${urls}\n` : "\n"
  }</urlset>`;
}

export function buildSitemapIndexXml(entries: SitemapIndexEntry[]): string {
  const seen = new Set<string>();
  const sitemaps = entries
    .map((entry) => {
      const loc = typeof entry.loc === "string" ? entry.loc.trim() : "";
      if (!isValidSitemapLoc(loc) || seen.has(loc)) return null;
      seen.add(loc);
      const parts = [`  <sitemap>`, `    <loc>${escapeXml(loc)}</loc>`];
      const lastmod = safeLastmod(entry.lastModified ?? null);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      parts.push(`  </sitemap>`);
      return parts.join("\n");
    })
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    sitemaps ? `\n${sitemaps}\n` : "\n"
  }</sitemapindex>`;
}

export function xmlResponse(
  body: string,
  options?: { cacheControl?: string; status?: number; headers?: Record<string, string> },
): Response {
  return new Response(body, {
    status: options?.status ?? 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        options?.cacheControl || "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      ...(options?.headers || {}),
    },
  });
}
