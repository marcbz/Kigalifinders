"use client";

import { Building2, Users, Mail, Eye, Home, FileText } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/services/api";
import { Shimmer } from "@/components/ui/shimmer";
import { Button } from "@/components/ui/button";

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-sm p-6 border">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-navy-800 dark:text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: adminService.dashboard,
    retry: false,
  });

  if (isLoading) {
    return (
      <div>
        <Shimmer className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { title: "Total Properties", value: stats?.total_properties ?? "—", icon: Building2, color: "bg-blue-100 text-blue-600" },
    { title: "Published", value: stats?.published_properties ?? "—", icon: Home, color: "bg-green-100 text-green-600" },
    { title: "Total Users", value: stats?.total_users ?? "—", icon: Users, color: "bg-purple-100 text-purple-600" },
    { title: "Unread Messages", value: stats?.unread_messages ?? "—", icon: Mail, color: "bg-red-100 text-red-600" },
    { title: "Property Views", value: stats?.property_views ?? "—", icon: Eye, color: "bg-gold-500/20 text-gold-600" },
    { title: "Blog Views", value: stats?.blog_views ?? "—", icon: FileText, color: "bg-amber-100 text-amber-700" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Dashboard Overview</h2>
        <Button asChild className="rounded-full self-start">
          <Link href="/admin/analytics">View Analytics</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>
      <p className="text-sm text-gray-500">
        Total views across properties and blog: {(stats?.total_views ?? 0).toLocaleString()}. Open Analytics for growth charts,
        device breakdown, and traffic sources.
      </p>
    </div>
  );
}
