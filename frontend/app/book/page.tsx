import type { Metadata } from "next";
import { WhopCheckout } from "@/components/booking/whop-checkout";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

export const metadata: Metadata = {
  title: "Meeting Reservation Fee",
  description:
    "Reserve a personalized meeting with Kigali Rent for $1.99. We'll help you explore rentals, understand the market, and negotiate with landlords.",
  alternates: { canonical: `${siteUrl}/book` },
  robots: { index: false, follow: true },
};

export default function BookPage() {
  const returnUrl = `${siteUrl}/book?status=complete`;

  return (
    <div className="py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">BOOKING</span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-navy-800 dark:text-white mt-3 mb-6">
            Meeting Reservation Fee
          </h1>
          <div className="text-left text-gray-600 dark:text-gray-400 leading-relaxed space-y-4">
            <p>Found a property that feels like home?</p>
            <p>
              Don&apos;t risk missing the opportunity — or paying more than you should.
            </p>
            <p>
              Kigali&apos;s rental market can be challenging, especially when navigating prices and
              negotiating directly with landlords. Some landlords may be less flexible with foreign
              tenants, making it difficult to secure a fair rental price.
            </p>
            <p>That&apos;s where KigaliRent comes in.</p>
            <p>
              For just $1.99, reserve a personalized meeting with our team. We&apos;ll help you
              explore suitable rental options, understand the local market, and negotiate with
              landlords on your behalf to help you secure a better rental price.
            </p>
            <p>
              Don&apos;t just find a place to live. Find the right home, at the right price, with the
              right people negotiating for you.
            </p>
            <p className="font-semibold text-navy-800 dark:text-white">
              Your next home starts with one meeting.
            </p>
          </div>
        </div>
        <WhopCheckout returnUrl={returnUrl} />
      </div>
    </div>
  );
}
