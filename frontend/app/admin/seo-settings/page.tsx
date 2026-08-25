"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Publishing rules live inside SEO & Market Data — keep this path for old bookmarks. */
export default function AdminSeoSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/seo-market?section=search#seo-controls");
  }, [router]);
  return <p className="text-sm text-gray-500 p-6">Redirecting to SEO &amp; Market Data…</p>;
}
