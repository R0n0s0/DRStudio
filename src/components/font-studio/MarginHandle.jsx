import React from "react";

// Ruler margin handle: a colored pointed tab that lives inside a ruler, tip
// pointing toward the canvas. Constant pixel size in screen space so it stays
// grabbable at any zoom. Dragging a margin is ONLY possible via this handle —
// the margin guide line drawn in the canvas is non-interactive.
//
// Props:
//   orientation — "down" (top ruler, x-axis margin, tip points down)
//                 "right" (left ruler, y-axis margin, tip points right)
//   pos         — screen position along the ruler (x for "down", y for "right")
//   rulerH      — ruler thickness; the tab fits inside, tip at the canvas edge
//   color       — tab fill (color-matched to the margin line)
//   disabled    — greys out the tab (margins locked)
//   onPointerDown — drag start handler attached to the tab
export default function MarginHandle({ orientation = "down", pos, rulerH = 18, color = "#3B82F6", disabled = false, onPointerDown }) {
  const fill = disabled ? "#475569" : color;
  const stroke = disabled ? "#334155" : "rgba(0,0,0,0.45)";
  const cursor = disabled ? "not-allowed" : orientation === "right" ? "ns-resize" : "ew-resize";
  const pe = disabled ? "none" : "all";

  if (orientation === "right") {
    const tabH = 13;
    const pad = 2;
    const tip = 4;
    const half = tabH / 2;
    const leftX = pad;
    const neckX = rulerH - tip;
    const tipX = rulerH;
    const y = pos;
    return (
      <path
        d={[
          `M ${leftX} ${y - half}`,
          `L ${leftX} ${y + half}`,
          `L ${neckX} ${y + half}`,
          `L ${tipX} ${y}`,
          `L ${neckX} ${y - half}`,
          "Z",
        ].join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.5}
        style={{ cursor, pointerEvents: pe }}
        onPointerDown={onPointerDown}
      />
    );
  }

  const tabW = 13;
  const padTop = 2;
  const tipH = 4;
  const tabH = rulerH - padTop;
  const half = tabW / 2;
  const topY = padTop;
  const neckY = tabH - tipH;
  const tipY = rulerH;
  const x = pos;
  return (
    <path
      d={[
        `M ${x - half} ${topY}`,
        `L ${x + half} ${topY}`,
        `L ${x + half} ${neckY}`,
        `L ${x} ${tipY}`,
        `L ${x - half} ${neckY}`,
        "Z",
      ].join(" ")}
      fill={fill}
      stroke={stroke}
      strokeWidth={0.5}
      style={{ cursor, pointerEvents: pe }}
      onPointerDown={onPointerDown}
    />
  );
}