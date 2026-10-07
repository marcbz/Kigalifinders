"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { crmApi } from "@/services/crm-api";
import { Pagination } from "@/components/ui/pagination";
import {
  ChoiceSelect,
  EmptyRow,
  ErrorText,
  PageHeader,
  SmallButton,
  StatusBadge,
  fmtMoney,
  fmtRelative,
  inputCls,
  linkCls,
  tableCls,
  tdCls,
  thCls,
  useCrmMutation,
  useDebounced,
  useLookups,
} from "@/components/admin/crm/ui";
import { RefLink, propertyHref } from "@/components/admin/crm/panels";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = [
  "q", "availability", "district_id", "neighborhood_id", "landlord_id", "no_landlord", "property_type_id",
  "bedrooms", "min_rent", "max_rent", "published", "verification_due", "sort", "order",
] as const;

const SORTS: { key: string; label: string }[] = [
  { key: "ref", label: "Ref" },
  { key: "title", label: "Property" },
  { key: "location", label: "Location" },
  { key: "landlord", label: "Landlord" },
  { key: "rent", label: "Rent" },
  { key: "bedrooms", label: "Beds" },
  { key: "availability", label: "Availability" },
  { key: "verified", label: "Verified" },
];

function PropertiesInner() {
  const { data: lookups } = useLookups();
  const [f, setF] = useUrlFilters(KEYS);
  const [q, setQ] = useState(f.q);
  const debouncedQ = useDebounced(q);
  useEffect(() => {
    if (debouncedQ !== f.q) setF({ q: debouncedQ });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const sort = f.sort || "ref";
  const order = f.order || "desc";
  const page = Number(f.page) || 1;
  const params = {
    ...f,
    sort,
    order,
    page,
    page_size: 30,
    no_landlord: f.no_landlord === "1",
    verification_due: f.verification_due === "1",
    published: f.published === "" ? undefined : f.published === "1",
  };
  const { data, isFetching, error } = useQuery({
    queryKey: ["crm", "properties", params],
    queryFn: () => crmApi.properties(params),
    placeholderData: keepPreviousData,
  });
  const confirm = useCrmMutation((id: string) => crmApi.confirmAvailable(id));
  const neighborhoods = (lookups?.neighborhoods ?? []).filter((n) => !f.district_id || n.district_id === f.district_id);

  const toggleSort = (key: string) => {
    if (sort === key) setF({ order: order === "asc" ? "desc" : "asc" });
    else setF({ sort: key, order: key === "title" || key === "location" || key === "landlord" ? "asc" : "desc" });
  };
  const hasFilters = KEYS.some((k) => k !== "sort" && k !== "order" && f[k]);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Properties"
        subtitle={
          <>
            Existing KigaliRent listings with CRM data. Availability is independent of publication. Properties not verified for{" "}
            {data?.verify_after_days ?? "…"} days are flagged <b>Verify</b>.
          </>
        }
      />

      <div className="rounded-lg border bg-white dark:bg-navy-800 p-2 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 text-sm">
        <input className={`${inputCls} col-span-2`} placeholder="Search ref, title, landlord, area…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ChoiceSelect value={f.availability} onChange={(v) => setF({ availability: v })} options={lookups?.vocab.availability ?? []} blank="Any availability" />
        <ChoiceSelect value={f.district_id} onChange={(v) => setF({ district_id: v, neighborhood_id: "" })} options={lookups?.districts ?? []} blank="Any district" />
        <ChoiceSelect value={f.neighborhood_id} onChange={(v) => setF({ neighborhood_id: v })} options={neighborhoods} blank="Any area" />
        <ChoiceSelect value={f.property_type_id} onChange={(v) => setF({ property_type_id: v })} options={lookups?.property_types ?? []} blank="Any type" />
        <ChoiceSelect
          value={f.no_landlord === "1" ? "__none" : f.landlord_id}
          onChange={(v) => setF(v === "__none" ? { landlord_id: "", no_landlord: "1" } : { landlord_id: v, no_landlord: "" })}
          options={[{ id: "__none", name: "— No landlord linked —" }, ...(lookups?.landlords ?? [])]}
          blank="Any landlord"
        />
        <ChoiceSelect
          value={f.bedrooms}
          onChange={(v) => setF({ bedrooms: v })}
          options={["0", "1", "2", "3", "4", "5"]}
          labels={(v) => (v === "0" ? "Studio" : v === "5" ? "5+ beds" : `${v} bed`)}
          blank="Any beds"
        />
        <input className={inputCls} type="number" min={0} placeholder="Min rent (USD)" defaultValue={f.min_rent}
          onBlur={(e) => setF({ min_rent: e.target.value })} />
        <input className={inputCls} type="number" min={0} placeholder="Max rent (USD)" defaultValue={f.max_rent}
          onBlur={(e) => setF({ max_rent: e.target.value })} />
        <ChoiceSelect
          value={f.published}
          onChange={(v) => setF({ published: v })}
          options={[{ id: "1", name: "Published" }, { id: "0", name: "Not published" }]}
          blank="Any publication"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={f.verification_due === "1"} onChange={(e) => setF({ verification_due: e.target.checked ? "1" : "" })} />
          Verification due
        </label>
        {hasFilters ? (
          <SmallButton
            variant="ghost"
            onClick={() => {
              setQ("");
              setF(Object.fromEntries(KEYS.filter((k) => k !== "sort" && k !== "order").map((k) => [k, ""])));
            }}
          >
            Clear filters
          </SmallButton>
        ) : null}
      </div>

      <ErrorText error={error || confirm.error} />
      <div className={`rounded-lg border bg-white dark:bg-navy-800 overflow-x-auto ${isFetching ? "opacity-70" : ""}`}>
        <table className={tableCls}>
          <thead>
            <tr>
              {SORTS.map((s) => (
                <th key={s.key} className={thCls}>
                  <button type="button" className="inline-flex items-center gap-0.5 hover:text-navy-800" onClick={() => toggleSort(s.key)}>
                    {s.label}
                    {sort === s.key ? order === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> : null}
                  </button>
                </th>
              ))}
              <th className={thCls}>Published</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 ? <EmptyRow cols={10} text="No properties match these filters." /> : null}
            {data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/40">
                <td className={`${tdCls} whitespace-nowrap`}>
                  <Link href={propertyHref(p.id)} className={linkCls}>{p.crm_ref}</Link>
                </td>
                <td className={`${tdCls} max-w-[280px]`}>
                  <Link href={propertyHref(p.id)} className="hover:underline line-clamp-1">{p.title}</Link>
                  <span className="text-[11px] text-gray-500">{p.property_type_name || "—"}</span>
                </td>
                <td className={`${tdCls} text-[12px]`}>
                  {p.neighborhood_name || "—"}
                  <span className="block text-gray-500">{p.district_name}</span>
                </td>
                <td className={`${tdCls} text-[12px]`}><RefLink id={p.landlord_id} label={p.landlord_name} kind="landlord" /></td>
                <td className={`${tdCls} whitespace-nowrap tabular-nums`}>
                  {fmtMoney(p.price, p.currency)}
                  {p.currency !== "USD" && p.usd_price ? <span className="block text-[11px] text-gray-500">≈ {fmtMoney(p.usd_price, "USD")}</span> : null}
                </td>
                <td className={`${tdCls} tabular-nums`}>{p.bedrooms ?? "—"}</td>
                <td className={tdCls}>
                  <StatusBadge value={p.availability_status} />
                  {p.verification_due && p.availability_status !== "VERIFY" ? <span className="ml-1 text-[11px] text-amber-700">due</span> : null}
                </td>
                <td className={`${tdCls} whitespace-nowrap text-[12px] ${p.verification_due ? "text-amber-700" : "text-gray-600"}`}>
                  {fmtRelative(p.availability_verified_at)}
                </td>
                <td className={`${tdCls} text-[12px]`}>
                  {p.published ? (
                    p.public_url ? (
                      <a href={p.public_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline">
                        Live <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : "Live"
                  ) : (
                    <span className="text-gray-500 capitalize">{p.publication_status}</span>
                  )}
                </td>
                <td className={`${tdCls} text-right whitespace-nowrap`}>
                  {p.availability_status !== "AVAILABLE" || p.verification_due ? (
                    <SmallButton disabled={confirm.isPending} onClick={() => confirm.mutate(p.id)} title="Confirm available">
                      ✓ Available
                    </SmallButton>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data ? (
          <div className="flex items-center justify-between px-3 text-xs text-gray-500">
            <span>{data.total} properties</span>
            <Pagination page={page} totalPages={data.pages} onPageChange={(p) => setF({ page: String(p) })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CrmPropertiesPage() {
  return (
    <Suspense fallback={null}>
      <PropertiesInner />
    </Suspense>
  );
}
