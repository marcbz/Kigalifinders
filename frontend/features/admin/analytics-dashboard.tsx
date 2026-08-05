"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { adminService } from "@/services/api";
import { Shimmer } from "@/components/ui/shimmer";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

const PERIODS = [7, 14, 30, 60, 90] as const;

const CHART_COLORS = ["#c9a227", "#1e3a5f", "#4f8cff", "#22c55e", "#f97316", "#a855f7", "#ec4899"];

function formatChartDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-sm text-gray-400 border border-dashed rounded-xl">
      {message}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => adminService.analytics(days),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-10 w-full max-w-md" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Shimmer className="h-80 rounded-xl" />
          <Shimmer className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasViews = (data?.period_totals.total_views ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track property and blog views, device types, and traffic sources over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDays(period)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                days === period
                  ? "bg-navy-800 text-gold-500"
                  : "border border-gray-200 dark:border-border hover:border-gold-500"
              }`}
            >
              {period} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-card rounded-xl border p-5">
          <p className="text-sm text-gray-500">Views ({days} days)</p>
          <p className="text-3xl font-bold text-navy-800 dark:text-white mt-1">
            {(data?.period_totals.total_views ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Properties {(data?.period_totals.property_views ?? 0).toLocaleString()} · Blog{" "}
            {(data?.period_totals.blog_views ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border p-5">
          <p className="text-sm text-gray-500">All-time property views</p>
          <p className="text-3xl font-bold text-navy-800 dark:text-white mt-1">
            {(data?.all_time_totals.property_views ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border p-5">
          <p className="text-sm text-gray-500">All-time blog views</p>
          <p className="text-3xl font-bold text-navy-800 dark:text-white mt-1">
            {(data?.all_time_totals.blog_views ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border p-6">
        <h3 className="font-semibold text-navy-800 dark:text-white mb-4">Views over time</h3>
        {!hasViews ? (
          <EmptyChart message="No views recorded in this period yet. Data will appear as visitors browse listings and blog posts." />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.daily_views ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={formatChartDate} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => formatDateTime(String(value))}
                  formatter={(value, name) => [
                    Number(value ?? 0),
                    name === "property" ? "Properties" : name === "blog" ? "Blog" : "Total",
                  ]}
                />
                <Legend formatter={(value) => (value === "property" ? "Properties" : value === "blog" ? "Blog" : "Total")} />
                <Line type="monotone" dataKey="property" stroke="#1e3a5f" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="blog" stroke="#c9a227" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total" stroke="#4f8cff" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-card rounded-xl border p-6">
          <h3 className="font-semibold text-navy-800 dark:text-white mb-4">Device type</h3>
          {!data?.devices?.length ? (
            <EmptyChart message="No device data yet." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.devices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  >
                    {data.devices.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-card rounded-xl border p-6">
          <h3 className="font-semibold text-navy-800 dark:text-white mb-4">Traffic sources</h3>
          {!data?.sources?.length ? (
            <EmptyChart message="No traffic source data yet." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sources}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  >
                    {data.sources.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b font-semibold">Top properties by views</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-800 border-b">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Published</th>
                <th className="text-right p-3">Views</th>
              </tr>
            </thead>
            <tbody>
              {(data?.top_properties ?? []).map((item) => (
                <tr key={item.slug} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/properties/${item.slug}`} className="hover:text-gold-500 font-medium">
                      {item.title}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-500">{formatShortDate(item.published_at)}</td>
                  <td className="p-3 text-right">{item.views_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.top_properties?.length && (
            <p className="p-6 text-center text-gray-400 text-sm">No published properties yet.</p>
          )}
        </div>

        <div className="bg-white dark:bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b font-semibold">Top blog posts by views</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-navy-800 border-b">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Published</th>
                <th className="text-right p-3">Views</th>
              </tr>
            </thead>
            <tbody>
              {(data?.top_blog_posts ?? []).map((item) => (
                <tr key={item.slug} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/blog/${item.slug}`} className="hover:text-gold-500 font-medium">
                      {item.title}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-500">{formatShortDate(item.published_at)}</td>
                  <td className="p-3 text-right">{item.views_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.top_blog_posts?.length && (
            <p className="p-6 text-center text-gray-400 text-sm">No published blog posts yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
