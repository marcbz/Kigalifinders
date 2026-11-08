"use client";

import Script from "next/script";
import { useEffect, useId, useState } from "react";
import { WHOP_CHECKOUT_PLAN } from "@/lib/site-defaults";

type WhopCheckoutHandle = {
  create: (name: string) => { mount: (selector: string) => void };
};

declare global {
  interface Window {
    WhopElements?: (opts?: { environment?: "sandbox" | "production" }) => {
      checkout: {
        create: (opts: {
          plan: string;
          returnUrl?: string;
          onComplete?: (completion: { result?: string; paymentId?: string }) => void;
        }) => WhopCheckoutHandle;
      };
    };
  }
}

interface WhopCheckoutProps {
  plan?: string;
  returnUrl?: string;
  className?: string;
}

export function WhopCheckout({
  plan = WHOP_CHECKOUT_PLAN,
  returnUrl,
  className = "min-h-[480px] w-full",
}: WhopCheckoutProps) {
  const reactId = useId().replace(/:/g, "");
  const mountId = `whop-checkout-${reactId}`;
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && typeof window.WhopElements === "function",
  );

  useEffect(() => {
    if (!ready || typeof window === "undefined" || !window.WhopElements) return;

    const selector = `#${mountId}`;
    const target = document.querySelector(selector);
    if (!target) return;

    target.innerHTML = "";
    const checkout = window.WhopElements().checkout.create({
      plan,
      ...(returnUrl ? { returnUrl } : {}),
    });
    checkout.create("checkout").mount(selector);

    return () => {
      target.innerHTML = "";
    };
  }, [ready, plan, returnUrl, mountId]);

  return (
    <>
      <div id={mountId} className={className} />
      <Script
        src="https://cdn.whop.com/elements/amber/elements.js"
        strategy="afterInteractive"
        data-whop-elements=""
        onLoad={() => setReady(true)}
      />
    </>
  );
}
