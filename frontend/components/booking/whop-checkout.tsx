"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
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
}

export function WhopCheckout({
  plan = WHOP_CHECKOUT_PLAN,
  returnUrl,
}: WhopCheckoutProps) {
  const [ready, setReady] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!ready || mounted.current || typeof window === "undefined" || !window.WhopElements) {
      return;
    }

    mounted.current = true;
    const checkout = window.WhopElements().checkout.create({
      plan,
      ...(returnUrl ? { returnUrl } : {}),
    });
    checkout.create("checkout").mount("#whop-checkout");
  }, [ready, plan, returnUrl]);

  return (
    <>
      <div id="whop-checkout" className="min-h-[520px] w-full" />
      <Script
        src="https://cdn.whop.com/elements/amber/elements.js"
        strategy="afterInteractive"
        data-whop-elements=""
        onLoad={() => setReady(true)}
      />
    </>
  );
}
