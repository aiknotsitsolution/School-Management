import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Body-portal'd popover panel.
 *
 * Dropdown panels rendered inside a `Card` (or any `overflow-hidden` /
 * `overflow-auto` ancestor) get clipped to that ancestor's box, which is what
 * made filter dropdowns appear "hidden inside the card". Portalling to
 * document.body + position:fixed lifts the panel out of the clipping context,
 * so it always renders on top of cards, tables and modals.
 *
 * The panel also owns outside-click / Escape dismissal — it must, because a
 * portalled click no longer lands inside the trigger's subtree.
 */
const GAP = 4;
const EDGE = 8;
// Below this much room the panel flips above the trigger instead of overflowing
// the viewport bottom.
const MIN_PANEL_H = 220;

export default function PopoverPanel({ open, anchorRef, onClose, className = "", children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [pos, setPos] = useState(null);

  // Track the latest onClose without re-running the dismissal effect per render.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const place = useCallback(() => {
    const trigger = anchorRef?.current;
    if (!trigger || !trigger.isConnected) return;
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const flip = below < MIN_PANEL_H && above > below;
    setPos({
      left: Math.round(r.left),
      width: Math.round(r.width),
      top: flip ? null : Math.round(r.bottom + GAP),
      bottom: flip ? Math.round(window.innerHeight - r.top + GAP) : null,
      maxHeight: Math.round(Math.max(160, flip ? above : below)),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    const reposition = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    const onDown = (e) => {
      if (anchorRef?.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      onCloseRef.current?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current?.();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, place, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: pos.left,
        width: pos.width,
        top: pos.top ?? undefined,
        bottom: pos.bottom ?? undefined,
        maxHeight: pos.maxHeight,
      }}
      // z-[70] clears the z-50 modals these dropdowns are used inside.
      className={`z-[70] flex flex-col overflow-hidden bg-white rounded-xl border border-slate-300 shadow-lg ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
