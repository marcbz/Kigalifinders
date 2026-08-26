/**
 * Server-rendered title mark with CSS-only sweep (no client JS / layout thrashing).
 * Keeps the gold italic “Dream Home” treatment without typing reflows.
 */
export function HeroAnimatedTitleLine() {
  return (
    <span className="hero-title-mark hero-title-mark--loop relative inline-block whitespace-nowrap">
      <span className="relative z-[1]">
        Find Your{" "}
        <span className="gold-text italic">Dream Home</span>
      </span>
    </span>
  );
}
