"use client";

import { useEffect, useState } from "react";
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
  const [jump, setJump] = useState(String(page));

  useEffect(() => {
    setJump(String(page));
  }, [page]);

  if (totalPages <= 1) return null;

  const go = (target: number) => {
    const next = Math.min(totalPages, Math.max(1, Math.round(target)));
    if (next !== page) onPageChange(next);
    setJump(String(next));
  };

  const submitJump = () => {
    const n = Number(jump);
    if (Number.isFinite(n) && jump.trim() !== "") go(n);
    else setJump(String(page));
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
      <label className="flex items-center gap-1.5 text-sm text-gray-500 ml-2">
        <span>Go to</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitJump();
          }}
          onBlur={submitJump}
          className="lux-input w-16 h-9 text-center px-2"
          aria-label="Go to page number"
        />
        <span>/ {totalPages}</span>
      </label>
    </div>
  );
}
