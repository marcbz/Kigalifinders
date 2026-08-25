import { ResearchChart } from "@/components/research/research-charts";

type Answer = {
  question?: string;
  headline?: string | null;
  has_enough_data?: boolean;
  summary?: string;
  range_text?: string | null;
  plain_english?: string | null;
  sample_size?: number;
  last_updated_display?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  asking_rent_note?: string;
  typical_usd?: number | null;
  p25_usd?: number | null;
  p75_usd?: number | null;
};

type Sections = {
  what_the_data_shows?: string[];
  how_to_interpret?: string[];
  methodology?: string[];
  limitations?: string[];
  last_updated?: string | null;
  last_updated_display?: string | null;
  observation_period?: string | null;
  number_of_observations?: number;
  sources_url?: string;
  methodology_url?: string;
};

export function MarketAnswerBlock({ answer }: { answer?: Answer | null }) {
  if (!answer) return null;
  return (
    <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6 md:p-8 space-y-3">
      <h2 className="font-serif text-2xl md:text-3xl font-bold text-navy-800 dark:text-white">
        {answer.question || "Typical asking rent"}
      </h2>
      {answer.has_enough_data ? (
        <>
          <p className="text-3xl md:text-4xl font-serif text-navy-800 dark:text-white">{answer.headline}</p>
          {answer.range_text && <p className="text-sm text-gray-600 dark:text-gray-300">{answer.range_text}</p>}
          {answer.plain_english && (
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{answer.plain_english}</p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300">{answer.summary}</p>
          <dl className="grid sm:grid-cols-3 gap-3 text-xs text-gray-500 pt-2">
            <div>
              <dt>Observations</dt>
              <dd className="text-sm text-navy-800 dark:text-white font-medium">{answer.sample_size ?? "—"}</dd>
            </div>
            <div>
              <dt>Observation period</dt>
              <dd className="text-sm text-navy-800 dark:text-white font-medium">
                {answer.period_start && answer.period_end
                  ? `${answer.period_start} → ${answer.period_end}`
                  : answer.period_end || "—"}
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd className="text-sm text-navy-800 dark:text-white font-medium">
                {answer.last_updated_display || "—"}
              </dd>
            </div>
          </dl>
          {answer.asking_rent_note && <p className="text-xs text-gray-500">{answer.asking_rent_note}</p>}
        </>
      ) : (
        <p className="text-gray-600">{answer.summary || "Not enough data to provide a reliable estimate yet."}</p>
      )}
    </section>
  );
}

export function ResearchNarrativeSections({ sections }: { sections?: Sections | null }) {
  if (!sections) return null;
  return (
    <div className="space-y-6">
      {(sections.what_the_data_shows?.length || 0) > 0 && (
        <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
          <h2 className="font-serif text-xl font-bold mb-3">What the data shows</h2>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc pl-5">
            {sections.what_the_data_shows!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {(sections.how_to_interpret?.length || 0) > 0 && (
        <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
          <h2 className="font-serif text-xl font-bold mb-3">How to interpret this data</h2>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc pl-5">
            {sections.how_to_interpret!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6 grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="font-serif text-xl font-bold mb-2">Methodology</h2>
          <ul className="text-gray-700 dark:text-gray-300 space-y-2 list-disc pl-5">
            {(sections.methodology || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold mb-2">Limitations</h2>
          <ul className="text-gray-700 dark:text-gray-300 space-y-2 list-disc pl-5">
            {(sections.limitations || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-gray-500">Number of observations</p>
          <p className="font-medium">{sections.number_of_observations ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">Observation period</p>
          <p className="font-medium">{sections.observation_period || "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">Last updated</p>
          <p className="font-medium">{sections.last_updated_display || sections.last_updated || "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">Sources</p>
          <p className="font-medium">
            <a href={sections.sources_url || "/research/kigali-rental-market/methodology"} className="underline text-gold-600">
              Methodology &amp; sources
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

export function BudgetBandsTable({
  bands,
}: {
  bands?: { label: string; count: number; share_pct: number; sample_size: number }[];
}) {
  if (!bands?.length) return null;
  return (
    <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
      <h2 className="font-serif text-xl font-bold mb-3">Budget analysis</h2>
      <p className="text-xs text-gray-500 mb-4">
        Share of screened asking rents by budget band (n={bands[0]?.sample_size}).
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-2">Budget band</th>
            <th className="py-2">Observations</th>
            <th className="py-2">Share</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.label} className="border-t">
              <td className="py-2">{b.label}</td>
              <td className="py-2">{b.count}</td>
              <td className="py-2">{b.share_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function CombinedTrendChart({
  trend,
  hasHistory,
}: {
  trend?: { label?: string; period_end?: string; median_usd?: number; sample_size?: number; pct_change?: number | null }[];
  hasHistory?: boolean;
}) {
  return (
    <ResearchChart
      title="Asking rent over time"
      subtitle="Combined eligible observations · USD/month"
      kind="line"
      points={
        hasHistory
          ? (trend || [])
              .filter((t) => t.median_usd != null)
              .map((t) => ({
                label: (t.label || t.period_end || "").slice(0, 7),
                value: t.median_usd || 0,
                sample_size: t.sample_size,
              }))
          : []
      }
      emptyText="Not enough historical data yet for a trend line."
    />
  );
}
