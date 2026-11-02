import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "object" && item && "msg" in item) return String((item as { msg: string }).msg);
        return String(item);
      })
      .join(", ");
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const PRICE_PERIOD_LABELS: Record<string, string> = {
  month: "mo",
  day: "day",
  daily: "day",
  night: "night",
  year: "yr",
};

export function formatPricePeriod(period?: string | null) {
  if (!period) return "";
  return PRICE_PERIOD_LABELS[period] || period;
}

export function formatPrice(price: number, currency = "USD", period?: string | null) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
  const label = formatPricePeriod(period);
  return label ? `${formatted}/${label}` : formatted;
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
