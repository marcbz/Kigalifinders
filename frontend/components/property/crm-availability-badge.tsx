import { Ban, Bookmark, CheckCircle2, KeyRound } from "lucide-react";

const STYLES: Record<
  string,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-emerald-600 text-white",
    Icon: CheckCircle2,
  },
  RESERVED: {
    label: "Reserved",
    className: "bg-sky-600 text-white",
    Icon: Bookmark,
  },
  RENTED: {
    label: "Rented",
    className: "bg-violet-600 text-white",
    Icon: KeyRound,
  },
  UNAVAILABLE: {
    label: "Unavailable",
    className: "bg-rose-700 text-white",
    Icon: Ban,
  },
};

export function CrmAvailabilityBadge({
  status,
  size = "sm",
}: {
  status?: string | null;
  size?: "sm" | "md";
}) {
  if (!status) return null;
  const style = STYLES[status];
  if (!style) return null;

  const { label, className, Icon } = style;
  const sizing =
    size === "md"
      ? "gap-1.5 rounded-full px-3 py-1 text-xs"
      : "gap-1 rounded-full px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wide shadow-sm ${sizing} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </span>
  );
}
