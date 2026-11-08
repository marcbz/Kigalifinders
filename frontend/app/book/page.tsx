import type { Metadata } from "next";
import { WhopCheckout } from "@/components/booking/whop-checkout";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

export const metadata: Metadata = {
  title: "Book a Visit",
  description:
    "Secure your property viewing or consultation with Kigali Rent. Complete checkout to confirm your booking.",
  alternates: { canonical: `${siteUrl}/book` },
  robots: { index: false, follow: true },
};

export default function BookPage() {
  const returnUrl = `${siteUrl}/book?status=complete`;

  return (
    <div className="py-16 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">BOOKING</span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-navy-800 dark:text-white mt-3 mb-3">
            Book a Visit
          </h1>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Complete checkout below to schedule your property viewing or consultation with Kigali Rent.
          </p>
        </div>
        <WhopCheckout returnUrl={returnUrl} />
      </div>
    </div>
  );
}
