"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Home, KeyRound, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";

const STORAGE_KEY = "kr_commissioner_flyer_dismissed_at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Avoid firing on the first accidental cursor flicker after load. */
const ARM_AFTER_MS = 1_500;

const WHATSAPP_MESSAGE =
  "Muraho!! Ndi Umu commissioner ushaka kugufasha kubona Inzu Ikodeshwa Cg Igurishwa Nkanaguhuza Nanyirayo/Manager.";

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
  const shownRef = useRef(false);

  const phone = digitsOnly(whatsapp || "250784806641");
  const href = useMemo(
    () => `https://wa.me/${phone}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
    [phone],
  );

  const show = useCallback(() => {
    if (shownRef.current || wasRecentlyDismissed()) return;
    shownRef.current = true;
    setOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    markDismissed();
    window.setTimeout(() => setOpen(false), 220);
  }, []);

  useEffect(() => {
    if (wasRecentlyDismissed()) return;

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, ARM_AFTER_MS);

    const tryShow = () => {
      if (!armed) return;
      show();
    };

    /** Desktop: cursor leaves the viewport toward the top (tab bar / close / address bar). */
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY > 0) return;
      const related = e.relatedTarget as Node | null;
      if (related && document.documentElement.contains(related)) return;
      tryShow();
    };

    /**
     * Mobile / tablet: intercept the first back navigation so we can offer the flyer
     * before they leave the site.
     */
    const historyKey = { krCommissionerFlyer: 1 as const };
    try {
      window.history.pushState(historyKey, "");
    } catch {
      /* ignore */
    }

    const onPopState = () => {
      if (shownRef.current || wasRecentlyDismissed()) return;
      try {
        window.history.pushState(historyKey, "");
      } catch {
        /* ignore */
      }
      tryShow();
    };

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("popstate", onPopState);
    };
  }, [show]);

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
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      lang="rw"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-navy-900/65 backdrop-blur-[3px] transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Funga"
        onClick={dismiss}
      />

      <div
        className={`relative w-full max-w-[420px] max-h-[min(92vh,720px)] overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl border border-gold-500/25 bg-[#faf7f2] dark:bg-card transition-all duration-300 ease-out ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-5 scale-[0.97]"
        }`}
      >
        <div className="relative bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 px-4 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 text-white overflow-hidden">
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

          <p className="relative pr-10 text-[11px] font-semibold tracking-[0.18em] uppercase text-gold-400">
            Kigali Rent · Commissioners
          </p>
          <h2
            id={titleId}
            className="relative mt-2.5 pr-9 font-serif font-bold text-white text-[1.28rem] leading-[1.22] tracking-tight xs:text-[1.35rem] sm:text-[1.5rem] sm:leading-[1.26] text-balance"
          >
            <span className="block">Uri Umu Commissioner?</span>
            <span className="block mt-1 text-gold-400">Uzi Inzu Ikodeshwa!!</span>
            <span className="block mt-1 text-[0.92em] font-semibold leading-snug text-white/95">
              Ese Waruziko Wabihemberwa!?
            </span>
          </h2>
          <p className="relative mt-3 text-[12.5px] sm:text-sm leading-snug text-white/80 text-pretty">
            Dufashe kubona Inzu Ikodeshwa/Igurishwa — Maze Ukorere Cash Ako Kanya!!.
          </p>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-gold-500/15 via-gold-400/10 to-transparent border border-gold-500/30 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-gold-600">
              Unguka kuri listing yemejwe
            </p>
            <p className="mt-1 font-serif text-2xl font-bold text-navy-800 dark:text-white">
              2,000 – 3,000{" "}
              <span className="text-base font-sans font-semibold text-gold-600">RWF</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              ku deal Udufashije kubona Muri Kigali
            </p>
          </div>

          <ul className="space-y-2.5">
            <li className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-gold-400">
                <KeyRound className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-800 dark:text-white">
                  Inzu yo gukodesha
                </p>
                <p className="text-xs text-gray-500">House for rent</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800/10 text-navy-800 dark:bg-white/10 dark:text-gold-400">
                <Home className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-800 dark:text-white">
                  Inzu yo kugurisha
                </p>
                <p className="text-xs text-gray-500">Property for sale</p>
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

          <p className="text-center text-[10px] tracking-wide text-gray-400">
            Amategeko Namabwirizwa, Birakurikiza
          </p>
        </div>
      </div>
    </div>
  );
}
