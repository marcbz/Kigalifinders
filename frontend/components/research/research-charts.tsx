"use client";

import { useMemo, useState } from "react";

type SeriesPoint = {
  label: string;
  value: number;
  sample_size?: number;
  p25?: number;
  p75?: number;
};

type Props = {
  title: string;
  subtitle?: string;
  points: SeriesPoint[];
  emptyText?: string;
  kind?: "bar" | "line";
  unitPrefix?: string;
};

/** Lightweight interactive SVG charts — no chart library dependency. */
export function ResearchChart({
  title,
  subtitle,
  points,
  emptyText = "Not enough historical data yet.",
  kind = "bar",
  unitPrefix = "$",
}: Props) {
  const [active, setActive] = useState<number | null>(null);
  const max = useMemo(() => Math.max(...points.map((p) => p.value || 0), 1), [points]);

  if (!points.length || points.every((p) => !p.value)) {
    return (
      <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
        <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-1">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
        <p className="text-sm text-gray-500">{emptyText}</p>
      </section>
    );
  }

  const tip = active != null ? points[active] : null;

  return (
    <section className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
      <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      <div className="relative">
        <svg viewBox="0 0 640 240" className="w-full h-auto" role="img" aria-label={title}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1="48"
              x2="620"
              y1={200 - f * 160}
              y2={200 - f * 160}
              stroke="currentColor"
              className="text-gray-200 dark:text-navy-700"
              strokeWidth="1"
            />
          ))}
          {kind === "bar"
            ? points.map((p, i) => {
                const w = Math.max(12, 520 / points.length - 8);
                const x = 56 + i * (520 / points.length);
                const h = (p.value / max) * 160;
                return (
                  <g key={p.label}>
                    <rect
                      x={x}
                      y={200 - h}
                      width={w}
                      height={h}
                      rx="4"
                      className={active === i ? "fill-gold-500" : "fill-navy-700 dark:fill-gold-500/80"}
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      tabIndex={0}
                    />
                    <text x={x + w / 2} y="220" textAnchor="middle" className="fill-gray-500 text-[10px]">
                      {p.label.length > 10 ? `${p.label.slice(0, 9)}…` : p.label}
                    </text>
                  </g>
                );
              })
            : null}
          {kind === "line" ? (
            <>
              <polyline
                fill="none"
                stroke="#C9A961"
                strokeWidth="3"
                points={points
                  .map((p, i) => {
                    const x = 56 + i * (520 / Math.max(points.length - 1, 1));
                    const y = 200 - (p.value / max) * 160;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              {points.map((p, i) => {
                const x = 56 + i * (520 / Math.max(points.length - 1, 1));
                const y = 200 - (p.value / max) * 160;
                return (
                  <circle
                    key={p.label}
                    cx={x}
                    cy={y}
                    r={active === i ? 6 : 4}
                    className="fill-gold-500"
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  />
                );
              })}
            </>
          ) : null}
        </svg>
        {tip && (
          <div className="absolute top-2 right-2 text-xs bg-navy-800 text-white rounded-lg px-3 py-2 shadow">
            <div className="font-medium">{tip.label}</div>
            <div>
              {unitPrefix}
              {tip.value.toLocaleString()}
              {tip.sample_size != null ? ` · n=${tip.sample_size}` : ""}
            </div>
            {tip.p25 != null && tip.p75 != null && (
              <div className="text-gray-300">
                Most between {unitPrefix}
                {tip.p25.toLocaleString()}–{unitPrefix}
                {tip.p75.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

type RangeCardProps = {
  label: string;
  typicalText?: string | null;
  rangeText: string;
  sampleSize: number;
  periodEnd?: string | null;
  disclaimer?: string;
};

export function ResearchRangeCard({
  label,
  typicalText,
  rangeText,
  sampleSize,
  periodEnd,
  disclaimer,
}: RangeCardProps) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-navy-800 p-6">
      <p className="text-xs uppercase tracking-wider text-gold-600 mb-2">{label}</p>
      <p className="font-serif text-2xl text-navy-800 dark:text-white mb-2">
        {typicalText || "Not enough historical data yet."}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{rangeText}</p>
      <p className="text-xs text-gray-500">
        Sample size: {sampleSize}
        {periodEnd ? ` · Updated ${periodEnd}` : ""}
      </p>
      {disclaimer && <p className="text-xs text-gray-500 mt-3">{disclaimer}</p>}
    </div>
  );
}
