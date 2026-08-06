import type { Metadata } from "next";
import { NeighborhoodsDirectory } from "@/components/areas/neighborhoods-directory";
import { fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Kigali Neighborhoods",
  description:
    "Explore Kigali neighborhoods served by Kigali Rent — find rental homes, apartments, and properties by area across Gasabo, Kicukiro, and Nyarugenge.",
  alternates: { canonical: "/area" },
};

export default async function AreaIndexPage() {
  const neighborhoods = await fetchSearchFilterNeighborhoodsSafe();

  return (
    <div className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <NeighborhoodsDirectory neighborhoods={neighborhoods} headingLevel="h1" />
      </div>
    </div>
  );
}
