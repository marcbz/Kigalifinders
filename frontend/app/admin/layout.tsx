"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Link2, Home, Mail, Settings, FileText, BarChart3, LogOut, Search, Database, Shield } from "lucide-react";
import { AdminAuthGuard } from "@/components/admin/auth-guard";
import { BrandName } from "@/components/brand/brand-name";
import { clearAuthTokens } from "@/lib/auth";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/properties", label: "Properties", icon: Home },
  { href: "/admin/search-landings", label: "Search Landings", icon: Search },
  { href: "/admin/seo-settings", label: "SEO Settings", icon: Shield },
  { href: "/admin/observations", label: "External Observations", icon: Database },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/links", label: "Links", icon: Link2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  const handleSignOut = () => {
    clearAuthTokens();
    router.push("/admin/login");
  };

  return (
    <AdminAuthGuard>
      <div className="min-h-screen flex bg-gray-50 dark:bg-navy-900">
        <aside className="w-64 bg-navy-800 text-white hidden md:flex flex-col">
          <div className="p-6 border-b border-navy-700">
            <Link href="/admin" className="block">
              <BrandName variant="admin" size="md" />
            </Link>
            <p className="text-xs text-gray-400 mt-1">Admin Dashboard</p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {sidebarLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition ${
                  pathname === href || (href !== "/admin" && pathname.startsWith(href))
                    ? "bg-navy-700 text-gold-500"
                    : "hover:bg-navy-700"
                }`}
              >
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
            <button type="button" onClick={handleSignOut} className="text-sm text-gold-500 flex items-center gap-1 hover:underline">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </AdminAuthGuard>
  );
}
