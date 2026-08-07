"use client";

import type { ReactNode } from "react";
import { blockPropertyImageContextMenu } from "@/lib/property-image-protect";

export function PropertyImageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} onContextMenu={blockPropertyImageContextMenu}>
      {children}
    </div>
  );
}
