"use client";

import { useEffect } from "react";
import { scheduleQualifiedView } from "@/lib/qualified-view";

export function TrackBlogView({ slug }: { slug: string }) {
  useEffect(() => scheduleQualifiedView("blog", slug), [slug]);
  return null;
}
