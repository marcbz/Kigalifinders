import type { Metadata } from "next";
import { PropertyManagementContent } from "@/features/property-management/property-management-content";
import { pageOpenGraph } from "@/lib/seo-metadata";

export const metadata: Metadata = {
  title: "Property Management in Kigali",
  description:
    "Professional property management in Kigali for landlords — tenant care, maintenance coordination, expense transparency, and two clear management packages from Kigali Rent.",
  alternates: { canonical: "https://kigalirent.com/property-management" },
  openGraph: pageOpenGraph({
    title: "Property Management in Kigali",
    description:
      "Estimate Standard or Comprehensive property management fees and contact Kigali Rent for a personalized agreement.",
    url: "https://kigalirent.com/property-management",
  }),
};

export default function PropertyManagementPage() {
  return <PropertyManagementContent />;
}
