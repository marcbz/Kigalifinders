"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Calendar, Mail, Settings, FileText, BarChart3 } from "lucide-react";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/properties", label: "Properties", icon: Home },
  { href: "/admin/agents", label: "Agents", icon: Users },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-navy-900">
      <aside className="w-64 bg-navy-800 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-navy-700">
          <Link href="/admin" className="font-serif text-xl font-bold text-gold-500">KIGALIFINDERS</Link>
          <p className="text-xs text-gray-400 mt-1">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-navy-700 text-sm transition">
              <Icon className="w-4 h-4 text-gold-500" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-navy-700">
          <Link href="/" className="text-sm text-gray-400 hover:text-gold-500">← Back to Website</Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-navy-800 border-b px-6 py-4 flex justify-between items-center">
          <h1 className="font-semibold text-navy-800 dark:text-white">Admin Panel</h1>
          <Link href="/admin/login" className="text-sm text-gold-500">Sign Out</Link>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
