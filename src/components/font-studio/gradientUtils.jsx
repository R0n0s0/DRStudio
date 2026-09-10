import React from "react";
import { expandStopsForRender } from "@/font/appearance";

// Build an SVG <linearGradient>/<radialGradient> def for a gradient fill/stroke value.
// Supports points-based (userSpaceOnUse) linear/radial + legacy angle-based fallback.
export function buildGrad(fill, id, toScreen) {
  const stops = (expandStopsForRender(fill.stops) || []).map((s, si) => (
    <stop key={si} offset={`${Math.round((s.offset || 0) * 100)}%`} stopColor={s.color} stopOpacity={s.opacity != null ? s.opacity : 1} />
  ));
  if (fill.x1 != null && fill.x2 != null) {
    const s1 = toScreen({ x: fill.x1, y: fill.y1 }), s2 = toScreen({ x: fill.x2, y: fill.y2 });
    return <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}>{stops}</linearGradient>;
  }
  if (fill.cx != null) {
    const sc = toScreen({ x: fill.cx, y: fill.cy });
    const sf = toScreen({ x: fill.fx ?? fill.cx, y: fill.fy ?? fill.cy });
    const edge = toScreen({ x: fill.cx + (fill.r || 100), y: fill.cy });
    const r = Math.max(1, Math.hypot(edge.x - sc.x, edge.y - sc.y));
    const ar = fill.aspectRatio ?? 1;
    const transform = ar !== 1 ? `translate(0 ${sc.y}) scale(1 ${ar}) translate(0 ${-sc.y})` : undefined;
    return <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={sc.x} cy={sc.y} r={r} fx={sf.x} fy={sf.y} gradientTransform={transform}>{stops}</radialGradient>;
  }
  const ang = ((fill.angle ?? 90) * Math.PI) / 180;
  const dx = Math.cos(ang) / 2, dy = Math.sin(ang) / 2;
  if (fill.gradientType === "radial") return <radialGradient id={id} cx="50%" cy="50%" r="65%">{stops}</radialGradient>;
  return <linearGradient id={id} x1={`${(0.5 - dx) * 100}%`} y1={`${(0.5 - dy) * 100}%`} x2={`${(0.5 + dx) * 100}%`} y2={`${(0.5 + dy) * 100}%`}>{stops}</linearGradient>;
}