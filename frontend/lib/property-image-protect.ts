import type { MouseEvent } from "react";

/** Deterrent only — does not prevent DevTools or network inspection. */
export function blockPropertyImageContextMenu(event: MouseEvent) {
  event.preventDefault();
}

export const propertyImageProtectProps = {
  onContextMenu: blockPropertyImageContextMenu,
  className: "select-none",
  draggable: false,
} as const;
