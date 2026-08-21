"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandName } from "@/components/brand/brand-name";
import { authService } from "@/services/api";
import { clearAuthTokens, getAccessToken, isAdminRole, setAuthTokens } from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    authService
      .me()
      .then((user) => {
        if (isAdminRole(user.role)) router.replace("/admin");
      })
      .catch(() => clearAuthTokens());
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim() || !password) {
        setError("Email and password are required");
        return;
      }

      const tokens = await authService.login(email.trim(), password);
      setAuthTokens(tokens.access_token, tokens.refresh_token);

      const user = await authService.me();
      if (!isAdminRole(user.role)) {
        clearAuthTokens();
        setError("Access denied. Admin credentials required.");
        return;
      }

      router.push("/admin");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Invalid email or password";
      setError(typeof message === "string" ? message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 px-6">
      <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-navy-800 flex items-center justify-center mx-auto mb-4">
            <span className="font-serif text-gold-500 text-lg font-bold leading-none">KR</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Admin Login</h1>
          <p className="text-gray-500 text-sm mt-2"><BrandName size="sm" /> Management Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            className="lux-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="lux-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            minLength={8}
          />
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
