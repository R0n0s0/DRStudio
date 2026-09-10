import React from "react";

// Renders anchor points (nodes) and Bézier handles for the editable contours.
// Brush / Wet-Brush contours show nodes but no handle widgets, so the strokes
// stay clean while remaining editable point-by-point with the Direct Selection tool.
export default function NodesLayer({ contours, tool, selPoints, selContours, toScreen }) {
  if (tool !== "node" && tool !== "pen" && tool !== "penAdd" && tool !== "penDelete" && tool !== "penConvert") return null;
  const isNode = tool === "node";
  return contours.map((c, ci) => {
    if (c.hidden) return null;
    if (isNode && !selContours.includes(ci)) return null;
    return (
      <g key={"n" + ci}>
        {c.points.map((p, pi) => {
          const ps = toScreen(p);
          const selected = selPoints.some((s) => s.contour === ci && s.point === pi);
          const isEndpoint = isNode && !c.closed && (pi === 0 || pi === c.points.length - 1);
          const neighborOfSelected = isNode && selPoints.some((s) => {
            if (s.contour !== ci) return false;
            const n = c.points.length;
            return c.closed ? s.point === (pi - 1 + n) % n || s.point === (pi + 1) % n : s.point === pi - 1 || s.point === pi + 1;
          });
          const showHandles = (c.isBrush || c.isWetBrush) ? false : (isNode ? ((selected || neighborOfSelected) && !p.hideHandles) : !p.hideHandles);
          return (
            <g key={pi}>
              {showHandles && p.out && (() => { const hs = toScreen(p.out); return <line x1={ps.x} y1={ps.y} x2={hs.x} y2={hs.y} stroke="#64748b" strokeWidth={1} />; })()}
              {showHandles && p.in && (() => { const hs = toScreen(p.in); return <line x1={ps.x} y1={ps.y} x2={hs.x} y2={hs.y} stroke="#64748b" strokeWidth={1} />; })()}
              {showHandles && p.out && (() => { const hs = toScreen(p.out); return <rect x={hs.x - 3} y={hs.y - 3} width={6} height={6} fill="#0ea5e9" />; })()}
              {showHandles && p.in && (() => { const hs = toScreen(p.in); return <rect x={hs.x - 3} y={hs.y - 3} width={6} height={6} fill="#0ea5e9" />; })()}
              {isEndpoint ? (
                <circle cx={ps.x} cy={ps.y} r={4.5} fill={selected ? "#f59e0b" : "#fff"} stroke="#000" strokeWidth={1.25} />
              ) : (
                <rect x={ps.x - 4} y={ps.y - 4} width={8} height={8} fill={selected ? "#f59e0b" : "#fff"} stroke="#000" strokeWidth={1} />
              )}
            </g>
          );
        })}
      </g>
    );
  });
}