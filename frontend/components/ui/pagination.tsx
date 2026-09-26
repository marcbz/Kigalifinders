"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const WINDOW = 5;

function pageWindow(page: number, totalPages: number): number[] {
  const size = Math.min(WINDOW, totalPages);
  let start = Math.max(1, page - Math.floor(size / 2));
  start = Math.min(start, totalPages - size + 1);
  return Array.from({ length: size }, (_, i) => start + i);
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const go = (target: number) => {
    const next = Math.min(totalPages, Math.max(1, target));
    if (next !== page) onPageChange(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-4 border-t">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full gap-1"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </Button>
      {pageWindow(page, totalPages).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => go(p)}
          aria-current={p === page ? "page" : undefined}
          className={`min-w-9 h-9 rounded-full text-sm font-medium transition ${
            p === page
              ? "bg-navy-800 text-gold-500"
              : "border border-gray-200 dark:border-border hover:border-gold-500"
          }`}
        >
          {p}
        </button>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full gap-1"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
