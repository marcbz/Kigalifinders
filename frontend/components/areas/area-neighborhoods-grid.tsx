import Link from "next/link";
import { MapPin } from "lucide-react";
import { getAreaHref } from "@/lib/areas";
import { neighborhoodFilterLabel } from "@/lib/neighborhood-groups";

export type AreaNeighborhood = {
  id: string;
  name: string;
  slug: string;
  property_count: number;
  district_name?: string | null;
};

interface AreaNeighborhoodsGridProps {
  neighborhoods: AreaNeighborhood[];
}

export function AreaNeighborhoodsGrid({ neighborhoods }: AreaNeighborhoodsGridProps) {
  const byDistrict = neighborhoods.reduce<Record<string, AreaNeighborhood[]>>((acc, area) => {
    const key = area.district_name || "Kigali";
    if (!acc[key]) acc[key] = [];
    acc[key].push(area);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      {Object.entries(byDistrict).map(([district, areas]) => (
        <section key={district}>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-4">{district}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {areas.map((area) => (
              <li key={area.id}>
                <Link
                  href={getAreaHref(area.slug)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gold-500/15 bg-cream/40 dark:bg-secondary/40 hover:border-gold-500/40 hover:shadow-md transition-all"
                >
                  <MapPin className="w-5 h-5 text-gold-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-800 dark:text-white">
                      {neighborhoodFilterLabel(area.name, area.slug)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {area.property_count > 0 ? `${area.property_count} listings` : "View area guide"}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
