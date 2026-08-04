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

export function formatPrice(price: number, currency = "USD", period?: string | null) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
  return period ? `${formatted}/${period === "month" ? "mo" : period}` : formatted;
}
