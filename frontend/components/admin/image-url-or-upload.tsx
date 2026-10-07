"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Stamp } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/utils";

interface ImageUrlOrUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  folder?: string;
  previewClassName?: string;
  allowUpload?: boolean;
  /** Burn the KigaliRent watermark into uploads; pasted URLs are watermarked by the form on save. */
  watermark?: boolean;
}

export function ImageUrlOrUpload({
  value,
  onChange,
  label = "Image",
  hint,
  folder = "kigalifinders",
  previewClassName = "h-24 w-full max-w-xs rounded-lg object-cover border",
  allowUpload = true,
  watermark = false,
}: ImageUrlOrUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marked, setMarked] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const url = await adminService.uploadImage(file, folder, watermark);
      onChange(url);
      if (watermark) setMarked(url);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to upload image"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      )}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <div className="flex gap-2 items-center">
        <input
          className="lux-input flex-1"
          placeholder={allowUpload ? "https://... or upload from device" : "https://..."}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
        />
        {allowUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full shrink-0 gap-1"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              Upload
            </Button>
          </>
        )}
      </div>
      {marked && marked === value && (
        <p className="text-xs text-emerald-700 inline-flex items-center gap-1">
          <Stamp className="w-3 h-3" /> Watermarked
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Preview" className={previewClassName} />
      )}
    </div>
  );
}
