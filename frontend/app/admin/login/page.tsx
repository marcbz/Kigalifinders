"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tokens = await authService.login(email, password);
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      router.push("/admin");
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 px-6">
      <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-navy-800 flex items-center justify-center mx-auto mb-4">
            <span className="font-serif text-gold-500 text-2xl font-bold">K</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-navy-800 dark:text-white">Admin Login</h1>
          <p className="text-gray-500 text-sm mt-2">Kigalifinders Management Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <input type="email" placeholder="Email" className="lux-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="lux-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full rounded-full">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
