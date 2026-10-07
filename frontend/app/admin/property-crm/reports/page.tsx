"use client";

import { Suspense } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crmApi } from "@/services/crm-api";
import { Shimmer } from "@/components/ui/shimmer";
import {
  Card,
  ErrorText,
  KpiCard,
  PageHeader,
  StatusBadge,
  fmtMoney,
  humanize,
  inputCls,
  linkCls,
  tableCls,
  tdCls,
  thCls,
} from "@/components/admin/crm/ui";
import { landlordHref } from "@/components/admin/crm/panels";
import { useUrlFilters } from "@/components/admin/crm/use-url-filters";

const KEYS = ["date_from", "date_to"] as const;

function Bars({ rows }: { rows: { label: React.ReactNode; value: number; key: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-gray-500">No data.</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[120px_1fr_40px] items-center gap-2 text-[12px]">
          <span className="truncate">{r.label}</span>
          <span className="h-3 rounded bg-gray-100 dark:bg-navy-900 overflow-hidden">
            <span className="block h-full rounded bg-gold-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ReportsInner() {
  const [f, setF] = useUrlFilters(KEYS);
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["crm", "reports", f.date_from, f.date_to],
    queryFn: () => crmApi.reports({ date_from: f.date_from, date_to: f.date_to }),
    placeholderData: keepPreviousData,
  });
  const t = data?.totals;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Reports"
        subtitle={data ? `${data.date_from} → ${data.date_to}. Defaults to the last 30 days.` : "Loading…"}
        actions={
          <>
            <input className={`${inputCls} w-36`} type="date" value={f.date_from || data?.date_from || ""} onChange={(e) => setF({ date_from: e.target.value })} />
            <span className="text-xs text-gray-500">to</span>
            <input className={`${inputCls} w-36`} type="date" value={f.date_to || data?.date_to || ""} onChange={(e) => setF({ date_to: e.target.value })} />
          </>
        }
      />
      <ErrorText error={error} />
      {isLoading || !t || !data ? (
        <Shimmer className="h-40 w-full" />
      ) : (
        <div className={`space-y-3 ${isFetching ? "opacity-70" : ""}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
            <KpiCard label="Properties added" value={t.properties_added} />
            <KpiCard label="Properties rented" value={t.properties_rented} />
            <KpiCard label="New landlords" value={t.landlords_added} hint={`${t.landlords_active} active total`} />
            <KpiCard label="New clients" value={t.leads_new} />
            <KpiCard label="Viewings" value={t.viewings_total} hint={`${t.viewings_completed} completed`} />
            <KpiCard label="Deals completed" value={t.deals_completed} tone="good" />
            <KpiCard label="Commission earned" value={fmtMoney(t.commission_earned_usd, "USD")} hint="on deals completed in range" />
            <KpiCard label="Commission paid" value={fmtMoney(t.commission_paid_usd, "USD")} tone="good" hint="paid in range" />
            <KpiCard label="Commission pending" value={fmtMoney(t.commission_pending_usd, "USD")} hint="all open" />
          </div>
          <div className="grid lg:grid-cols-3 gap-3">
            <Card title="Properties by availability">
              <Bars rows={data.by_availability.map((r) => ({ key: r.status, label: <StatusBadge value={r.status} />, value: r.count }))} />
            </Card>
            <Card title="New clients by source">
              <Bars rows={data.leads_by_source.map((r) => ({ key: r.source, label: humanize(r.source), value: r.count }))} />
            </Card>
            <Card title="Properties by district" bodyClassName="p-0">
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>District</th>
                    <th className={`${thCls} text-right`}>Total</th>
                    <th className={`${thCls} text-right`}>Available</th>
                    <th className={`${thCls} text-right`}>Rented</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_district.map((r) => (
                    <tr key={r.district}>
                      <td className={tdCls}>{r.district}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.total}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.available}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.rented}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <Card title="Landlord performance (top 25)" bodyClassName="p-0">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>Landlord</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} text-right`}>Properties</th>
                  <th className={`${thCls} text-right`}>Active</th>
                  <th className={`${thCls} text-right`}>Rented</th>
                  <th className={`${thCls} text-right`}>Deals completed (range)</th>
                  <th className={`${thCls} text-right`}>Commission paid (all time)</th>
                </tr>
              </thead>
              <tbody>
                {data.landlord_performance.map((r) => (
                  <tr key={r.id}>
                    <td className={tdCls}><Link href={landlordHref(r.id)} className={linkCls}>{r.name}</Link></td>
                    <td className={tdCls}><StatusBadge value={r.status} /></td>
                    <td className={`${tdCls} text-right tabular-nums`}>{r.properties_total}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{r.properties_active}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{r.properties_rented}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{r.deals_completed}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(r.commission_paid_usd, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function CrmReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsInner />
    </Suspense>
  );
}
