"use client";

import { loadWhop } from "@whop/elements";
import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react";
import { WHOP_CHECKOUT_PLAN } from "@/lib/site-defaults";

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
  return (
    <div className={className}>
      <WhopElements elements={loadWhop()}>
        <Checkout plan={plan} {...(returnUrl ? { returnUrl } : {})}>
          <CheckoutElement />
        </Checkout>
      </WhopElements>
    </div>
  );
}
