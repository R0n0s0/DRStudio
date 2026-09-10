import React, { useState, useRef, useEffect } from "react";
import { GripVertical } from "lucide-react";

// Wraps a floating contextual toolbar so it can be dragged anywhere over the
// canvas. Position persists to localStorage so it never jumps back over the
// geometry being edited. Renders a grip handle flush against the bar's left
// edge; the wrapped bar should use `rounded-r-lg border-l-0` so the two connect.
export default function DraggableFloatingBar({ storageKey, children, zIndex = 30 }) {
  const [pos, setPos] = useState(() => {
    try { const s = localStorage.getItem(storageKey); if (s) return JSON.parse(s); } catch {}
    return null; // null = default top-center
  });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(null);

  useEffect(() => {
    if (pos) { try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch {} }
  }, [pos, storageKey]);

  const onGripDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget.closest("[data-float-bar]");
    const bar = el.getBoundingClientRect();
    const parent = el.offsetParent ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    // Track the offset between the cursor and the bar's top-left corner so
    // the bar stays exactly under the cursor while dragging. All positions
    // are converted to the parent's coordinate frame (CSS left/top are
    // relative to the positioned ancestor, not the viewport).
    startRef.current = {
      offsetX: e.clientX - bar.left,
      offsetY: e.clientY - bar.top,
      parentLeft: parent.left,
      parentTop: parent.top,
    };
    setPos({ x: bar.left - parent.left, y: bar.top - parent.top });
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const s = startRef.current;
      if (!s) return;
      const nx = Math.max(4, e.clientX - s.offsetX - s.parentLeft);
      const ny = Math.max(4, e.clientY - s.offsetY - s.parentTop);
      setPos({ x: nx, y: ny });
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  const style = pos
    ? { left: pos.x, top: pos.y, transform: "none" }
    : { left: "50%", top: 8, transform: "translateX(-50%)" };

  return (
    <div
      data-float-bar
      className="absolute flex items-stretch"
      style={{ ...style, zIndex }}
    >
      <div
        onPointerDown={onGripDown}
        title="Drag to move"
        className="flex items-center px-1 cursor-grab active:cursor-grabbing bg-neutral-900/95 border border-white/15 rounded-l-lg shadow-xl select-none touch-none"
      >
        <GripVertical size={14} className="text-white/40" />
      </div>
      {children}
    </div>
  );
}