"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { crmApi } from "@/services/crm-api";
import { cn, getApiErrorMessage } from "@/lib/utils";

const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;
const TZ = "Africa/Kigali";

export function humanize(value?: string | null): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TZ }).format(d);
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(value),
  );
}

export function fmtRelative(value?: string | null): string {
  if (!value) return "never";
  const diff = Date.now() - new Date(value).getTime();
  const future = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const label =
    mins < 60 ? `${mins}m` : mins < 60 * 24 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / (60 * 24))}d`;
  return future ? `in ${label}` : `${label} ago`;
}

export function fmtMoney(amount?: number | null, currency?: string | null): string {
  if (amount === null || amount === undefined) return "—";
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: cur === "RWF" ? 0 : 2 }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${cur}`;
  }
}

export function fmtCommission(type?: string | null, value?: number | null, currency?: string | null): string {
  if (!type || value === null || value === undefined) return "—";
  return type === "PERCENTAGE" ? `${value}% of monthly rent` : `${fmtMoney(value, currency)} fixed`;
}

/** ISO instant -> value for <input type="datetime-local"> in Kigali wall-clock time. */
export function toKigaliInput(iso?: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 16);
}

export function kigaliInputNow(addHours = 0): string {
  return new Date(Date.now() + KIGALI_OFFSET_MS + addHours * 3600000).toISOString().slice(0, 16);
}

const BADGE: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  VERIFY: "bg-amber-100 text-amber-800",
  RESERVED: "bg-sky-100 text-sky-800",
  RENTED: "bg-violet-100 text-violet-800",
  UNAVAILABLE: "bg-gray-200 text-gray-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PROSPECT: "bg-sky-100 text-sky-800",
  INACTIVE: "bg-gray-200 text-gray-700",
  DO_NOT_CONTACT: "bg-red-100 text-red-800",
  NEW: "bg-sky-100 text-sky-800",
  CONTACTED: "bg-indigo-100 text-indigo-800",
  SEARCHING: "bg-amber-100 text-amber-800",
  VIEWING: "bg-cyan-100 text-cyan-800",
  NEGOTIATING: "bg-orange-100 text-orange-800",
  CONVERTED: "bg-emerald-100 text-emerald-800",
  LOST: "bg-red-100 text-red-800",
  SCHEDULED: "bg-sky-100 text-sky-800",
  CONFIRMED: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-200 text-gray-700",
  NO_SHOW: "bg-red-100 text-red-800",
  RESCHEDULED: "bg-amber-100 text-amber-800",
  LEAD: "bg-sky-100 text-sky-800",
  CONTRACT: "bg-violet-100 text-violet-800",
  EXPECTED: "bg-sky-100 text-sky-800",
  INVOICED: "bg-indigo-100 text-indigo-800",
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-red-100 text-red-800",
  WAIVED: "bg-gray-200 text-gray-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  LOW: "bg-gray-200 text-gray-700",
  MEDIUM: "bg-sky-100 text-sky-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className="text-gray-400">—</span>;
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold leading-tight whitespace-nowrap", BADGE[value] || "bg-gray-100 text-gray-700", className)}>
      {humanize(value)}
    </span>
  );
}

export function KpiCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warn" | "good" | "bad" }) {
  return (
    <div className="rounded-lg border bg-white dark:bg-navy-800 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={cn(
          "text-xl font-bold text-navy-800 dark:text-white tabular-nums",
          tone === "warn" && "text-amber-600",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClassName }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-lg border bg-white dark:bg-navy-800", className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h3 className="text-sm font-semibold text-navy-800 dark:text-white">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      ) : null}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export const tableCls = "w-full text-[13px]";
export const thCls = "text-left font-medium text-gray-500 px-2 py-1.5 border-b whitespace-nowrap";
export const tdCls = "px-2 py-1.5 border-b border-gray-100 dark:border-navy-700 align-top";
export const inputCls =
  "w-full rounded-md border px-2 py-1.5 text-sm bg-white dark:bg-navy-900 focus:outline-none focus:ring-1 focus:ring-gold-500";
export const linkCls = "text-navy-800 dark:text-gold-500 font-medium hover:underline";

export function SmallButton({ className, variant = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
        variant === "default" && "border border-gray-300 dark:border-navy-600 hover:border-navy-800 dark:hover:border-gold-500",
        variant === "primary" && "bg-navy-800 text-gold-500 hover:bg-navy-700",
        variant === "danger" && "border border-red-300 text-red-700 hover:bg-red-50",
        variant === "ghost" && "text-gray-600 hover:text-navy-800 dark:text-gray-300",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-xs", className)}>
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

export function ChoiceSelect({
  value,
  onChange,
  options,
  blank = "—",
  className,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | { id: string; name: string }[];
  blank?: string | null;
  className?: string;
  labels?: (v: string) => string;
}) {
  return (
    <select className={cn(inputCls, className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {blank !== null ? <option value="">{blank}</option> : null}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {labels ? labels(o) : humanize(o)}
          </option>
        ) : (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ),
      )}
    </select>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div
        className={cn("w-full rounded-lg bg-white dark:bg-navy-800 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="font-semibold text-navy-800 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-navy-800" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; count?: number }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "px-3 py-1.5 text-sm -mb-px border-b-2",
            active === t.id ? "border-gold-500 text-navy-800 dark:text-white font-semibold" : "border-transparent text-gray-500 hover:text-navy-800",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="ml-1 text-xs text-gray-400">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyRow({ cols, text = "Nothing here yet." }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-2 py-4 text-center text-sm text-gray-500">
        {text}
      </td>
    </tr>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-red-600">{getApiErrorMessage(error)}</p>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-navy-800 dark:text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function useLookups() {
  return useQuery({ queryKey: ["crm", "lookups"], queryFn: crmApi.lookups, staleTime: 5 * 60 * 1000 });
}

/** Mutation that refreshes every CRM query on success; exposes the API error for inline display. */
export function useCrmMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, onSuccess?: (r: TResult) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      onSuccess?.(r);
    },
  });
}

/** Debounced value for search boxes so typing doesn't fire a request per keystroke. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function strOrNull(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

export function ContactLinks({ phone, whatsapp, email }: { phone?: string | null; whatsapp?: string | null; email?: string | null }) {
  const wa = (whatsapp || "").replace(/[^\d]/g, "");
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
      {phone ? (
        <a className="text-navy-700 dark:text-gold-500 hover:underline" href={`tel:${phone}`}>
          {phone}
        </a>
      ) : null}
      {wa ? (
        <a className="text-emerald-700 hover:underline" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      ) : null}
      {email ? (
        <a className="text-navy-700 dark:text-gold-500 hover:underline" href={`mailto:${email}`}>
          {email}
        </a>
      ) : null}
      {!phone && !wa && !email ? <span className="text-gray-400">—</span> : null}
    </span>
  );
}
