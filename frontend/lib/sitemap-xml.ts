export type SitemapUrlEntry = {
  loc: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
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

    out.push({
      loc,
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority,
    });
  }

  return out;
}

export function buildUrlSetXml(entries: SitemapUrlEntry[]): string {
  const valid = normalizeSitemapEntries(entries);
  const urls = valid
    .map((entry) => {
      const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
      const lastmod = safeLastmod(entry.lastModified ?? null);
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      if (entry.changeFrequency) parts.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
      if (entry.priority !== undefined) parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      parts.push(`  </url>`);
      return parts.join("\n");
    })
    .join("\n");

  // Always emit a well-formed urlset. Callers should supply fallbacks so this is rarely empty.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
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
