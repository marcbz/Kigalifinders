"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { adminService } from "@/services/api";
import { Button } from "@/components/ui/button";

interface ImageUrlOrUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  folder?: string;
  previewClassName?: string;
}

export function ImageUrlOrUpload({
  value,
  onChange,
  label = "Image",
  hint,
  folder = "kigalifinders",
  previewClassName = "h-24 w-full max-w-xs rounded-lg object-cover border",
}: ImageUrlOrUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await adminService.uploadImage(file, folder);
      onChange(url);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to upload image";
      setError(typeof message === "string" ? message : "Failed to upload image");
    } finally {
      setUploading(false);
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
          placeholder="https://... or upload from device"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
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
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          Upload
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Preview" className={previewClassName} />
      )}
    </div>
  );
}
