import type { Metadata } from "next";
import { contentService } from "@/services/api";
import { FAQSection } from "@/features/home/content-sections";

export const metadata: Metadata = { title: "FAQ", description: "Frequently asked questions about renting and buying property in Kigali." };

export default async function FAQPage() {
  const faqs = await contentService.faqs().catch(() => []);
  return <FAQSection faqs={faqs} />;
}
