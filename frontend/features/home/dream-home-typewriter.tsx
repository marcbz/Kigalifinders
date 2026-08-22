"use client";

import { useEffect, useState } from "react";

const PHRASE = "Dream Home";

/** Types “Dream Home” once over ~1–2s; keeps gold italic styling. */
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

    const durationMs = 1000 + Math.floor(Math.random() * 1000); // 1–2s
    const stepMs = Math.max(40, Math.floor(durationMs / PHRASE.length));
    let index = 0;

    const id = window.setInterval(() => {
      index += 1;
      setShown(PHRASE.slice(0, index));
      if (index >= PHRASE.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, stepMs);

    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="gold-text italic inline-grid align-baseline" aria-label={PHRASE}>
      <span className="invisible col-start-1 row-start-1 whitespace-pre" aria-hidden>
        {PHRASE}
      </span>
      <span className="col-start-1 row-start-1 whitespace-pre">
        {shown}
        {!done && (
          <span className="inline-block w-[0.08em] h-[0.85em] ml-0.5 align-[-0.05em] bg-gold-400 animate-pulse" aria-hidden />
        )}
      </span>
    </span>
  );
}
