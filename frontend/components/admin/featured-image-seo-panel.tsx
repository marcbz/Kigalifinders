"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildFeaturedImageSeoChecks,
  featuredImageSeoScore,
  suggestFeaturedImageAlt,
  type FeaturedImageSeoInput,
} from "@/lib/property-image-seo";

type Props = {
  context: FeaturedImageSeoInput;
  altText: string;
  onAltTextChange: (value: string) => void;
};

export function FeaturedImageSeoPanel({ context, altText, onAltTextChange }: Props) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const checks = useMemo(
    () =>
      buildFeaturedImageSeoChecks({
        ...context,
        altText,
      }),
    [context, altText],
  );

  const dimensionOk = dimensions ? dimensions.width >= 1200 : null;
  const score = featuredImageSeoScore(checks);

  return (
    <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold-600" />
            Featured image — Google &amp; social SEO
          </p>
          <p className="text-xs text-gray-500 mt-1">
            This image is used in search results, Google Images, Open Graph previews, and property cards.
            Use a sharp landscape photo (at least 1200px wide), JPG or WebP, with clear alt text.
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            score >= 75 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {score}% ready
        </span>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500">IMAGE ALT TEXT (SEO)</label>
        <p className="text-xs text-gray-400 mt-0.5 mb-1">
          Describe what is in the photo — bedrooms, property type, and Kigali neighborhood. Avoid generic
          text like “image1”.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="lux-input flex-1"
            placeholder="e.g. Furnished 2-bedroom apartment living room in Kimironko, Kigali"
            value={altText}
            onChange={(e) => onAltTextChange(e.target.value)}
            maxLength={125}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full shrink-0"
            onClick={() => onAltTextChange(suggestFeaturedImageAlt(context))}
          >
            Suggest alt text
          </Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{altText.length}/125 characters</p>
      </div>

      {context.imageUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={context.imageUrl}
            alt=""
            className="h-16 w-24 rounded-lg object-cover border"
            onLoad={(e) => {
              const img = e.currentTarget;
              setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }}
            onError={() => setDimensions(null)}
          />
          <p className="text-xs text-gray-500">
            {dimensions
              ? `${dimensions.width}×${dimensions.height}px — ${
                  dimensionOk
                    ? "Good size for Google & social previews."
                    : "Prefer at least 1200px width for best discovery."
                }`
              : "Loading image dimensions…"}
          </p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            {check.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
            )}
            <span className={check.ok ? "text-gray-700 dark:text-gray-200" : "text-gray-500"}>
              {check.label}
              {!check.ok && check.hint ? (
                <span className="block text-xs text-gray-400 mt-0.5">{check.hint}</span>
              ) : null}
            </span>
          </li>
        ))}
        {dimensionOk != null ? (
          <li className="flex items-start gap-2 text-sm">
            {dimensionOk ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
            )}
            <span className={dimensionOk ? "text-gray-700 dark:text-gray-200" : "text-gray-500"}>
              Image at least 1200px wide
              {!dimensionOk ? (
                <span className="block text-xs text-gray-400 mt-0.5">
                  Wider photos rank better in Google Images and link previews.
                </span>
              ) : null}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
