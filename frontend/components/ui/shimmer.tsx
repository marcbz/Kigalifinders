import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-navy-800 dark:via-navy-700 dark:to-navy-800 rounded",
        className,
      )}
    />
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="property-card overflow-hidden">
      <Shimmer className="h-64 w-full rounded-none" />
      <div className="p-6 space-y-4">
        <Shimmer className="h-6 w-3/4" />
        <Shimmer className="h-4 w-1/2" />
        <Shimmer className="h-10 w-full" />
        <div className="flex justify-between items-center">
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-9 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="bg-navy-800 py-16 px-6">
      <div className="max-w-7xl mx-auto text-center space-y-4">
        <Shimmer className="h-4 w-32 mx-auto" />
        <Shimmer className="h-12 w-64 mx-auto" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
