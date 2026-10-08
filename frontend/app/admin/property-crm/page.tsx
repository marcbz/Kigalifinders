"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { crmApi } from "@/services/crm-api";
import { Shimmer } from "@/components/ui/shimmer";
import {
  Card,
  ErrorText,
  KpiCard,
  PageHeader,
  SmallButton,
  StatusBadge,
  fmtDate,
  fmtMoney,
  fmtRelative,
  humanize,
  inputCls,
  linkCls,
  useCrmMutation,
} from "@/components/admin/crm/ui";
import { ActivityList, DealsTable, FollowUpsTable, ViewingsTable, leadHref, propertyHref } from "@/components/admin/crm/panels";
import { LandlordFormModal, LeadFormModal } from "@/components/admin/crm/forms";

const CRM = "/admin/property-crm";

function VerifySetting() {
  const { data } = useQuery({ queryKey: ["crm", "settings"], queryFn: crmApi.settings });
  const [days, setDays] = useState("");
  useEffect(() => {
    if (data) setDays(String(data.verify_after_days));
  }, [data]);
  const m = useCrmMutation(() => crmApi.saveSettings({ verify_after_days: Number(days) }));
  return (
    <form
      className="flex shrink-0 items-center gap-2 text-xs text-gray-600 whitespace-nowrap"
      title="If a property's availability hasn't been confirmed within this many days, it is marked Verify so you remember to call the landlord or manager."
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(undefined);
      }}
    >
      <span>Re-check availability every</span>
      <input className={`${inputCls.replace("w-full", "")} w-16 shrink-0 py-1 text-center`} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days between availability checks" />
      <span>days</span>
      <SmallButton type="submit" disabled={m.isPending || !data || Number(days) === data.verify_after_days}>Save</SmallButton>
      <ErrorText error={m.error} />
    </form>
  );
}

export default function PropertyCrmDashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["crm", "dashboard"], queryFn: crmApi.dashboard });
  const [modal, setModal] = useState<"landlord" | "manager" | "lead" | null>(null);
  const k = data?.kpis;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Property CRM"
        subtitle="Internal only. Landlords, availability, clients, viewings, deals and commissions."
        actions={
          <>
            <VerifySetting />
            <SmallButton onClick={() => setModal("landlord")}>+ Landlord</SmallButton>
            <SmallButton onClick={() => setModal("manager")}>+ Property manager</SmallButton>
            <SmallButton variant="primary" onClick={() => setModal("lead")}>+ Client</SmallButton>
          </>
        }
      />
      <ErrorText error={error} />

      {isLoading || !k ? (
        <Shimmer className="h-28 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            <KpiCard label="Landlords" value={k.landlords_total} hint={`${k.landlords_active} active`} />
            <KpiCard label="Properties" value={k.properties_total} />
            <KpiCard label="Available" value={k.available} tone="good" />
            <KpiCard label="Verify" value={k.verify} tone={k.verify ? "warn" : undefined} hint={<Link className="hover:underline" href={`${CRM}/properties?availability=VERIFY`}>review →</Link>} />
            <KpiCard label="Reserved" value={k.reserved} />
            <KpiCard label="Rented" value={k.rented} />
            <KpiCard label="Unavailable" value={k.unavailable} />
            <KpiCard label="Active clients" value={k.leads_active} />
            <KpiCard label="Viewings today" value={k.viewings_today} />
            <KpiCard label="Deals this month" value={k.deals_this_month} tone={k.deals_this_month ? "good" : undefined} />
            <KpiCard label="Commission earned" value={fmtMoney(k.commission_earned_usd, "USD")} hint="paid, all time" tone="good" />
            <KpiCard label="Commission pending" value={fmtMoney(k.commission_pending_usd, "USD")} />
            <KpiCard
              label="Follow-ups due"
              value={k.follow_ups_due}
              tone={k.follow_ups_overdue ? "bad" : k.follow_ups_due ? "warn" : undefined}
              hint={k.follow_ups_overdue ? `${k.follow_ups_overdue} overdue` : "today"}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Properties needing verification" actions={<Link className="text-xs hover:underline" href={`${CRM}/properties?verification_due=1`}>All →</Link>} bodyClassName="p-0">
              <ul className="divide-y text-[13px]">
                {data.needs_verification.length === 0 ? <li className="px-3 py-3 text-gray-500">All properties are verified.</li> : null}
                {data.needs_verification.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <div className="min-w-0">
                      <Link href={propertyHref(p.id)} className={linkCls}>{p.crm_ref}</Link>{" "}
                      <span className="text-gray-600 truncate">{p.title}</span>
                      <span className="block text-[11px] text-gray-500">
                        {[p.neighborhood_name, p.landlord_name].filter(Boolean).join(" · ") || "No landlord"}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">verified {fmtRelative(p.availability_verified_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Today's follow-ups" actions={<Link className="text-xs hover:underline" href={`${CRM}/follow-ups`}>All →</Link>} bodyClassName="p-0">
              <FollowUpsTable items={data.follow_ups} />
            </Card>

            <Card title="Upcoming viewings (7 days)" actions={<Link className="text-xs hover:underline" href={`${CRM}/viewings`}>All →</Link>} bodyClassName="p-0">
              <ViewingsTable items={data.upcoming_viewings} />
            </Card>

            <Card title="Recent clients" actions={<Link className="text-xs hover:underline" href={`${CRM}/leads`}>All →</Link>} bodyClassName="p-0">
              <ul className="divide-y text-[13px]">
                {data.recent_leads.length === 0 ? <li className="px-3 py-3 text-gray-500">No clients yet.</li> : null}
                {data.recent_leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <div>
                      <Link href={leadHref(l.id)} className={linkCls}>{l.name}</Link>
                      <span className="ml-2 text-[11px] text-gray-500">
                        {humanize(l.source)} {l.budget_max ? `· up to ${fmtMoney(l.budget_max, l.currency)}` : ""}
                      </span>
                    </div>
                    <span className="flex items-center gap-2">
                      <StatusBadge value={l.status} />
                      <span className="text-[11px] text-gray-500">{fmtDate(l.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Recent deals" actions={<Link className="text-xs hover:underline" href={`${CRM}/deals`}>All →</Link>} bodyClassName="p-0" className="lg:col-span-2">
              <DealsTable items={data.recent_deals} />
            </Card>
          </div>

          <Card title="Recent activity" actions={<Link className="text-xs hover:underline" href={`${CRM}/activity`}>Full log →</Link>}>
            <ActivityList items={data.recent_activity} />
          </Card>
        </>
      )}

      {modal === "landlord" || modal === "manager" ? (
        <LandlordFormModal defaultType={modal === "manager" ? "PROPERTY_MANAGER" : "OWNER"} onClose={() => setModal(null)} />
      ) : null}
      {modal === "lead" ? <LeadFormModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}
