"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { crmApi } from "@/services/crm-api";

const BASE = "/admin/property-crm";
const PULSE_MS = 20_000;

const LINKS = [
  { href: BASE, label: "Overview" },
  { href: `${BASE}/properties`, label: "Properties" },
  { href: `${BASE}/landlords`, label: "Landlords & managers" },
  { href: `${BASE}/leads`, label: "Clients" },
  { href: `${BASE}/viewings`, label: "Viewings" },
  { href: `${BASE}/deals`, label: "Deals" },
  { href: `${BASE}/commissions`, label: "Commissions" },
  { href: `${BASE}/follow-ups`, label: "Follow-ups" },
  { href: `${BASE}/documents`, label: "Documents" },
  { href: `${BASE}/activity`, label: "Activity" },
  { href: `${BASE}/reports`, label: "Reports" },
];

/**
 * Refresh button plus live updates: polls the newest activity entry and, when someone
 * (in this tab or another) changes anything, reloads every CRM query on the page.
 * The pulse key deliberately does not start with "crm" so invalidating CRM data doesn't loop it.
 */
function LiveRefresh() {
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["crm"] });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const lastSignature = useRef<string | null>(null);
  const pulse = useQuery({
    queryKey: ["crm-pulse"],
    queryFn: () => crmApi.activity({ page_size: 1 }),
    refetchInterval: PULSE_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!pulse.data) return;
    const signature = `${pulse.data.total}:${pulse.data.items[0]?.id ?? ""}`;
    if (lastSignature.current !== null && lastSignature.current !== signature) {
      qc.invalidateQueries({ queryKey: ["crm"] });
    }
    lastSignature.current = signature;
    setUpdatedAt(new Date());
  }, [pulse.data, qc]);

  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["crm"] }), pulse.refetch()]);
    setUpdatedAt(new Date());
  };

  return (
    <div className="ml-auto flex items-center gap-2 pl-2 text-[11px] text-gray-500">
      <span className="hidden sm:inline" title="The CRM checks for changes every 20 seconds and updates automatically">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
        Live{updatedAt ? ` · ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={fetching > 0}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-semibold text-gray-700 dark:text-gray-200 hover:border-navy-800 disabled:opacity-60"
        aria-label="Refresh CRM data"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", fetching > 0 && "animate-spin")} />
        Refresh
      </button>
    </div>
  );
}

export function CrmNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-lg border bg-white dark:bg-navy-800 p-1">
      {LINKS.map(({ href, label }) => {
        const active = href === BASE ? pathname === BASE : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-2.5 py-1 text-[13px] transition",
              active ? "bg-navy-800 text-gold-500 font-semibold" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700",
            )}
          >
            {label}
          </Link>
        );
      })}
      <LiveRefresh />
    </nav>
  );
}
