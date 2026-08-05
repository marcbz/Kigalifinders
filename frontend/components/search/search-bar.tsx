"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locationService } from "@/services/api";

const tabs = [
  { id: "all", label: "All" },
  { id: "rent", label: "For Rent" },
  { id: "sale", label: "For Sale" },
];

function tabFromListingType(lt: string | null): string {
  if (!lt) return "all";
  if (lt === "furnished") return "furnished";
  return lt;
}

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstAutoSearch = useRef(true);
  const skipNextAutoSearch = useRef(0);
  const resetLock = useRef(false);

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: locationService.neighborhoods,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["property-types"],
    queryFn: locationService.propertyTypes,
  });

  const [isResetting, setIsResetting] = useState(false);
  const [activeTab, setActiveTab] = useState(() => tabFromListingType(searchParams.get("listing_type")));
  const [neighborhoodId, setNeighborhoodId] = useState(searchParams.get("neighborhood_id") || "");
  const [propertyTypeId, setPropertyTypeId] = useState(searchParams.get("property_type_id") || "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [priceRange, setPriceRange] = useState(() => {
    const min = searchParams.get("min_price");
    const max = searchParams.get("max_price");
    if (!min && !max) return "";
    return `${min || ""}-${max || ""}`;
  });

  useEffect(() => {
    if (resetLock.current) {
      if (!searchParams.toString()) {
        resetLock.current = false;
        skipNextAutoSearch.current = 2;
        setActiveTab("all");
        setNeighborhoodId("");
        setPropertyTypeId("");
        setBedrooms("");
        setPriceRange("");
        setIsResetting(false);
      }
      return;
    }

    const lt = searchParams.get("listing_type");
    setActiveTab(tabFromListingType(lt));
    setPropertyTypeId(searchParams.get("property_type_id") || "");
    setBedrooms(searchParams.get("bedrooms") || "");
    const min = searchParams.get("min_price");
    const max = searchParams.get("max_price");
    if (!min && !max) setPriceRange("");
    else setPriceRange(`${min || ""}-${max || ""}`);
  }, [searchParams]);

  useEffect(() => {
    if (resetLock.current) return;

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
    const propertyTypeSlug = searchParams.get("property_type_slug");
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
    if (propertyTypeSlug) params.set("property_type_slug", propertyTypeSlug);
    return params;
  }, [activeTab, neighborhoodId, propertyTypeId, bedrooms, priceRange, searchParams]);

  const applySearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = buildParams();
      const query = params.toString();
      router.push(query ? `/properties?${query}` : "/properties");
    }, 350);
  }, [buildParams, router]);

  useEffect(() => {
    if (isHomepage) return;
    if (skipFirstAutoSearch.current) {
      skipFirstAutoSearch.current = false;
      return;
    }
    if (resetLock.current) return;
    if (skipNextAutoSearch.current > 0) {
      skipNextAutoSearch.current -= 1;
      return;
    }
    applySearch();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeTab, neighborhoodId, propertyTypeId, bedrooms, priceRange, applySearch, isHomepage]);

  const handleReset = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsResetting(true);
    resetLock.current = true;
    skipNextAutoSearch.current = 2;
    router.replace("/properties");
  };

  const handleSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const params = buildParams();
    const query = params.toString();
    router.push(query ? `/properties?${query}` : "/properties");
  };

  const handleAction = isHomepage ? handleSearch : handleReset;

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
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">NEIGHBORHOOD</label>
            <select className="lux-input" value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)}>
              <option value="">All neighborhoods</option>
              {neighborhoods.map((n: { id: string; name: string }) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">PROPERTY TYPE</label>
            <select className="lux-input" value={propertyTypeId} onChange={(e) => setPropertyTypeId(e.target.value)}>
              <option value="">Any</option>
              {propertyTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">BEDROOMS</label>
            <select className="lux-input" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
              <option value="">Any</option>
              {["1+", "2+", "3+", "4+", "5+"].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">PRICE RANGE</label>
            <select className="lux-input" value={priceRange} onChange={(e) => setPriceRange(e.target.value)}>
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
              disabled={!isHomepage && isResetting}
              className="w-full rounded-md gap-2"
            >
              {isHomepage ? (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              ) : isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
