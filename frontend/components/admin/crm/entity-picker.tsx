"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { crmApi } from "@/services/crm-api";
import { ChoiceSelect, inputCls, useDebounced, useLookups } from "@/components/admin/crm/ui";

export interface Picked {
  id: string;
  label: string;
}

function AsyncPicker({
  value,
  onChange,
  placeholder,
  search,
  queryKey,
}: {
  value: Picked | null;
  onChange: (v: Picked | null) => void;
  placeholder: string;
  search: (q: string) => Promise<Picked[]>;
  queryKey: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q);
  const { data = [], isFetching } = useQuery({
    queryKey: ["crm", "picker", queryKey, debounced],
    queryFn: () => search(debounced),
    enabled: open,
    staleTime: 30_000,
  });

  if (value) {
    return (
      <div className={`${inputCls} flex items-center justify-between gap-2`}>
        <span className="truncate">{value.label}</span>
        <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => onChange(null)} aria-label="Clear">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className={inputCls}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-white dark:bg-navy-900 shadow-lg text-sm">
          {isFetching && data.length === 0 ? <li className="px-2 py-1.5 text-gray-500">Searching…</li> : null}
          {!isFetching && data.length === 0 ? <li className="px-2 py-1.5 text-gray-500">No matches</li> : null}
          {data.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-navy-700"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setQ("");
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PropertyPicker({ value, onChange }: { value: Picked | null; onChange: (v: Picked | null) => void }) {
  return (
    <AsyncPicker
      value={value}
      onChange={onChange}
      placeholder="Search by KR ref, title, area…"
      queryKey="properties"
      search={async (q) => {
        const res = await crmApi.properties({ q, page_size: 10, sort: "ref", order: "desc" });
        return res.items.map((p) => ({ id: p.id, label: `${p.crm_ref} · ${p.title}` }));
      }}
    />
  );
}

export function LeadPicker({ value, onChange }: { value: Picked | null; onChange: (v: Picked | null) => void }) {
  return (
    <AsyncPicker
      value={value}
      onChange={onChange}
      placeholder="Search client by name or phone…"
      queryKey="leads"
      search={async (q) => {
        const res = await crmApi.leads({ q, page_size: 10 });
        return res.items.map((l) => ({ id: l.id, label: l.phone ? `${l.name} · ${l.phone}` : l.name }));
      }}
    />
  );
}

export function LandlordSelect({ value, onChange, blank = "No landlord" }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data } = useLookups();
  return <ChoiceSelect value={value} onChange={onChange} options={data?.landlords ?? []} blank={blank} />;
}

export function UserSelect({ value, onChange, blank = "Unassigned" }: { value: string; onChange: (v: string) => void; blank?: string }) {
  const { data } = useLookups();
  return <ChoiceSelect value={value} onChange={onChange} options={data?.users ?? []} blank={blank} />;
}
