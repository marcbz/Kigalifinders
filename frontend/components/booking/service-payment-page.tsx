"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CheckCircle2, Lock, ShieldCheck, X } from "lucide-react";
import { WhopCheckout } from "@/components/booking/whop-checkout";
import { Button } from "@/components/ui/button";
import { WHOP_SERVICE_PAYMENT_PLAN } from "@/lib/site-defaults";

const INCLUDES = [
  "Dedicated support from the Kigali Rent team",
  "Hands-on help with your rental or property needs",
  "Clear next steps after payment is confirmed",
] as const;

interface ServicePaymentPageProps {
  returnUrl: string;
  plan?: string;
}

export function ServicePaymentPage({
  returnUrl,
  plan = WHOP_SERVICE_PAYMENT_PLAN,
}: ServicePaymentPageProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(201,162,39,0.12),_transparent_55%),linear-gradient(180deg,#f8f5ef_0%,#ffffff_45%,#f3f6fb_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(201,162,39,0.1),_transparent_50%),linear-gradient(180deg,#06132b_0%,#0b1a33_55%,#10243f_100%)]"
        aria-hidden
      />

      <div className="relative max-w-xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-1.5 text-gold-600 dark:text-gold-400 tracking-[0.2em] text-[11px] font-semibold">
            SERVICE PAYMENT
          </span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-navy-800 dark:text-white mt-5 mb-3 leading-tight">
            Secure Your Service
          </h1>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Complete your payment below to confirm your service with{" "}
            <strong className="text-navy-800 dark:text-white">Kigali Rent</strong>.
          </p>
        </div>

        <div className="rounded-2xl border border-gold-500/20 bg-white/85 dark:bg-navy-900/75 backdrop-blur-sm p-6 md:p-8 shadow-[0_20px_60px_rgba(6,19,43,0.08)]">
          <div className="text-center mb-6 pb-6 border-b border-gray-100 dark:border-navy-700">
            <p className="text-sm uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 font-semibold">
              Amount due
            </p>
            <p className="font-serif text-5xl font-bold text-navy-800 dark:text-white mt-2">
              <span className="text-gold-600 dark:text-gold-400">$200</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              One-time service payment
            </p>
          </div>

          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-5">
            This payment confirms your private service arrangement with our team. Once it goes
            through, we&apos;ll follow up quickly to continue with the next steps for your case.
          </p>

          <ul className="space-y-3 mb-2">
            {INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 text-center space-y-4">
          <Button
            type="button"
            size="lg"
            className="rounded-full px-10 text-base shadow-lg shadow-gold-500/20"
            onClick={openCheckout}
          >
            Pay $200 Now
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gold-500" />
              Secure checkout
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-500" />
              Private payment link
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Opens a secure payment window. You&apos;ll receive confirmation after a successful payment.
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
            className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-navy-900 shadow-2xl border border-gray-100 dark:border-navy-700"
          >
            <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 dark:border-navy-700 bg-white/95 dark:bg-navy-900/95 backdrop-blur px-12 py-4">
              <p id={titleId} className="font-serif text-xl font-bold text-navy-800 dark:text-white text-center">
                Complete Your Payment
              </p>
              <button
                type="button"
                onClick={close}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-800 hover:text-navy-800 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <WhopCheckout plan={plan} returnUrl={returnUrl} className="min-h-[420px] w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
