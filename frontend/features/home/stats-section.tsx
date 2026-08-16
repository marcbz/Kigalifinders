import type { SiteStats } from "@/types";

interface StatsSectionProps {
  stats: SiteStats;
}

export function StatsSection({ stats }: StatsSectionProps) {
  const items = [
    { value: `${stats.happy_clients.toLocaleString()}+`, label: "Happy Clients" },
    { value: `${stats.years_experience}+`, label: "Years Experience" },
    { value: `${stats.client_rating}★`, label: "Client Rating" },
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        {items.map((item) => (
          <div key={item.label}>
            <div className="stat-num font-serif text-5xl md:text-6xl font-bold mb-2">{item.value}</div>
            <div className="text-sm tracking-widest text-gray-500 uppercase">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
