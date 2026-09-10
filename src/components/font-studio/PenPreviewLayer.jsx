import React from "react";

// Pen Tool preview overlays: open-path endpoint indicators (with close/join
// glyphs), auto add/delete hover markers, and the live rubber-band preview
// line connecting the last anchor to the cursor — snapping to the close/join
// target when hovered. Extracted from VectorCanvas for clarity.
export default function PenPreviewLayer({ tool, work, toScreen, penHover, penDraft, penCursor, rubberBand, autoAddDelete, shiftHeld, pointOnSeg, selContours }) {
  if (tool !== "pen" && tool !== "node" && tool !== "select" && tool !== "transform") return null;
  const items = [];

  // Open-path endpoint indicators with close (o) / join (¬) glyphs.
  if (tool === "pen") work.contours.forEach((c, ci) => {
    if (c.closed || c.points.length === 0) return;
    const ends = c.points.length === 1
      ? [{ pi: 0, end: "start" }]
      : [{ pi: 0, end: "start" }, { pi: c.points.length - 1, end: "end" }];
    ends.forEach(({ pi, end }) => {
      const s = toScreen(c.points[pi]);
      const hovered = penHover && penHover.contour === ci && penHover.end === end;
      const isClose = hovered && penHover.type === "close";
      const isJoin = hovered && penHover.type === "endpoint";
      items.push(<circle key={`ep${ci}-${end}`} cx={s.x} cy={s.y} r={isClose ? 7 : hovered ? 6 : 4} fill={isClose ? "#22c55e" : hovered ? "#f59e0b" : "#0ea5e9"} stroke="#000" strokeWidth={1} />);
      if (isClose) items.push(<text key={`epc${ci}-${end}`} x={s.x + 9} y={s.y - 8} fill="#22c55e" fontSize={12} fontWeight="bold">o</text>);
      if (isJoin) items.push(<text key={`epj${ci}-${end}`} x={s.x + 9} y={s.y - 8} fill="#f59e0b" fontSize={15} fontWeight="bold">¬</text>);
    });
  });

  // Auto add/delete: segment hover marker (+).
  if (penHover?.type === "segment" && autoAddDelete && !shiftHeld) {
    const p = pointOnSeg(penHover);
    if (p) {
      const s = toScreen(p);
      items.push(
        <g key="pen-seg-hover" style={{ pointerEvents: "none" }}>
          <circle cx={s.x} cy={s.y} r={6} fill="#22c55e" stroke="#000" strokeWidth={1} opacity={0.9} />
          <text x={s.x} y={s.y + 4} fill="#fff" fontSize={11} fontWeight="bold" textAnchor="middle">+</text>
        </g>
      );
    }
  }

  // Auto delete: anchor hover marker (red ring).
  if (penHover?.type === "anchor") {
    const p = work.contours[penHover.contour]?.points[penHover.point];
    if (p) {
      const s = toScreen(p);
      items.push(<circle key="pen-anchor-hover" cx={s.x} cy={s.y} r={9} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0.9} />);
    }
  }

  return <g style={{ pointerEvents: "none" }}>{items}</g>;
}