import Link from "next/link";

const UNLINKED_SOURCE_HOSTS = ["houseinrwanda.com", "kigaliproperty.com"];

function sourceNameOnly(sourceUrl?: string | null, sourceKey?: string): boolean {
  if (sourceKey === "house_in_rwanda" || sourceKey === "kigali_property") return true;
  if (!sourceUrl) return false;
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return UNLINKED_SOURCE_HOSTS.includes(host);
  } catch {
    return UNLINKED_SOURCE_HOSTS.some((host) => sourceUrl.includes(host));
  }
}

export type ResearchTransparencyData = {
  last_updated_display?: string | null;
  total_count?: number;
  verified_count?: number;
  external_count?: number;
  combined_summary?: string;
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

export type AboutThisData = {
  observation_count?: number;
  period_start?: string | null;
  period_end?: string | null;
  last_updated?: string | null;
  last_updated_display?: string | null;
  methodology_summary?: string;
  limitations?: string[];
  provenance_note?: string;
  sources_url?: string;
  methodology_url?: string;
};

/** Compact public “About this data” — no competing source rates. */
export function AboutThisDataBlock({ about }: { about: AboutThisData | null | undefined }) {
  if (!about) return null;
  return (
    <section className="rounded-2xl border p-6 bg-white dark:bg-navy-800 space-y-3">
      <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white">About this data</h2>
      <dl className="grid sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Observations</dt>
          <dd className="text-xl font-serif">{about.observation_count ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Updated</dt>
          <dd className="text-lg font-serif">{about.last_updated_display || about.last_updated || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Period</dt>
          <dd className="text-sm">
            {about.period_start && about.period_end
              ? `${about.period_start} → ${about.period_end}`
              : about.period_end || "—"}
          </dd>
        </div>
      </dl>
      {about.methodology_summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{about.methodology_summary}</p>
      )}
      {(about.limitations?.length || 0) > 0 && (
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
          {about.limitations!.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500">
        <Link href={about.methodology_url || "/research/kigali-rental-market/methodology"} className="underline">
          Data sources &amp; methodology
        </Link>
      </p>
    </section>
  );
}

/** Discreet methodology page section — sources listed for transparency only. */
export function ResearchTransparency({
  data,
  compact = false,
}: {
  data: ResearchTransparencyData | null | undefined;
  compact?: boolean;
}) {
  if (!data) return null;

  const sources = (data.sources || []).filter((s) => (s.observation_count || 0) > 0);

  return (
    <section className={`rounded-2xl border bg-white dark:bg-navy-800 ${compact ? "p-4" : "p-6"} space-y-4`}>
      <div>
        <h2 className={`font-serif font-bold text-navy-800 dark:text-white ${compact ? "text-lg" : "text-xl"}`}>
          Data sources &amp; methodology
        </h2>
        {data.last_updated_display && (
          <p className="text-sm text-gray-500 mt-1">Updated {data.last_updated_display}</p>
        )}
      </div>

      {data.combined_summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.combined_summary}</p>
      )}

      <p className="text-sm text-gray-600">
        Eligible observations are combined into one market estimate after normalization, deduplication,
        and outlier screening. Source streams remain separated only for internal quality control.
      </p>

      {sources.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-navy-800 dark:text-white mb-2">Contributing sources</h3>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
            {sources.map((s) => (
              <li key={s.source_key || s.name}>
                {s.source_url && !sourceNameOnly(s.source_url, s.source_key) ? (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="underline">
                    {s.name}
                  </a>
                ) : (
                  <span>{s.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (data.limitations?.length || 0) > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Limitations</h3>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
            {data.limitations!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
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
            <a href={canonicalUrl} className="underline break-all">
              {canonicalUrl}
            </a>
          </dd>
        </div>
      </dl>
      {citationText && (
        <blockquote className="text-xs text-gray-600 dark:text-gray-300 border-l-2 border-navy-300 pl-3 italic">
          {citationText}
        </blockquote>
      )}
    </section>
  );
}
