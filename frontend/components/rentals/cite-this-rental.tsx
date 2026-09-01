import { buildRentalCitationText, formatCitationDate } from "@/lib/rental-jsonld";

export function CiteThisRental({
  topic,
  canonicalUrl,
  lastUpdated,
  listingCount,
}: {
  topic: string;
  canonicalUrl: string;
  lastUpdated?: string | null;
  listingCount?: number;
}) {
  const citationText = buildRentalCitationText({
    topic,
    canonicalUrl,
    lastUpdated,
    listingCount,
  });
  const updatedDisplay = formatCitationDate(lastUpdated);

  return (
    <section className="rounded-2xl border border-dashed p-6 bg-white dark:bg-navy-800 space-y-3">
      <h2 className="font-serif text-lg font-bold text-navy-800 dark:text-white">Cite this page</h2>
      <dl className="text-sm space-y-2">
        <div>
          <dt className="text-gray-500">Topic</dt>
          <dd>{topic}</dd>
        </div>
        {updatedDisplay && (
          <div>
            <dt className="text-gray-500">Last updated</dt>
            <dd>{updatedDisplay}</dd>
          </div>
        )}
        {listingCount != null && listingCount > 0 && (
          <div>
            <dt className="text-gray-500">Verified listings</dt>
            <dd>{listingCount}</dd>
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
      <blockquote className="text-xs text-gray-600 dark:text-gray-300 border-l-2 border-navy-300 pl-3 italic">
        {citationText}
      </blockquote>
    </section>
  );
}
