"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/services/api";
import { clearAuthTokens, getAccessToken, isAdminRole } from "@/lib/auth";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setReady(true);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    authService
      .me()
      .then((user) => {
        if (!isAdminRole(user.role)) {
          clearAuthTokens();
          router.replace("/admin/login");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        clearAuthTokens();
        router.replace("/admin/login");
      });
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-navy-900">
        <p className="text-gray-500">Verifying access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
