import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Soft marker-style highlight behind short nav/CTA labels. */
export function HighlightLabel({
  children,
  onDark = false,
  className,
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center px-2 py-0.5 font-semibold leading-none",
        onDark ? "text-gold-400" : "text-navy-900 dark:text-gold-400",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -skew-x-3 rounded-sm opacity-80",
          onDark ? "bg-gold-500/35" : "bg-gold-400/55 dark:bg-gold-500/40",
        )}
      />
      <span className="relative z-[1]">{children}</span>
    </span>
  );
}
