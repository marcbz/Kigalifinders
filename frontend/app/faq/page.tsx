import type { Metadata } from "next";
import { fetchFaqs } from "@/lib/server-api";
import { FAQSection } from "@/features/home/content-sections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about renting and buying property in Kigali.",
};

export default async function FAQPage() {
  const faqs = await fetchFaqs();
  return <FAQSection faqs={faqs} />;
}
