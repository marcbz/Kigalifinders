"use client";

import dynamic from "next/dynamic";
import { SearchBarPlaceholder } from "@/components/search/search-bar-placeholder";

const SearchBar = dynamic(
  () => import("@/components/search/search-bar").then((mod) => mod.SearchBar),
  { ssr: false, loading: () => <SearchBarPlaceholder /> },
);

export function DeferredSearchBar() {
  return <SearchBar />;
}
