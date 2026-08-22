"use client";

import { useEffect, useState } from "react";

const PHRASE = "Dream Home";
/** Full type cycle capped at 1.5s, then a short pause, then repeats. */
const TYPE_MS = 1500;
const PAUSE_MS = 700;

/** Loops typing “Dream Home” in gold italic. */
export function DreamHomeTypewriter() {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setShown(PHRASE);
      setDone(true);
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    let timeoutId = 0;
    const stepMs = Math.max(35, Math.floor(TYPE_MS / PHRASE.length));

    const runCycle = () => {
      if (cancelled) return;
      let index = 0;
      setShown("");
      setDone(false);

      intervalId = window.setInterval(() => {
        if (cancelled) return;
        index += 1;
        setShown(PHRASE.slice(0, index));
        if (index >= PHRASE.length) {
          window.clearInterval(intervalId);
          setDone(true);
          timeoutId = window.setTimeout(runCycle, PAUSE_MS);
        }
      }, stepMs);
    };

    runCycle();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <span className="gold-text italic inline-grid align-baseline" aria-label={PHRASE}>
      <span className="invisible col-start-1 row-start-1 whitespace-pre" aria-hidden>
        {PHRASE}
      </span>
      <span className="col-start-1 row-start-1 whitespace-pre">
        {shown}
        {!done && (
          <span
            className="inline-block w-[0.08em] h-[0.85em] ml-0.5 align-[-0.05em] bg-gold-400 animate-pulse"
            aria-hidden
          />
        )}
      </span>
    </span>
  );
}
