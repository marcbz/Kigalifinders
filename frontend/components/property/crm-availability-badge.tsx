import { Ban, Bookmark, CheckCircle2, KeyRound } from "lucide-react";

type PublicCrmStatus = "AVAILABLE" | "RESERVED" | "RENTED" | "UNAVAILABLE";

const STATUS_CONFIG: Record<
  PublicCrmStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-emerald-600 text-white",
    Icon: CheckCircle2,
  },
  RESERVED: {
    label: "Reserved",
    className: "bg-amber-600 text-white",
    Icon: Bookmark,
  },
  RENTED: {
    label: "Rented",
    className: "bg-slate-700 text-white",
    Icon: KeyRound,
  },
  UNAVAILABLE: {
    label: "Unavailable",
    className: "bg-stone-500 text-white",
    Icon: Ban,
  },
};

function isPublicCrmStatus(value: string): value is PublicCrmStatus {
  return value in STATUS_CONFIG;
}

interface CrmAvailabilityBadgeProps {
  status?: string | null;
  /** Fallback when only the legacy crm_available flag is present. */
  available?: boolean;
  size?: "sm" | "md";
}

export function CrmAvailabilityBadge({
  status,
  available,
  size = "sm",
}: CrmAvailabilityBadgeProps) {
  const resolved =
    status && isPublicCrmStatus(status)
      ? status
      : available
        ? "AVAILABLE"
        : null;

  if (!resolved) return null;

  const { label, className, Icon } = STATUS_CONFIG[resolved];
  const sizing =
    size === "md"
      ? "gap-1.5 px-3 py-1 text-xs"
      : "gap-1 px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide shadow-sm ${sizing} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </span>
  );
}
