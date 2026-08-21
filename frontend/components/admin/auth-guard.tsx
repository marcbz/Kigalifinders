"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import { authService } from "@/services/api";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  isAdminRole,
  setAuthTokens,
} from "@/lib/auth";
import { Shimmer } from "@/components/ui/shimmer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function tryRefreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
      `${API_URL}/auth/refresh`,
      { refresh_token: refreshToken },
    );
    setAuthTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setReady(true);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const token = getAccessToken();
      if (!token) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
          router.replace("/admin/login");
          return;
        }
      }

      try {
        const user = await authService.me();
        if (cancelled) return;
        if (!isAdminRole(user.role)) {
          clearAuthTokens();
          router.replace("/admin/login");
          return;
        }
        setReady(true);
      } catch {
        const refreshed = await tryRefreshSession();
        if (!refreshed) {
          clearAuthTokens();
          router.replace("/admin/login");
          return;
        }
        try {
          const user = await authService.me();
          if (cancelled) return;
          if (!isAdminRole(user.role)) {
            clearAuthTokens();
            router.replace("/admin/login");
            return;
          }
          setReady(true);
        } catch {
          clearAuthTokens();
          router.replace("/admin/login");
        }
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-navy-900">
        <p className="text-gray-500">Verifying access...</p>
        <Shimmer className="h-2 w-32 mt-4" />
      </div>
    );
  }

  return <>{children}</>;
}
