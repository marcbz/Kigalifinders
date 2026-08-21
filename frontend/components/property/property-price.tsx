"use client";

import { useCurrency } from "@/lib/currency";

export function PropertyPrice({
  price,
  currency = "USD",
  period,
  previousPrice,
  className = "",
}: {
  price: number;
  currency?: string;
  period?: string | null;
  previousPrice?: number | null;
  className?: string;
}) {
  const { format } = useCurrency();
  const showReduced = previousPrice != null && previousPrice > price;

  return (
    <div className={className}>
      {showReduced && (
        <div className="text-sm text-gray-400 line-through">
          {format(previousPrice, currency, period)}
        </div>
      )}
      <div className="font-serif text-xl sm:text-2xl font-bold text-navy-800 dark:text-white leading-tight">
        {format(price, currency, period)}
      </div>
    </div>
  );
}
