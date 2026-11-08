import type { Metadata } from "next";
import { ServicePaymentPage } from "@/components/booking/service-payment-page";
import { WHOP_SERVICE_PAYMENT_PLAN } from "@/lib/site-defaults";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

export const metadata: Metadata = {
  title: "Service Payment",
  description: "Complete your Kigali Rent service payment securely.",
  robots: { index: false, follow: false, nocache: true },
};

export default function ServicePayPage() {
  const returnUrl = `${siteUrl}/pay?status=complete`;

  return <ServicePaymentPage returnUrl={returnUrl} plan={WHOP_SERVICE_PAYMENT_PLAN} />;
}
