"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { WHOP_CHECKOUT_PLAN } from "@/lib/site-defaults";

type WhopElement = {
  mount: (selector: string) => void;
};

type WhopCheckoutHandle = {
  create: (
    name: "checkout" | "expressCheckout",
    options?: {
      layout?: "auto" | "horizontal" | "vertical";
      wallets?:
        | ("apple_pay" | "google_pay" | "paypal_express")[]
        | {
            applePay?: "auto" | "never";
            googlePay?: "auto" | "never";
            payPal?: "auto" | "never";
          };
    },
  ) => WhopElement;
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
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && typeof window.WhopElements === "function",
  );

  useEffect(() => {
    if (!ready || typeof window === "undefined" || !window.WhopElements) return;

    const expressTarget = document.querySelector("#whop-express-checkout");
    const checkoutTarget = document.querySelector("#whop-checkout");
    if (!expressTarget || !checkoutTarget) return;

    expressTarget.innerHTML = "";
    checkoutTarget.innerHTML = "";

    const createOptions = {
      plan,
      ...(returnUrl ? { returnUrl } : {}),
    };

    // Separate handle: Apple Pay / Google Pay express buttons.
    window
      .WhopElements()
      .checkout.create(createOptions)
      .create("expressCheckout", {
        layout: "horizontal",
        wallets: { applePay: "auto", googlePay: "auto", payPal: "auto" },
      })
      .mount("#whop-express-checkout");

    // Full checkout form (card + other methods), matching Whop's embed snippet.
    window
      .WhopElements()
      .checkout.create(createOptions)
      .create("checkout")
      .mount("#whop-checkout");

    return () => {
      expressTarget.innerHTML = "";
      checkoutTarget.innerHTML = "";
    };
  }, [ready, plan, returnUrl]);

  return (
    <>
      <div className={className}>
        <div id="whop-express-checkout" className="mb-4 min-h-[48px] w-full" />
        <div id="whop-checkout" className="w-full" />
      </div>
      <Script
        src="https://cdn.whop.com/elements/amber/elements.js"
        strategy="afterInteractive"
        data-whop-elements=""
        onLoad={() => setReady(true)}
      />
    </>
  );
}
