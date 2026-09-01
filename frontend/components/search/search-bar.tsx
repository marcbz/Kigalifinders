"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locationService } from "@/services/api";
import { neighborhoodsForSearchFilter, neighborhoodFilterLabel } from "@/lib/neighborhood-groups";
import type { PropertyType } from "@/types";

const tabs = [
  { id: "all", label: "All" },
  { id: "rent", label: "For Rent" },
  { id: "sale", label: "For Sale" },
];

function tabFromListingType(lt: string | null): string {
  if (!lt) return "all";
  if (lt === "furnished") return "rent";
  return lt;
}

function parsePriceRange(min: string | null, max: string | null) {
  if (!min && !max) return "";
  return `${min || ""}-${max || ""}`;
}

function resolvePropertyTypeId(
  propertyTypes: PropertyType[],
  typeId: string | null,
  typeSlug: string | null,
): string {
  if (typeId) return typeId;
  if (typeSlug) {
    return propertyTypes.find((pt) => pt.slug === typeSlug)?.id || "";
  }
  return "";
}

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const searchParams = useSearchParams();

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: locationService.neighborhoods,
    staleTime: 10 * 60 * 1000,
  });

  const searchNeighborhoods = neighborhoodsForSearchFilter(
    neighborhoods as { id: string; name: string; slug: string; property_count: number }[],
  );

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["property-types"],
    queryFn: locationService.propertyTypes,
    staleTime: 10 * 60 * 1000,
  });

  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<"Searching..." | "Resetting...">("Searching...");
  const [activeTab, setActiveTab] = useState(() => tabFromListingType(searchParams.get("listing_type")));
  const [neighborhoodId, setNeighborhoodId] = useState(searchParams.get("neighborhood_id") || "");
  const [propertyTypeId, setPropertyTypeId] = useState(
    () =>
      resolvePropertyTypeId(
        [],
        searchParams.get("property_type_id"),
        searchParams.get("property_type_slug"),
      ),
  );
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [priceRange, setPriceRange] = useState(() =>
    parsePriceRange(searchParams.get("min_price"), searchParams.get("max_price")),
  );

  useEffect(() => {
    setActiveTab(tabFromListingType(searchParams.get("listing_type")));
    setPropertyTypeId(
      resolvePropertyTypeId(
        propertyTypes,
        searchParams.get("property_type_id"),
        searchParams.get("property_type_slug"),
      ),
    );
    setBedrooms(searchParams.get("bedrooms") || "");
    setPriceRange(parsePriceRange(searchParams.get("min_price"), searchParams.get("max_price")));
  }, [searchParams, propertyTypes]);

  useEffect(() => {
    const slug = searchParams.get("neighborhood_slug");
    if (slug && neighborhoods.length) {
      const match = neighborhoods.find((n: { slug: string }) => n.slug === slug);
      if (match) setNeighborhoodId(match.id);
    } else if (!slug) {
      setNeighborhoodId(searchParams.get("neighborhood_id") || "");
    }
  }, [searchParams, neighborhoods]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (activeTab && activeTab !== "all") {
      params.set("listing_type", activeTab);
    }
    if (neighborhoodId) params.set("neighborhood_id", neighborhoodId);
    if (propertyTypeId) params.set("property_type_id", propertyTypeId);
    if (bedrooms) params.set("bedrooms", bedrooms.replace("+", ""));
    if (priceRange) {
      const [min, max] = priceRange.split("-");
      if (min) params.set("min_price", min);
      if (max) params.set("max_price", max);
    }
    return params;
  }, [activeTab, neighborhoodId, propertyTypeId, bedrooms, priceRange]);

  const urlHasFilters = useMemo(() => {
    return Boolean(
      searchParams.get("listing_type") ||
        searchParams.get("neighborhood_id") ||
        searchParams.get("neighborhood_slug") ||
        searchParams.get("property_type_id") ||
        searchParams.get("property_type_slug") ||
        searchParams.get("bedrooms") ||
        searchParams.get("min_price") ||
        searchParams.get("max_price"),
    );
  }, [searchParams]);

  const filtersDirty = useMemo(() => {
    const urlTab = tabFromListingType(searchParams.get("listing_type"));
    const urlNeighborhoodFromId = searchParams.get("neighborhood_id") || "";
    const urlSlug = searchParams.get("neighborhood_slug");
    const urlNeighborhood =
      urlNeighborhoodFromId ||
      (urlSlug
        ? (neighborhoods as { id: string; slug: string }[]).find((n) => n.slug === urlSlug)?.id || ""
        : "");
    const urlType = resolvePropertyTypeId(
      propertyTypes,
      searchParams.get("property_type_id"),
      searchParams.get("property_type_slug"),
    );
    const urlBeds = searchParams.get("bedrooms") || "";
    const urlPrice = parsePriceRange(searchParams.get("min_price"), searchParams.get("max_price"));
    const localBeds = bedrooms.replace("+", "");
    return (
      activeTab !== urlTab ||
      neighborhoodId !== urlNeighborhood ||
      propertyTypeId !== urlType ||
      localBeds !== urlBeds ||
      priceRange !== urlPrice
    );
  }, [activeTab, neighborhoodId, propertyTypeId, bedrooms, priceRange, searchParams, neighborhoods, propertyTypes]);

  /** On listings: Search until filters are applied; then Reset (unless user changed filters again). */
  const showReset = !isHomepage && urlHasFilters && !filtersDirty;

  const runAction = (label: "Searching..." | "Resetting...", action: () => void) => {
    setBusyLabel(label);
    setIsBusy(true);
    action();
    setIsBusy(false);
  };

  const handleReset = () => {
    runAction("Resetting...", () => {
      setActiveTab("all");
      setNeighborhoodId("");
      setPropertyTypeId("");
      setBedrooms("");
      setPriceRange("");
      router.replace("/properties");
    });
  };

  const handleSearch = () => {
    runAction("Searching...", () => {
      const params = buildParams();
      const query = params.toString();
      router.push(query ? `/properties?${query}` : "/properties");
    });
  };

  const handleAction = () => {
    if (isBusy) return;
    if (isHomepage) {
      handleSearch();
      return;
    }
    if (showReset) handleReset();
    else handleSearch();
  };

  return (
    <section className="relative -mt-16 z-30 px-6">
      <div className="max-w-6xl mx-auto search-bar rounded-2xl p-2">
        <div className="flex gap-2 px-4 pt-3 border-b dark:border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-t-md text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-navy-800 text-gold-500"
                  : "text-navy-800 dark:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4">
          <div>
            <label htmlFor="search-neighborhood" className="block text-[11px] tracking-wider text-gray-600 mb-1 font-semibold">NEIGHBORHOOD</label>
            <select id="search-neighborhood" className="lux-input" value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)}>
              <option value="">All neighborhoods</option>
              {searchNeighborhoods.map((n: { id: string; name: string; slug: string }) => (
                <option key={n.id} value={n.id}>{neighborhoodFilterLabel(n.name, n.slug)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-property-type" className="block text-[11px] tracking-wider text-gray-600 mb-1 font-semibold">PROPERTY TYPE</label>
            <select id="search-property-type" className="lux-input" value={propertyTypeId} onChange={(e) => setPropertyTypeId(e.target.value)}>
              <option value="">Any</option>
              {propertyTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-bedrooms" className="block text-[11px] tracking-wider text-gray-600 mb-1 font-semibold">BEDROOMS</label>
            <select id="search-bedrooms" className="lux-input" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
              <option value="">Any</option>
              {["1+", "2+", "3+", "4+", "5+"].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search-price" className="block text-[11px] tracking-wider text-gray-600 mb-1 font-semibold">PRICE RANGE</label>
            <select id="search-price" className="lux-input" value={priceRange} onChange={(e) => setPriceRange(e.target.value)}>
              <option value="">Any</option>
              <option value="0-500">Under $500</option>
              <option value="500-1500">$500 - $1,500</option>
              <option value="1500-5000">$1,500 - $5,000</option>
              <option value="5000-">$5,000+</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleAction}
              disabled={isBusy}
              className="w-full rounded-md gap-2"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {busyLabel}
                </>
              ) : showReset ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
