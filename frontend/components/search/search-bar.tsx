"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { locationService } from "@/services/api";

const tabs = [
  { id: "rent", label: "For Rent" },
  { id: "sale", label: "For Sale" },
  { id: "plots", label: "Plots/Land" },
];

const sortOptions = [
  { value: "created_at-desc", label: "Newest", sort_by: "created_at", sort_order: "desc" },
  { value: "created_at-asc", label: "Oldest", sort_by: "created_at", sort_order: "asc" },
  { value: "price-asc", label: "Price: Low to High", sort_by: "price", sort_order: "asc" },
  { value: "price-desc", label: "Price: High to Low", sort_by: "price", sort_order: "desc" },
];

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPropertiesPage = pathname === "/properties";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: districts = [] } = useQuery({
    queryKey: ["districts"],
    queryFn: locationService.districts,
  });

  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["property-types"],
    queryFn: locationService.propertyTypes,
  });

  const plotTypeId = propertyTypes.find((pt) => pt.slug === "plot")?.id;

  const [activeTab, setActiveTab] = useState(() => {
    const lt = searchParams.get("listing_type") || "rent";
    if (lt === "sale" && searchParams.get("property_type_id")) return "plots";
    return lt === "furnished" ? "rent" : lt;
  });
  const [districtId, setDistrictId] = useState(searchParams.get("district_id") || "");
  const [propertyTypeId, setPropertyTypeId] = useState(searchParams.get("property_type_id") || "");
  const [bedrooms, setBedrooms] = useState(searchParams.get("bedrooms") || "");
  const [priceRange, setPriceRange] = useState(() => {
    const min = searchParams.get("min_price");
    const max = searchParams.get("max_price");
    if (!min && !max) return "";
    return `${min || ""}-${max || ""}`;
  });
  const [sort, setSort] = useState(() => {
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    return `${sortBy}-${sortOrder}`;
  });

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (activeTab) {
      if (activeTab === "plots") {
        params.set("listing_type", "sale");
      } else {
        params.set("listing_type", activeTab);
      }
    }

    if (districtId) params.set("district_id", districtId);

    let typeId = propertyTypeId;
    if (activeTab === "plots" && !typeId && plotTypeId) {
      typeId = plotTypeId;
    }
    if (typeId) params.set("property_type_id", typeId);

    if (bedrooms) params.set("bedrooms", bedrooms.replace("+", ""));

    if (priceRange) {
      const [min, max] = priceRange.split("-");
      if (min) params.set("min_price", min);
      if (max) params.set("max_price", max);
    }

    const sortOption = sortOptions.find((o) => o.value === sort);
    if (sortOption) {
      params.set("sort_by", sortOption.sort_by);
      params.set("sort_order", sortOption.sort_order);
    }

    return params;
  }, [activeTab, districtId, propertyTypeId, bedrooms, priceRange, sort, plotTypeId]);

  const applySearch = useCallback(
    (immediate = false) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const navigate = () => {
        const params = buildParams();
        const query = params.toString();
        router.push(query ? `/properties?${query}` : "/properties");
      };

      if (immediate) {
        navigate();
      } else {
        debounceRef.current = setTimeout(navigate, 350);
      }
    },
    [buildParams, router],
  );

  useEffect(() => {
    if (!isPropertiesPage) return;
    applySearch();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeTab, districtId, propertyTypeId, bedrooms, priceRange, sort, applySearch, isPropertiesPage]);

  const hasFilters = useMemo(
    () =>
      districtId ||
      propertyTypeId ||
      bedrooms ||
      priceRange ||
      sort !== "created_at-desc" ||
      activeTab !== "rent",
    [districtId, propertyTypeId, bedrooms, priceRange, sort, activeTab],
  );

  const handleReset = () => {
    setActiveTab("rent");
    setDistrictId("");
    setPropertyTypeId("");
    setBedrooms("");
    setPriceRange("");
    setSort("created_at-desc");
    router.push("/properties");
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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4">
          <div>
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">DISTRICT</label>
            <select className="lux-input" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
              <option value="">All Kigali</option>
              {districts.map((d: { id: string; name: string }) => (
                <option key={d.id} value={d.id}>{d.name}</option>
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
          <div>
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">SORT BY</label>
            <select className="lux-input" value={sort} onChange={(e) => setSort(e.target.value)}>
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {isPropertiesPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={!hasFilters}
                className="w-full rounded-md gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            ) : (
              <Button type="button" onClick={() => applySearch(true)} className="w-full rounded-md gap-2">
                <Search className="w-4 h-4" />
                Search
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
