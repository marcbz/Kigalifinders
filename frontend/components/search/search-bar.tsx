"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const tabs = [
  { id: "rent", label: "For Rent" },
  { id: "furnished", label: "Furnished" },
  { id: "sale", label: "Plots/Land" },
];

export function SearchBar() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("rent");
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [priceRange, setPriceRange] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (activeTab) params.set("listing_type", activeTab);
    if (location) params.set("q", location);
    if (propertyType) params.set("property_type", propertyType);
    if (bedrooms) params.set("bedrooms", bedrooms.replace("+", ""));
    if (priceRange) {
      const [min, max] = priceRange.split("-");
      if (min) params.set("min_price", min);
      if (max) params.set("max_price", max);
    }
    router.push(`/properties?${params.toString()}`);
  };

  return (
    <section className="relative -mt-16 z-30 px-6">
      <div className="max-w-6xl mx-auto search-bar rounded-2xl p-2">
        <div className="flex gap-2 px-4 pt-3 border-b dark:border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">LOCATION</label>
            <select className="lux-input" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All Kigali</option>
              {["Kicukiro", "Gasabo", "Nyarugenge", "Kibagabaga", "Nyarutarama"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] tracking-wider text-gray-500 mb-1 font-semibold">PROPERTY TYPE</label>
            <select className="lux-input" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              <option value="">Any</option>
              {["House", "Apartment", "Villa", "Plot"].map((t) => (
                <option key={t} value={t.toLowerCase()}>{t}</option>
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
            <Button onClick={handleSearch} className="w-full rounded-md">
              <Search className="w-4 h-4" />
              Search
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
