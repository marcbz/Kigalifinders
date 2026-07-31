"use client";

import { Building2, Users, Calendar, Mail, Eye, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/services/api";

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
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: adminService.dashboard,
    retry: false,
  });

  const cards = [
    { title: "Total Properties", value: stats?.total_properties ?? "—", icon: Building2, color: "bg-blue-100 text-blue-600" },
    { title: "Published", value: stats?.published_properties ?? "—", icon: Home, color: "bg-green-100 text-green-600" },
    { title: "Total Users", value: stats?.total_users ?? "—", icon: Users, color: "bg-purple-100 text-purple-600" },
    { title: "Pending Appointments", value: stats?.pending_appointments ?? "—", icon: Calendar, color: "bg-orange-100 text-orange-600" },
    { title: "Unread Messages", value: stats?.unread_messages ?? "—", icon: Mail, color: "bg-red-100 text-red-600" },
    { title: "Total Views", value: stats?.total_views ?? "—", icon: Eye, color: "bg-gold-500/20 text-gold-600" },
  ];

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-navy-800 dark:text-white mb-6">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
