"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CheckCircle2, Lock, ShieldCheck, Sparkles, X } from "lucide-react";
import { WhopCheckout } from "@/components/booking/whop-checkout";
import { Button } from "@/components/ui/button";

const BENEFITS = [
  {
    title: "Personalized meeting",
    body: "Sit down with our team and get guidance tailored to your budget, timeline, and neighborhood preferences.",
  },
  {
    title: "Local market insight",
    body: "Understand real Kigali rental prices so you do not overpay or miss a fair deal.",
  },
  {
    title: "Landlord negotiation",
    body: "We negotiate on your behalf — especially helpful when landlords are less flexible with foreign tenants.",
  },
  {
    title: "Better odds of securing the home",
    body: "Move faster with people who know how to close rentals in Kigali's competitive market.",
  },
] as const;

interface BookMeetingPageProps {
  returnUrl: string;
}

export function BookMeetingPage({ returnUrl }: BookMeetingPageProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();

  const close = useCallback(() => setOpen(false), []);
  const openCheckout = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div className="relative overflow-hidden py-16 px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,162,39,0.14),_transparent_55%),linear-gradient(180deg,#f8f5ef_0%,#ffffff_42%,#f3f6fb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(201,162,39,0.12),_transparent_50%),linear-gradient(180deg,#06132b_0%,#0b1a33_55%,#10243f_100%)]"
        aria-hidden
      />

      <div className="relative max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1.5 text-gold-600 dark:text-gold-400 tracking-[0.22em] text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            LIMITED INTRO OFFER
          </span>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-navy-800 dark:text-white mt-5 mb-4 leading-tight">
            Meeting Reservation Fee
          </h1>
          <p className="text-lg md:text-xl text-navy-700 dark:text-gray-200 font-medium max-w-2xl mx-auto">
            Found a property that feels like home?{" "}
            <span className="text-gold-600 dark:text-gold-400 font-semibold">
              Don&apos;t risk missing it — or paying more than you should.
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-gold-500/20 bg-white/80 dark:bg-navy-900/70 backdrop-blur-sm p-6 md:p-8 shadow-[0_20px_60px_rgba(6,19,43,0.08)] space-y-5 text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>
            <strong className="text-navy-800 dark:text-white">Kigali&apos;s rental market</strong> can
            be challenging, especially when navigating prices and negotiating directly with landlords.
            Some landlords may be less flexible with{" "}
            <strong className="text-navy-800 dark:text-white">foreign tenants</strong>, making it
            difficult to secure a{" "}
            <strong className="text-gold-600 dark:text-gold-400">fair rental price</strong>.
          </p>

          <p className="text-navy-800 dark:text-white font-semibold text-lg">
            That&apos;s where <span className="gold-text">KigaliRent</span> comes in.
          </p>

          <p>
            For just{" "}
            <strong className="text-gold-600 dark:text-gold-400 text-xl">$1.99</strong>, reserve a{" "}
            <strong className="text-navy-800 dark:text-white">personalized meeting</strong> with our
            team. We&apos;ll help you explore suitable rental options, understand the local market, and{" "}
            <strong className="text-navy-800 dark:text-white">negotiate with landlords on your behalf</strong>{" "}
            to help you secure a better rental price.
          </p>

          <ul className="grid sm:grid-cols-2 gap-4 pt-2">
            {BENEFITS.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-gray-100 dark:border-navy-700 bg-cream/60 dark:bg-navy-800/50 p-4"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-navy-800 dark:text-white">{item.title}</p>
                    <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">{item.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p>
            Don&apos;t just find a place to live. Find the{" "}
            <strong className="text-navy-800 dark:text-white">right home</strong>, at the{" "}
            <strong className="text-gold-600 dark:text-gold-400">right price</strong>, with the{" "}
            <strong className="text-navy-800 dark:text-white">right people negotiating for you</strong>.
          </p>

          <p className="font-serif text-xl md:text-2xl font-bold text-navy-800 dark:text-white text-center pt-2">
            Your next home starts with one meeting.
          </p>
        </div>

        <div className="mt-10 text-center space-y-4">
          <Button
            type="button"
            size="lg"
            className="rounded-full px-10 text-base shadow-lg shadow-gold-500/20"
            onClick={openCheckout}
          >
            Reserve My Meeting — $1.99
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gold-500" />
              Secure checkout
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-500" />
              Instant meeting reservation
            </span>
            <span className="font-semibold text-navy-700 dark:text-gold-400">
              Only $1.99 today
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Click to open secure payment. After checkout, we&apos;ll confirm your personalized
            meeting with the Kigali Rent team.
          </p>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm"
            aria-label="Close checkout"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-gray-100 dark:border-navy-700"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 dark:border-navy-700 bg-white/95 dark:bg-navy-900/95 backdrop-blur px-5 py-4">
              <div>
                <p id={titleId} className="font-serif text-xl font-bold text-navy-800 dark:text-white">
                  Complete Your Reservation
                </p>
                <p id={descId} className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Pay the <strong className="text-gold-600 dark:text-gold-400">$1.99 Meeting Reservation Fee</strong> securely below.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-800 hover:text-navy-800 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <WhopCheckout returnUrl={returnUrl} className="min-h-[420px] w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
