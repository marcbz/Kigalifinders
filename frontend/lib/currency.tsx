"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type DisplayCurrency = "USD" | "RWF";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  usdToRwf: number;
  convert: (amount: number, fromCurrency: string) => number;
  format: (amount: number, fromCurrency?: string, period?: string | null) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const FALLBACK_USD_TO_RWF = 1474;
const STORAGE_KEY = "kigalirent_display_currency";

async function fetchUsdToRwf(): Promise<number> {
  // Free public FX feed (no API key). Same market rates Google Finance references via aggregators.
  const res = await fetch(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  );
  if (!res.ok) throw new Error("fx fetch failed");
  const data = (await res.json()) as { usd?: { rwf?: number } };
  const rate = data?.usd?.rwf;
  if (!rate || !Number.isFinite(rate)) throw new Error("no rwf rate");
  return rate;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [usdToRwf, setUsdToRwf] = useState(FALLBACK_USD_TO_RWF);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "RWF" || saved === "USD") setCurrencyState(saved);
    } catch {
      // ignore
    }
    fetchUsdToRwf()
      .then(setUsdToRwf)
      .catch(() => setUsdToRwf(FALLBACK_USD_TO_RWF));
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      // ignore
    }
  }, []);

  const convert = useCallback(
    (amount: number, fromCurrency: string) => {
      const from = (fromCurrency || "USD").toUpperCase();
      const to = currency;
      if (from === to) return amount;
      if (from === "USD" && to === "RWF") return amount * usdToRwf;
      if (from === "RWF" && to === "USD") return amount / usdToRwf;
      return amount;
    },
    [currency, usdToRwf],
  );

  const format = useCallback(
    (amount: number, fromCurrency = "USD", period?: string | null) => {
      const converted = convert(amount, fromCurrency);
      const formatted = new Intl.NumberFormat(currency === "RWF" ? "en-RW" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(converted);
      return period ? `${formatted}/${period === "month" ? "mo" : period}` : formatted;
    },
    [convert, currency],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, usdToRwf, convert, format }),
    [currency, setCurrency, usdToRwf, convert, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      currency: "USD" as DisplayCurrency,
      setCurrency: () => undefined,
      usdToRwf: FALLBACK_USD_TO_RWF,
      convert: (amount: number) => amount,
      format: (amount: number, fromCurrency = "USD", period?: string | null) => {
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: fromCurrency || "USD",
          maximumFractionDigits: 0,
        }).format(amount);
        return period ? `${formatted}/${period === "month" ? "mo" : period}` : formatted;
      },
    };
  }
  return ctx;
}

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className={`inline-flex rounded-full border border-gray-200 dark:border-border text-xs overflow-hidden ${className}`}>
      <button
        type="button"
        className={`px-2.5 py-1 font-semibold ${currency === "USD" ? "bg-navy-800 text-white" : "text-gray-600"}`}
        onClick={() => setCurrency("USD")}
        aria-pressed={currency === "USD"}
      >
        USD
      </button>
      <button
        type="button"
        className={`px-2.5 py-1 font-semibold ${currency === "RWF" ? "bg-navy-800 text-white" : "text-gray-600"}`}
        onClick={() => setCurrency("RWF")}
        aria-pressed={currency === "RWF"}
      >
        RWF
      </button>
    </div>
  );
}
