import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchRentalLocationSafe } from "@/lib/market-api";
import { fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";
import { RentalHubPage } from "@/components/rentals/rental-hub-page";

export const revalidate = 300;

interface Props {
  params: Promise<{ location: string }>;
}

export async function generateStaticParams() {
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();
  return [{ location: "kigali" }, ...neighborhoods.map((n) => ({ location: n.slug }))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;
  const page = await fetchRentalLocationSafe(location);
  if (!page) return { title: "Rentals", robots: { index: false } };
  return {
    title: page.title,
    description: page.meta_description,
    alternates: { canonical: page.canonical },
    robots: page.robots?.includes("noindex")
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

export default async function RentalLocationPage({ params }: Props) {
  const { location } = await params;
  const page = await fetchRentalLocationSafe(location);
  if (!page) notFound();
  return <RentalHubPage data={page} />;
}
