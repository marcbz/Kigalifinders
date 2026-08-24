import Link from "next/link";

export type ResearchTransparencyData = {
  last_updated_display?: string | null;
  total_count?: number;
  verified_count?: number;
  external_count?: number;
  combined_summary?: string;
  verified_label?: string;
  external_label?: string;
  sources?: {
    name: string;
    source_key?: string;
    observation_count?: number;
    source_url?: string | null;
    kind?: string;
  }[];
  limitations?: string[];
  methodology_url?: string;
  sources_url?: string;
  citation_text?: string;
  import_batches?: {
    reference: string;
    imported_at: string;
    rows_processed: number;
    sources?: string[];
  }[];
};

export function ResearchTransparency({
  data,
  compact = false,
}: {
  data: ResearchTransparencyData | null | undefined;
  compact?: boolean;
}) {
  if (!data) return null;

  const sources = (data.sources || []).filter((s) => s.kind !== "verified_kigali_rent" && (s.observation_count || 0) > 0);

  return (
    <section className={`rounded-2xl border bg-white dark:bg-navy-800 ${compact ? "p-4" : "p-6"} space-y-4`}>
      <div>
        <h2 className={`font-serif font-bold text-navy-800 dark:text-white ${compact ? "text-lg" : "text-xl"}`}>
          Research transparency
        </h2>
        {data.last_updated_display && (
          <p className="text-sm text-gray-500 mt-1">Updated {data.last_updated_display}</p>
        )}
      </div>

      {data.combined_summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.combined_summary}</p>
      )}

      <dl className={`grid gap-3 text-sm ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
        <div>
          <dt className="text-gray-500">Total data points</dt>
          <dd className="text-xl font-serif">{data.total_count ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{data.verified_label || "KigaliRent Verified"}</dt>
          <dd className="text-xl font-serif">{data.verified_count ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">{data.external_label || "External observations"}</dt>
          <dd className="text-xl font-serif">{data.external_count ?? "—"}</dd>
        </div>
      </dl>

      {sources.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-navy-800 dark:text-white mb-2">External sources</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {sources.map((s) => (
              <li key={s.source_key || s.name}>
                {s.source_url ? (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="text-gold-600 underline">
                    {s.name}
                  </a>
                ) : (
                  <span>{s.name}</span>
                )}
                {s.observation_count != null ? ` (${s.observation_count})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (data.limitations?.length || 0) > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Data limitations</h3>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
            {data.limitations!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        <Link href={data.methodology_url || "/research/kigali-rental-market/methodology"} className="underline">
          Methodology
        </Link>
        {" · "}
        <Link href={data.sources_url || "/research/kigali-rental-market/sources"} className="underline">
          All sources
        </Link>
      </p>
    </section>
  );
}

export function CiteThisResearch({
  title,
  citationText,
  canonicalUrl,
  lastUpdated,
}: {
  title: string;
  citationText?: string;
  canonicalUrl: string;
  lastUpdated?: string | null;
}) {
  return (
    <section className="rounded-2xl border border-dashed p-6 bg-white dark:bg-navy-800 space-y-3">
      <h2 className="font-serif text-lg font-bold text-navy-800 dark:text-white">Cite this research</h2>
      <dl className="text-sm space-y-2">
        <div>
          <dt className="text-gray-500">Title</dt>
          <dd>{title}</dd>
        </div>
        {lastUpdated && (
          <div>
            <dt className="text-gray-500">Last updated</dt>
            <dd>{lastUpdated}</dd>
          </div>
        )}
        <div>
          <dt className="text-gray-500">URL</dt>
          <dd>
            <a href={canonicalUrl} className="text-gold-600 underline break-all">
              {canonicalUrl}
            </a>
          </dd>
        </div>
      </dl>
      {citationText && (
        <blockquote className="text-xs text-gray-600 dark:text-gray-300 border-l-2 border-gold-500 pl-3 italic">
          {citationText}
        </blockquote>
      )}
    </section>
  );
}
