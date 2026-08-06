import type { Metadata } from "next";
import { AreaNeighborhoodsGrid } from "@/components/areas/area-neighborhoods-grid";
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
        <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">EXPLORE KIGALI</span>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-navy-800 dark:text-white mt-3 mb-4">
          Neighborhoods We Serve
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed mb-12">
          Find rental homes, furnished apartments, and land by neighborhood. Each area page includes local context and
          current listings to help you search smarter in Kigali.
        </p>
        <AreaNeighborhoodsGrid neighborhoods={neighborhoods} />
      </div>
    </div>
  );
}
