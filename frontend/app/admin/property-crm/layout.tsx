import type { Metadata } from "next";
import { CrmNav } from "@/components/admin/crm/crm-nav";

export const metadata: Metadata = {
  title: { absolute: "Property CRM | KigaliRent Admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function PropertyCrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 max-w-[1500px]">
      <CrmNav />
      {children}
    </div>
  );
}
