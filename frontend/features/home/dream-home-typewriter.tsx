"use client";

import { useEffect, useState } from "react";

const PHRASE = "Dream Home";
const TYPE_MS = 1500;
const HOLD_MS = 7000;

/** Small client island — only the typing span; keeps hero title server-rendered. */
export function DreamHomeTypewriter() {
  const [shown, setShown] = useState(PHRASE);
  const [typingDone, setTypingDone] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let cancelled = false;
    let intervalId = 0;
    let holdId = 0;
    const stepMs = Math.max(35, Math.floor(TYPE_MS / PHRASE.length));

    const runCycle = () => {
      if (cancelled) return;
      let index = 0;
      setShown("");
      setTypingDone(false);

      intervalId = window.setInterval(() => {
        if (cancelled) return;
        index += 1;
        setShown(PHRASE.slice(0, index));
        if (index >= PHRASE.length) {
          window.clearInterval(intervalId);
          setTypingDone(true);
          holdId = window.setTimeout(runCycle, HOLD_MS);
        }
      }, stepMs);
    };

    holdId = window.setTimeout(runCycle, HOLD_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(holdId);
    };
  }, []);

  return (
    <span className="gold-text italic inline-grid align-baseline" aria-label={PHRASE}>
      <span className="invisible col-start-1 row-start-1 whitespace-pre" aria-hidden>
        {PHRASE}
      </span>
      <span className="col-start-1 row-start-1 whitespace-pre">
        {shown}
        {!typingDone && (
          <span
            className="inline-block w-[0.08em] h-[0.85em] ml-0.5 align-[-0.05em] bg-gold-400 animate-pulse"
            aria-hidden
          />
        )}
      </span>
    </span>
  );
}
