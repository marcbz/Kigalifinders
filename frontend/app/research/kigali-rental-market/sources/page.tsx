import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Data Sources | Kigali Rental Market Research",
  alternates: { canonical: "https://kigalirent.com/research/kigali-rental-market/methodology" },
};

/** Sources live under methodology — keep this path for old links. */
export default function SourcesPage() {
  redirect("/research/kigali-rental-market/methodology");
}
