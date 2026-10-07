"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE = "/admin/property-crm";

const LINKS = [
  { href: BASE, label: "Overview" },
  { href: `${BASE}/properties`, label: "Properties" },
  { href: `${BASE}/landlords`, label: "Landlords" },
  { href: `${BASE}/leads`, label: "Clients" },
  { href: `${BASE}/viewings`, label: "Viewings" },
  { href: `${BASE}/deals`, label: "Deals" },
  { href: `${BASE}/commissions`, label: "Commissions" },
  { href: `${BASE}/follow-ups`, label: "Follow-ups" },
  { href: `${BASE}/documents`, label: "Documents" },
  { href: `${BASE}/activity`, label: "Activity" },
  { href: `${BASE}/reports`, label: "Reports" },
];

export function CrmNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-white dark:bg-navy-800 p-1">
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
    </nav>
  );
}
