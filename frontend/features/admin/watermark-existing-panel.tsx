"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stamp, Loader2 } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/utils";

export function WatermarkExistingPanel() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { data, error } = useQuery({
    queryKey: ["admin-watermark-status"],
    queryFn: adminService.watermarkStatus,
    retry: false,
    refetchInterval: (q) => (q.state.data?.job.running ? 2000 : false),
  });

  const start = useMutation({
    mutationFn: () => adminService.watermarkExisting(),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["admin-watermark-status"] });
    },
  });

  const finishedAt = data?.job.running ? null : data?.job.finished_at;
  useEffect(() => {
    if (finishedAt) queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
  }, [finishedAt, queryClient]);

  if (error || !data) return null;

  const { job } = data;
  const wasRunning = job.finished_at != null;

  return (
    <div className="mb-4 rounded-xl border bg-white dark:bg-card p-4 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Stamp className="w-4 h-4 text-gold-500 shrink-0" />
          <span>
            <strong>{data.watermarked}</strong> of <strong>{data.total}</strong> listing photos have the KigaliRent
            watermark{data.pending ? ` · ${data.pending} without` : " · all done"}.
          </span>
        </div>

        {job.running ? (
          <span className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Watermarking {job.done ?? 0}
            {job.total != null ? `/${job.total}` : ""}…{job.failed ? ` (${job.failed} failed)` : ""}
          </span>
        ) : data.pending > 0 && !confirming ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full self-start sm:self-auto"
            disabled={!data.storage_configured}
            onClick={() => setConfirming(true)}
          >
            Watermark existing photos
          </Button>
        ) : null}

        {confirming && !job.running ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              Add the watermark to {data.pending} existing photo{data.pending === 1 ? "" : "s"}?
            </span>
            <Button size="sm" className="rounded-full" disabled={start.isPending} onClick={() => start.mutate()}>
              Yes
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setConfirming(false)}>
              No
            </Button>
          </div>
        ) : null}
      </div>

      {!data.storage_configured ? (
        <p className="mt-2 text-xs text-amber-600">Image storage (Cloudinary or S3) is not configured on the server.</p>
      ) : null}
      {start.error ? <p className="mt-2 text-xs text-red-500">{getApiErrorMessage(start.error)}</p> : null}
      {!job.running && wasRunning ? (
        <p className="mt-2 text-xs text-gray-500">
          Last run: {job.done ?? 0} watermarked{job.failed ? `, ${job.failed} failed` : ""}.
          {job.last_error ? <span className="block text-red-500 break-all">Last error: {job.last_error}</span> : null}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-gray-400">
        Clean originals are kept privately. Close any open property editor before running this, so an older copy of
        the photo list is not saved over the watermarked one.
      </p>
    </div>
  );
}
