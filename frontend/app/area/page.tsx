import type { Metadata } from "next";
import { NeighborhoodsDirectory } from "@/components/areas/neighborhoods-directory";
import { fetchSearchFilterNeighborhoodsSafe } from "@/lib/server-api";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Kigali Neighborhood Guides",
  description:
    "Area guides for Kibagabaga, Nyarutarama, Kiyovu, and the rest of Kigali — housing, transport, and current Kigali Rent listings.",
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
