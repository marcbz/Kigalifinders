import type { Metadata } from "next";
import { fetchRentalDirectorySafe } from "@/lib/market-api";
import { RentalHubPage } from "@/components/rentals/rental-hub-page";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await fetchRentalDirectorySafe();
  if (!page) return { title: "Kigali Rentals" };
  return {
    title: page.title,
    description: page.meta_description,
    alternates: { canonical: page.canonical || "https://kigalirent.com/rentals" },
    robots: { index: true, follow: true },
  };
}

export default async function RentalsDirectoryPage() {
  const page = await fetchRentalDirectorySafe();
  if (!page) {
    return (
      <div className="p-12 text-center text-gray-500">
        Rental directory is temporarily unavailable. <a href="/properties">Browse properties</a>
      </div>
    );
  }
  return <RentalHubPage data={page} />;
}
