"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, RefreshCw } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/utils";

export function ExternalImagesPanel() {
  const queryClient = useQueryClient();
  const reportQuery = useQuery({
    queryKey: ["admin-external-images"],
    queryFn: () => adminService.externalImagesReport(),
    retry: false,
  });

  const rehostMutation = useMutation({
    mutationFn: () => adminService.rehostExternalImages(50),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-external-images"] });
      queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
    },
  });

  const report = reportQuery.data;
  const externalCount = report?.external_count ?? 0;
  if (reportQuery.isLoading) return null;
  if (!report || externalCount === 0) return null;

  const byCloud = Object.entries(report.by_cloud || {})
    .map(([cloud, count]) => `${cloud}: ${count}`)
    .join(" · ");

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <ImageOff className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {externalCount} listing photo{externalCount === 1 ? "" : "s"} not on your Cloudinary
            {report.our_cloudinary_cloud ? ` (${report.our_cloudinary_cloud})` : ""}
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
            These URLs point at other Cloudinary clouds or third-party hosts. They often still show
            from a cached browser in Rwanda, then disappear on VPN / new devices when the source
            account is disabled. Prefer Upload from device. Try “Copy to my Cloudinary” for links
            that are still downloadable; broken sources need a fresh upload.
          </p>
          {byCloud && <p className="text-xs text-amber-700 dark:text-amber-400">Sources: {byCloud}</p>}
          {rehostMutation.data && (
            <p className="text-xs text-amber-900 dark:text-amber-200">
              Last run: copied {rehostMutation.data.rehosted_count}, failed{" "}
              {rehostMutation.data.failed_count}
              {rehostMutation.data.failed_count > 0
                ? " (source blocked or disabled — re-upload those photos)."
                : "."}
            </p>
          )}
          {rehostMutation.isError && (
            <p className="text-xs text-red-600">
              {getApiErrorMessage(rehostMutation.error, "Rehost failed")}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full gap-1 shrink-0 border-amber-300"
          disabled={rehostMutation.isPending}
          onClick={() => {
            if (
              !window.confirm(
                "Copy up to 50 external listing photos onto your Cloudinary account? Photos whose source is already dead cannot be recovered.",
              )
            ) {
              return;
            }
            rehostMutation.mutate();
          }}
        >
          <RefreshCw className={`w-4 h-4 ${rehostMutation.isPending ? "animate-spin" : ""}`} />
          Copy to my Cloudinary
        </Button>
      </div>
    </div>
  );
}
