"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PHRASE = "Dream Home";
const TYPE_MS = 1500;
const HOLD_MS = 7000; // wait 7s after typing before repeating

export function HeroIntroCopy({ subtitle }: { subtitle: string }) {
  const [shown, setShown] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setShown(PHRASE);
      setTypingDone(true);
      setSweeping(true);
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    let holdId = 0;
    const stepMs = Math.max(35, Math.floor(TYPE_MS / PHRASE.length));

    const runCycle = () => {
      if (cancelled) return;
      let index = 0;
      setShown("");
      setTypingDone(false);
      setSweeping(false);

      intervalId = window.setInterval(() => {
        if (cancelled) return;
        index += 1;
        setShown(PHRASE.slice(0, index));
        if (index >= PHRASE.length) {
          window.clearInterval(intervalId);
          setTypingDone(true);
          setSweeping(true);
          holdId = window.setTimeout(runCycle, HOLD_MS);
        }
      }, stepMs);
    };

    runCycle();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(holdId);
    };
  }, []);

  return (
    <>
      <h1 className="font-serif text-[2rem] sm:text-4xl md:text-6xl font-bold leading-[1.12] mb-5">
        <span className="whitespace-nowrap">
          Find Your{" "}
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
        </span>
        <br />
        In Kigali
      </h1>

      {subtitle ? (
        <p
          className={cn(
            "hero-subtitle-mark text-lg md:text-xl text-gray-200 mb-10 max-w-2xl leading-relaxed",
            sweeping && "is-sweeping",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </>
  );
}
