"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-9 h-9 rounded-full border border-gray-200 dark:border-navy-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-navy-800 transition"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="w-4 h-4 text-gold-500" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
