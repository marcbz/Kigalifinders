"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Mail,
  Shield,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { locationService } from "@/services/api";
import {
  DEFAULT_COMPREHENSIVE_EXPENSES,
  DEFAULT_RENT,
  SUGGESTED_RENT_MAX,
  SUGGESTED_RENT_MIN,
  comprehensivePackageTotal,
  formatUsd,
  monthlyManagementFee,
  placementCommission,
  scaleByPropertyCount,
  type ComprehensiveExpenses,
  type PackageId,
} from "@/lib/property-management";

const WHATSAPP = "250784806641";
const EMAIL = "support@kigalirent.com";

const STANDARD_SERVICES = [
  "Tenant communication",
  "Rent follow-ups",
  "Property inspections",
  "Cleaning coordination",
  "Security coordination",
  "Maintenance coordination",
  "Monthly reporting",
] as const;

const EXPENSE_FIELDS: { key: keyof ComprehensiveExpenses; label: string }[] = [
  { key: "cleaning", label: "Cleaning" },
  { key: "security", label: "Security" },
  { key: "water", label: "Water" },
  { key: "electricity", label: "Electricity" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "buffer", label: "Operating buffer" },
];

type District = { id: string; name: string };
type Neighborhood = { id: string; name: string; district_name?: string };
type PropertyType = { id: string; name: string };

function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-gray-500 tracking-wide uppercase">{children}</label>;
}

export function PropertyManagementContent() {
  const [rentInput, setRentInput] = useState(String(DEFAULT_RENT));
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [furnished, setFurnished] = useState("");
  const [propertyCount, setPropertyCount] = useState("1");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<PackageId>("standard");
  const [expenses, setExpenses] = useState<ComprehensiveExpenses>({ ...DEFAULT_COMPREHENSIVE_EXPENSES });

  const { data: districts = [] } = useQuery({
    queryKey: ["pm-districts"],
    queryFn: () => locationService.districts() as Promise<District[]>,
    staleTime: 5 * 60_000,
  });
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["pm-neighborhoods"],
    queryFn: () => locationService.neighborhoods() as Promise<Neighborhood[]>,
    staleTime: 5 * 60_000,
  });
  const { data: propertyTypes = [] } = useQuery({
    queryKey: ["pm-property-types"],
    queryFn: () => locationService.propertyTypes() as Promise<PropertyType[]>,
    staleTime: 5 * 60_000,
  });

  const monthlyRent = parseMoneyInput(rentInput);
  const count = Math.max(1, Math.floor(parseMoneyInput(propertyCount) || 1));
  const managementFeePerProperty = monthlyManagementFee(monthlyRent);
  const placementPerProperty = placementCommission(monthlyRent);
  const managementFeeTotal = scaleByPropertyCount(managementFeePerProperty, count);
  const placementTotal = scaleByPropertyCount(placementPerProperty, count);
  const comprehensivePerProperty = comprehensivePackageTotal(managementFeePerProperty, expenses);
  const comprehensiveTotal = scaleByPropertyCount(comprehensivePerProperty, count);

  const selectedDistrictName = districts.find((d) => d.id === districtId)?.name || "";
  const filteredNeighborhoods = useMemo(
    () =>
      neighborhoods.filter(
        (n) => !districtId || !selectedDistrictName || n.district_name === selectedDistrictName,
      ),
    [neighborhoods, districtId, selectedDistrictName],
  );
  const selectedNeighborhoodName =
    filteredNeighborhoods.find((n) => n.id === neighborhoodId)?.name || "";
  const selectedTypeName = propertyTypes.find((t) => t.id === propertyType)?.name || propertyType;

  const whatsappHref = useMemo(() => {
    const lines = [
      "Hello Kigali Rent — I'm interested in property management.",
      "",
      `Selected package: ${selectedPackage === "standard" ? "Standard" : "Comprehensive"}`,
      monthlyRent > 0 ? `Monthly rent: ${formatUsd(monthlyRent)}` : null,
      selectedTypeName ? `Property type: ${selectedTypeName}` : null,
      bedrooms ? `Bedrooms: ${bedrooms}` : null,
      bathrooms ? `Bathrooms: ${bathrooms}` : null,
      selectedDistrictName ? `District: ${selectedDistrictName}` : null,
      selectedNeighborhoodName ? `Neighborhood: ${selectedNeighborhoodName}` : null,
      furnished ? `Furnishing: ${furnished}` : null,
      `Number of properties: ${count}`,
      "",
      selectedPackage === "standard"
        ? `Estimated monthly management fee: ${formatUsd(managementFeeTotal)} (${formatUsd(managementFeePerProperty)} / property, 10% of rent with ${formatUsd(75)} minimum)`
        : `Estimated comprehensive monthly package: ${formatUsd(comprehensiveTotal)} (${formatUsd(comprehensivePerProperty)} / property)`,
      `One-time placement commission (estimate): ${formatUsd(placementTotal)}`,
    ];
    if (selectedPackage === "comprehensive") {
      lines.push(
        "",
        "Expense budget (editable estimate):",
        `• Management fee: ${formatUsd(managementFeePerProperty)}`,
        ...EXPENSE_FIELDS.map(
          (f) => `• ${f.label}: ${formatUsd(expenses[f.key])}`,
        ),
      );
    }
    if (additionalInfo.trim()) {
      lines.push("", `Additional information: ${additionalInfo.trim()}`);
    }
    lines.push("", "Please share a personalized management agreement.");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.filter((l) => l !== null).join("\n"))}`;
  }, [
    selectedPackage,
    monthlyRent,
    selectedTypeName,
    bedrooms,
    bathrooms,
    selectedDistrictName,
    selectedNeighborhoodName,
    furnished,
    count,
    managementFeeTotal,
    managementFeePerProperty,
    comprehensiveTotal,
    comprehensivePerProperty,
    placementTotal,
    expenses,
    additionalInfo,
  ]);

  const updateExpense = (key: keyof ComprehensiveExpenses, raw: string) => {
    setExpenses((prev) => ({ ...prev, [key]: parseMoneyInput(raw) }));
  };

  return (
    <>
      <div className="bg-navy-800 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">OWNERS</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mt-3">
            Professional Property Management in Kigali
          </h1>
          <p className="text-gray-300 mt-5 max-w-2xl mx-auto leading-relaxed">
            Kigali Rent helps landlords manage tenants, coordinate cleaning and security, monitor
            property expenses, arrange maintenance, and receive regular updates — including when you
            live abroad.
          </p>
        </div>
      </div>

      <section className="py-14 px-6 bg-cream/60 dark:bg-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                title: "Tenant & rent care",
                text: "Communication, follow-ups, and coordination so your rental stays occupied and managed.",
              },
              {
                icon: Wrench,
                title: "Maintenance & services",
                text: "Cleaning, security, and repairs coordinated with clear owner visibility.",
              },
              {
                icon: ClipboardList,
                title: "Updates you can trust",
                text: "Monthly reporting and expense transparency — whether you are in Kigali or overseas.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border bg-white dark:bg-card p-6">
                <item.icon className="w-8 h-8 text-gold-500 mb-3" />
                <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white">{item.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6" id="calculator">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">ESTIMATE</span>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-navy-800 dark:text-white mt-3">
              Property management calculator
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-2xl mx-auto">
              Enter what you know about your property. All fields are optional — estimates update as
              you type.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-card p-6 space-y-4">
              <div>
                <FieldLabel>Monthly rental price (USD)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step={50}
                  className="lux-input mt-1"
                  value={rentInput}
                  onChange={(e) => setRentInput(e.target.value)}
                  placeholder="e.g. 600"
                />
                <input
                  type="range"
                  min={SUGGESTED_RENT_MIN}
                  max={SUGGESTED_RENT_MAX}
                  step={50}
                  value={Math.min(
                    SUGGESTED_RENT_MAX,
                    Math.max(SUGGESTED_RENT_MIN, monthlyRent || DEFAULT_RENT),
                  )}
                  onChange={(e) => setRentInput(e.target.value)}
                  className="w-full mt-3 accent-[#c9a961]"
                  aria-label="Suggested monthly rent range"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Suggested range ${SUGGESTED_RENT_MIN.toLocaleString()}–$
                  {SUGGESTED_RENT_MAX.toLocaleString()}. Type any amount above or below that range.
                </p>
              </div>

              <div>
                <FieldLabel>Property type</FieldLabel>
                <select
                  className="lux-input mt-1"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                >
                  <option value="">Select (optional)</option>
                  {propertyTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {!propertyTypes.length ? (
                    <>
                      <option value="Apartment">Apartment</option>
                      <option value="House">House</option>
                      <option value="Villa">Villa</option>
                    </>
                  ) : null}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Bedrooms</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="lux-input mt-1"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <FieldLabel>Bathrooms</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="lux-input mt-1"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>District</FieldLabel>
                <select
                  className="lux-input mt-1"
                  value={districtId}
                  onChange={(e) => {
                    setDistrictId(e.target.value);
                    setNeighborhoodId("");
                  }}
                >
                  <option value="">Select (optional)</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Neighborhood</FieldLabel>
                <select
                  className="lux-input mt-1"
                  value={neighborhoodId}
                  onChange={(e) => setNeighborhoodId(e.target.value)}
                >
                  <option value="">Select (optional)</option>
                  {filteredNeighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Furnished or unfurnished</FieldLabel>
                <select
                  className="lux-input mt-1"
                  value={furnished}
                  onChange={(e) => setFurnished(e.target.value)}
                >
                  <option value="">Select (optional)</option>
                  <option value="Furnished">Furnished</option>
                  <option value="Unfurnished">Unfurnished</option>
                </select>
              </div>

              <div>
                <FieldLabel>Number of properties</FieldLabel>
                <input
                  type="number"
                  min={1}
                  className="lux-input mt-1"
                  value={propertyCount}
                  onChange={(e) => setPropertyCount(e.target.value)}
                />
              </div>

              <div>
                <FieldLabel>Additional information</FieldLabel>
                <textarea
                  className="lux-input mt-1 min-h-[100px]"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Access notes, preferred services, timeline…"
                />
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedPackage("standard")}
                  className={`text-left rounded-2xl border p-5 transition ${
                    selectedPackage === "standard"
                      ? "border-gold-500 ring-2 ring-gold-500/40 bg-white dark:bg-card"
                      : "bg-white dark:bg-card hover:border-gold-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold tracking-wider text-gold-600">OPTION 1</span>
                    {selectedPackage === "standard" ? (
                      <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0" />
                    ) : null}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white">
                    Standard Property Management
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    10% of monthly rent, with a minimum monthly management fee of {formatUsd(75)}.
                  </p>
                  <p className="mt-4 text-2xl font-bold text-navy-800 dark:text-white">
                    {formatUsd(managementFeeTotal)}
                    <span className="text-sm font-normal text-gray-500"> / month</span>
                  </p>
                  {count > 1 ? (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatUsd(managementFeePerProperty)} × {count} properties
                    </p>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPackage("comprehensive")}
                  className={`text-left rounded-2xl border p-5 transition ${
                    selectedPackage === "comprehensive"
                      ? "border-gold-500 ring-2 ring-gold-500/40 bg-white dark:bg-card"
                      : "bg-white dark:bg-card hover:border-gold-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold tracking-wider text-gold-600">OPTION 2</span>
                    {selectedPackage === "comprehensive" ? (
                      <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0" />
                    ) : null}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-navy-800 dark:text-white">
                    Comprehensive Property Management
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Bundled monthly estimate including management and an agreed budget for routine
                    property expenses.
                  </p>
                  <p className="mt-4 text-2xl font-bold text-navy-800 dark:text-white">
                    {formatUsd(comprehensiveTotal)}
                    <span className="text-sm font-normal text-gray-500"> / month</span>
                  </p>
                  {count > 1 ? (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatUsd(comprehensivePerProperty)} × {count} properties
                    </p>
                  ) : null}
                </button>
              </div>

              {selectedPackage === "standard" ? (
                <div className="rounded-2xl border bg-white dark:bg-card p-6 space-y-4">
                  <h4 className="font-serif text-lg font-bold text-navy-800 dark:text-white">
                    Standard package details
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    For a {formatUsd(monthlyRent || DEFAULT_RENT)} apartment example:
                  </p>
                  <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
                    <li>
                      One-time tenant placement commission:{" "}
                      <strong>{formatUsd(placementPerProperty)}</strong> (10% of the first
                      month&apos;s rent)
                      {count > 1 ? ` · ${formatUsd(placementTotal)} for ${count} properties` : ""}.
                    </li>
                    <li>
                      Recurring monthly management fee:{" "}
                      <strong>{formatUsd(managementFeePerProperty)}</strong>
                      {count > 1 ? ` · ${formatUsd(managementFeeTotal)} total` : ""}.
                    </li>
                    <li>
                      Cleaning, security, utilities and repairs are paid separately by the owner or
                      responsible party.
                    </li>
                  </ul>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Services included
                    </p>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {STANDARD_SERVICES.map((service) => (
                        <li key={service} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <CheckCircle2 className="w-4 h-4 text-gold-500 shrink-0" />
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border bg-white dark:bg-card p-6 space-y-4">
                  <h4 className="font-serif text-lg font-bold text-navy-800 dark:text-white">
                    Comprehensive package — editable budget
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Illustrative starting figures (based on a $600 apartment). Edit each line to match
                    your property — the total recalculates automatically. This is not a fixed price.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="py-2 pr-3 font-semibold">Item</th>
                          <th className="py-2 text-right font-semibold">Amount (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100 dark:border-navy-800">
                          <td className="py-3 pr-3 text-gray-700 dark:text-gray-300">
                            KigaliRent management fee
                            <span className="block text-xs text-gray-400">
                              10% of rent, min {formatUsd(75)}
                            </span>
                          </td>
                          <td className="py-3 text-right font-semibold text-navy-800 dark:text-white">
                            {formatUsd(managementFeePerProperty)}
                          </td>
                        </tr>
                        {EXPENSE_FIELDS.map((field) => (
                          <tr key={field.key} className="border-b border-gray-100 dark:border-navy-800">
                            <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">{field.label}</td>
                            <td className="py-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="lux-input w-28 ml-auto text-right py-1.5"
                                value={expenses[field.key]}
                                onChange={(e) => updateExpense(field.key, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td className="py-3 pr-3 font-serif font-bold text-navy-800 dark:text-white">
                            Total monthly package
                            {count > 1 ? (
                              <span className="block text-xs font-sans font-normal text-gray-500">
                                per property · {formatUsd(comprehensiveTotal)} for {count}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 text-right font-serif text-xl font-bold text-navy-800 dark:text-white">
                            {formatUsd(comprehensivePerProperty)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-5">
                <h4 className="font-serif text-lg font-bold text-navy-800 dark:text-white mb-2">
                  One-time tenant placement commission
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <code className="text-gold-700 dark:text-gold-400 font-semibold">10% × first month&apos;s rent</code>
                  {" = "}
                  <strong>{formatUsd(placementPerProperty)}</strong>
                  {monthlyRent > 0 ? ` for ${formatUsd(monthlyRent)} rent` : ""}.
                  {count > 1 ? ` (${formatUsd(placementTotal)} for ${count} properties.)` : ""}{" "}
                  Payable once after successful tenant placement, subject to agreement. This is not a
                  recurring monthly charge.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-navy-800 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-7 h-7 text-gold-500" />
            <h2 className="font-serif text-3xl font-bold">Transparent expense management</h2>
          </div>
          <ul className="space-y-3 text-gray-200 leading-relaxed">
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              The owner approves the operating budget before services begin.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              Routine expenses within the approved budget can be handled by Kigali Rent without
              requesting approval for every payment.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              The owner provides operating funds in advance.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              Expenses above the agreed budget require approval.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              Major repairs require approval before work begins, except under an agreed emergency
              procedure.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              Kigali Rent provides monthly expense reports and receipts.
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
              Property expenses are separate from Kigali Rent&apos;s management income.
            </li>
          </ul>
          <p className="text-sm text-gray-400 mt-6 leading-relaxed">
            Kigali Rent coordinates and reports on property expenses using the owner&apos;s approved
            budget and prepaid operating funds. We do not cover unlimited property costs from our own
            pocket.
          </p>
        </div>
      </section>

      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-6">
          <p className="text-sm text-amber-950 dark:text-amber-100 leading-relaxed">
            <strong>Disclaimer:</strong> All prices and expense breakdowns are estimates for
            discussion purposes only, not final quotations or contractual commitments. Actual
            management fees and operating budgets will depend on the property, services required and
            agreed responsibilities. Final prices, budgets and spending limits will be confirmed with
            the property owner before management begins.
          </p>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-gold-500 tracking-[0.3em] text-xs font-semibold">NEXT STEP</span>
          <h2 className="font-serif text-3xl font-bold text-navy-800 dark:text-white mt-3 mb-3">
            Discuss a personalized agreement
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Share your property details and preferred package — we&apos;ll follow up with a clear
            management proposal.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="rounded-full gap-2">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="w-5 h-5" />
                WhatsApp +250 784 806 641
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full gap-2">
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Property management inquiry")}`}>
                <Mail className="w-5 h-5" />
                {EMAIL}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
