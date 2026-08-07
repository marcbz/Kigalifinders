import type { Metadata } from "next";
import { fetchFaqsSafe } from "@/lib/server-api";
import { FAQSection } from "@/features/home/faq-section";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about renting and buying property in Kigali.",
};

export default async function FAQPage() {
  const faqs = await fetchFaqsSafe();
  return <FAQSection faqs={faqs} />;
}
