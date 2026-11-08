import type { Metadata } from "next";
import { BookMeetingPage } from "@/components/booking/book-meeting-page";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kigalirent.com";

export const metadata: Metadata = {
  title: "Meeting Reservation",
  description:
    "Reserve a personalized meeting with Kigali Rent for $1.99. We'll help you explore rentals, understand the market, and negotiate with landlords.",
  alternates: { canonical: `${siteUrl}/book` },
  robots: { index: false, follow: true },
};

export default function BookPage() {
  const returnUrl = `${siteUrl}/book?status=complete`;

  return <BookMeetingPage returnUrl={returnUrl} />;
}
