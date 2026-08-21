"use client";

import dynamic from "next/dynamic";

const RecentlyViewedStrip = dynamic(
  () => import("@/components/property/recently-viewed-strip").then((m) => m.RecentlyViewedStrip),
  { ssr: false },
);

export function RecentlyViewedHomeStrip() {
  return <RecentlyViewedStrip title="Recently viewed" />;
}
