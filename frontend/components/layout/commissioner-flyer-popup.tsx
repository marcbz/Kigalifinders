"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Home, KeyRound, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";

const DELAY_MS = 12_000;
const STORAGE_KEY = "kr_commissioner_flyer_dismissed_at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const WHATSAPP_MESSAGE = [
  "Muraho Kigali Rent!",
  "Ndi commissioner ushaka gufasha kubona listing zemejwe mu karere kanjye.",
  "Icyiciro nyamukuru: inzu zo gukodesha. Nshobora no gufasha ku nzu zo kugurisha.",
  "Ndashaka gutangira — mwadufasha?",
].join("\n");

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore quota / private mode */
  }
}

export function CommissionerFlyerPopup({ whatsapp }: { whatsapp?: string }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const phone = digitsOnly(whatsapp || "250784806641");
  const href = useMemo(
    () => `https://wa.me/${phone}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
    [phone],
  );

  const dismiss = useCallback(() => {
    setVisible(false);
    markDismissed();
    window.setTimeout(() => setOpen(false), 220);
  }, []);

  useEffect(() => {
    if (wasRecentlyDismissed()) return;

    const showTimer = window.setTimeout(() => {
      setOpen(true);
      // Allow one paint with closed styles, then animate in.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
    }, DELAY_MS);

    return () => window.clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      lang="rw"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-navy-900/60 backdrop-blur-[3px] transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Funga"
        onClick={dismiss}
      />

      <div
        className={`relative w-full sm:max-w-[420px] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gold-500/25 bg-cream dark:bg-card transition-all duration-300 ease-out ${
          visible
            ? "opacity-100 translate-y-0 sm:scale-100"
            : "opacity-0 translate-y-6 sm:translate-y-4 sm:scale-[0.97]"
        }`}
      >
        <div className="relative bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 px-5 pt-5 pb-6 text-white overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #c9a961 0%, transparent 45%), radial-gradient(circle at 85% 70%, #4A8FB8 0%, transparent 40%)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full border border-gold-500/30"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-2 top-10 h-24 w-24 rounded-full border border-white/10"
            aria-hidden
          />

          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Funga"
          >
            <X className="w-4 h-4" />
          </button>

          <p className="relative text-[11px] font-semibold tracking-[0.18em] uppercase text-gold-400">
            Kigali Rent · Commissioners
          </p>
          <h2
            id={titleId}
            className="relative mt-2 font-serif text-[1.65rem] leading-tight font-bold max-w-[17ch]"
          >
            Wunguke amafaranga mu karere kawe
          </h2>
          <p className="relative mt-2 text-sm text-white/80 max-w-[34ch]">
            Dufasha kubona listing zemejwe — cyane cyane inzu zo gukodesha.
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-gold-500/15 via-gold-400/10 to-transparent border border-gold-500/30 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-gold-600">
              Unguka kuri listing yemejwe
            </p>
            <p className="mt-1 font-serif text-2xl font-bold text-navy-800 dark:text-white">
              2,000 – 3,000{" "}
              <span className="text-base font-sans font-semibold text-gold-600">RWF</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              ku deal umwe ufasha kubona no kwemeza
            </p>
          </div>

          <ul className="space-y-2.5">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-gold-400">
                <KeyRound className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-800 dark:text-white">
                  Inzu yo gukodesha{" "}
                  <span className="text-[10px] font-bold tracking-wide uppercase text-gold-600 ml-1">
                    nyamukuru
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  House for rent — icyiciro dushaka cyane mu mugi wa Kigali.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800/10 text-navy-800 dark:bg-white/10 dark:text-gold-400">
                <Home className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-800 dark:text-white">
                  Inzu yo kugurisha{" "}
                  <span className="text-[10px] font-semibold tracking-wide uppercase text-gray-400 ml-1">
                    kabiri
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Property for sale — nanone dukira listing zemejwe.
                </p>
              </div>
            </li>
          </ul>

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="cta-breathe group flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold px-5 py-3.5 transition-colors"
          >
            <WhatsAppIcon className="w-5 h-5" />
            Ohereza kuri WhatsApp
          </a>

          <p className="text-center text-[11px] text-gray-400 leading-relaxed">
            Ubutumwa bwite buzamo — uvuge akarere kawe n&apos;uko ushaka gufasha.
          </p>
        </div>
      </div>
    </div>
  );
}
