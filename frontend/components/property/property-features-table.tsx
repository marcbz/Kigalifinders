import type { PropertyDetail } from "@/types";
import { buildPropertyFeatureRows } from "@/lib/property-features";

export function PropertyFeaturesTable({ property }: { property: PropertyDetail }) {
  if (property.show_features_table === false) return null;
  const rows = buildPropertyFeatureRows(property);
  if (!rows.length) return null;

  return (
    <section className="mb-8">
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">Property Features</h2>
      <div className="rounded-2xl border border-gray-200 dark:border-border overflow-hidden bg-white dark:bg-card shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.label}
                className={index % 2 === 0 ? "bg-cream/40 dark:bg-navy-900/30" : "bg-white dark:bg-card"}
              >
                <th className="py-3.5 px-5 text-left font-semibold text-navy-800 dark:text-white w-[42%] border-b border-gray-100 dark:border-border last:border-0">
                  {row.label}
                </th>
                <td className="py-3.5 px-5 text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-border last:border-0">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
