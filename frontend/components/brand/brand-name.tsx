import { cn } from "@/lib/utils";

interface BrandNameProps {
  variant?: "default" | "light" | "admin";
  size?: "sm" | "md" | "lg";
  /** Join Kigali + Rent with no gap (reads as one word on tight screens). */
  compact?: boolean;
  className?: string;
}

export function BrandName({
  variant = "default",
  size = "md",
  compact = false,
  className,
}: BrandNameProps) {
  const kigaliColor =
    variant === "light" || variant === "admin"
      ? "text-white"
      : "text-navy-800 dark:text-white";

  const sizeClass = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  return (
    <span
      className={cn(
        "font-serif font-bold inline-block whitespace-nowrap",
        compact ? "tracking-tight" : "tracking-wide",
        sizeClass,
        className,
      )}
    >
      <span className={kigaliColor}>Kigali</span>
      <span className="text-gold-500">{compact ? "Rent" : "\u00A0Rent"}</span>
    </span>
  );
}
