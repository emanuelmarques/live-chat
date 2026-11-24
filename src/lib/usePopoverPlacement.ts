import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const MARGIN = 8; // min distance from the viewport edges
const GAP = 6; // distance between trigger and popover

/**
 * Positions a popover (`position: fixed`) next to its trigger, flipping above/below
 * depending on where there is more room and clamping it inside the viewport, so it
 * never gets cut off on small screens. Re-measures on scroll and resize while open.
 */
export function usePopoverPlacement(
  triggerRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  open: boolean,
): CSSProperties {
  // Hidden until the first measurement so it never flashes in the wrong place.
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: "hidden" });
      return;
    }

    function place() {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const t = trigger.getBoundingClientRect();
      const { offsetWidth: w, offsetHeight: h } = popover;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceAbove = t.top - MARGIN;
      const spaceBelow = vh - t.bottom - MARGIN;
      const placeAbove = spaceAbove >= h + GAP || spaceAbove > spaceBelow;

      let top = placeAbove ? t.top - GAP - h : t.bottom + GAP;
      top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));

      // Prefer aligning to the trigger's left edge; clamp into the viewport.
      let left = t.left;
      left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));

      setStyle({ top, left, visibility: "visible" });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, triggerRef, popoverRef]);

  return style;
}
