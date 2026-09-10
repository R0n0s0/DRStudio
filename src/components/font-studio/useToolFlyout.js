import { useCallback, useEffect, useRef, useState } from "react";

// Shared "press-and-hold to open, drag to highlight, release to pick" flyout
// gesture for stacked toolbar buttons (Illustrator-style).
//
//   holdMs       — how long to press before the flyout opens
//   onPick(id)   — called when a flyout item is chosen (drag-release OR click)
//   onShortPress — called on a quick click that never opened the flyout
//
// Returns { open, pos, hoveredId, wrapRef, registerItem, startPress, close, pickByClick }.
// Each flyout item should call registerItem(id) as its ref and pickByClick(id) on click.
export default function useToolFlyout({ holdMs = 250, onPick, onShortPress } = {}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const wrapRef = useRef(null);
  const itemEls = useRef(new Map());
  const pressTimer = useRef(null);
  const openedDuringPress = useRef(false);
  const pressing = useRef(false);
  const openRef = useRef(false);
  const onPickRef = useRef(onPick);
  const onShortPressRef = useRef(onShortPress);

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  useEffect(() => { onShortPressRef.current = onShortPress; }, [onShortPress]);
  useEffect(() => { openRef.current = open; }, [open]);

  const registerItem = useCallback((id) => (el) => {
    if (el) itemEls.current.set(id, el); else itemEls.current.delete(id);
  }, []);

  const openFlyout = useCallback(() => {
    const rect = wrapRef.current.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.right + 4 });
    setOpen(true);
    setHoveredId(null);
  }, []);

  const close = useCallback(() => { setOpen(false); setHoveredId(null); }, []);

  const hitTest = (x, y) => {
    for (const [id, el] of itemEls.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  };

  const onMove = useCallback((e) => {
    if (!pressing.current) return;
    const id = hitTest(e.clientX, e.clientY);
    setHoveredId((prev) => (prev === id ? prev : id));
  }, []);

  const onUp = useCallback((e) => {
    pressing.current = false;
    window.removeEventListener("pointermove", onMove);
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (openedDuringPress.current) {
      openedDuringPress.current = false;
      const id = hitTest(e.clientX, e.clientY);
      if (id) { onPickRef.current?.(id); close(); }
      return; // released on empty → keep flyout open for click selection
    }
    if (openRef.current) { close(); return; } // click the button while open → close
    onShortPressRef.current?.();
  }, [onMove, close]);

  const startPress = useCallback((e) => {
    e.preventDefault();
    openedDuringPress.current = false;
    pressing.current = true;
    pressTimer.current = setTimeout(() => {
      openedDuringPress.current = true;
      openFlyout();
    }, holdMs);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }, [holdMs, openFlyout, onMove, onUp]);

  // Close on outside click (when the flyout is open after a long-press-and-release).
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current?.contains(e.target)) return; close(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    window.removeEventListener("pointermove", onMove);
  }, [onMove]);

  const pickByClick = useCallback((id) => { onPickRef.current?.(id); close(); }, [close]);

  return { open, pos, hoveredId, wrapRef, registerItem, startPress, close, pickByClick };
}