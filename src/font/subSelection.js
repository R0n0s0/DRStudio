// Sub-selection transforms for the Direct Selection Tool.
// Scale/rotate a subset of anchor points within their contours,
// preserving Bézier handles relative to each anchor.
import { convertToPath } from "./liveShapes";

// Bounding box of selected anchor points (anchors only, not handles).
export function pointsBBox(contours, selPoints) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let has = false;
  for (const s of selPoints) {
    const p = contours[s.contour]?.points[s.point];
    if (!p) continue;
    has = true;
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return has ? { minX, minY, maxX, maxY } : null;
}

// Check if a click hits the sub-selection bbox; return a drag state or null.
// hitTestBBoxHandle is passed in (it's a closure over zoom in VectorCanvas).
export function startSubSelectionDrag(fp, contours, selPoints, hitTestBBoxHandle) {
  if (selPoints.length < 2) return null;
  const bb = pointsBBox(contours, selPoints);
  if (!bb) return null;
  const h = hitTestBBoxHandle(fp, bb);
  if (!h) return null;
  const center = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
  const origPts = selPoints.map((s) => {
    const p = contours[s.contour].points[s.point];
    return { ci: s.contour, pi: s.point, x: p.x, y: p.y, in: p.in ? { ...p.in } : null, out: p.out ? { ...p.out } : null };
  });
  if (h === "rotate") return { type: "rotatePoints", center, startAngle: Math.atan2(fp.y - center.y, fp.x - center.x), origPts };
  return { type: "scalePoints", handle: h, bb, center, start: fp, origPts };
}

// Scale selected anchor points from a handle. Shift = proportional, Alt = from center.
export function scalePointsTransform(contours, origPts, handle, bb, center, fp, altKey, shiftKey) {
  const midX = (bb.minX + bb.maxX) / 2, midY = (bb.minY + bb.maxY) / 2;
  const pts = {
    nw: [bb.minX, bb.maxY], n: [midX, bb.maxY], ne: [bb.maxX, bb.maxY],
    e: [bb.maxX, midY], se: [bb.maxX, bb.minY], s: [midX, bb.minY],
    sw: [bb.minX, bb.minY], w: [bb.minX, midY],
  };
  const opp = { nw: "se", ne: "sw", se: "nw", sw: "ne", n: "s", s: "n", e: "w", w: "e" };
  const axis = { nw: "both", ne: "both", se: "both", sw: "both", n: "y", s: "y", e: "x", w: "x" };
  let [anchorX, anchorY] = pts[opp[handle]];
  if (altKey) { anchorX = midX; anchorY = midY; }
  const [ohx, ohy] = pts[handle];
  const denomX = (ohx - anchorX) || 1e-6, denomY = (ohy - anchorY) || 1e-6;
  let sx = 1, sy = 1;
  if (axis[handle] === "both" || axis[handle] === "x") sx = (fp.x - anchorX) / denomX;
  if (axis[handle] === "both" || axis[handle] === "y") sy = (fp.y - anchorY) / denomY;
  if (shiftKey && axis[handle] === "both") { if (Math.abs(sx) > Math.abs(sy)) sy = sx; else sx = sy; }
  return contours.map((c, ci) => {
    const opts = origPts.filter((o) => o.ci === ci);
    if (!opts.length) return c;
    const cpts = [...c.points];
    opts.forEach((o) => {
      cpts[o.pi] = {
        ...cpts[o.pi],
        x: anchorX + (o.x - anchorX) * sx, y: anchorY + (o.y - anchorY) * sy,
        in: o.in ? { x: anchorX + (o.in.x - anchorX) * sx, y: anchorY + (o.in.y - anchorY) * sy } : null,
        out: o.out ? { x: anchorX + (o.out.x - anchorX) * sx, y: anchorY + (o.out.y - anchorY) * sy } : null,
      };
    });
    return convertToPath({ ...c, points: cpts });
  });
}

// Rotate selected anchor points around center. Shift = 15° increments.
export function rotatePointsTransform(contours, origPts, center, startAngle, fp, shiftKey) {
  let ang = Math.atan2(fp.y - center.y, fp.x - center.x) - startAngle;
  if (shiftKey) { const step = Math.PI / 12; ang = Math.round(ang / step) * step; }
  const cos = Math.cos(ang), sin = Math.sin(ang), cx = center.x, cy = center.y;
  return contours.map((c, ci) => {
    const opts = origPts.filter((o) => o.ci === ci);
    if (!opts.length) return c;
    const cpts = [...c.points];
    opts.forEach((o) => {
      const dx = o.x - cx, dy = o.y - cy;
      cpts[o.pi] = {
        ...cpts[o.pi], x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos,
        in: o.in ? { x: cx + (o.in.x - cx) * cos - (o.in.y - cy) * sin, y: cy + (o.in.x - cx) * sin + (o.in.y - cy) * cos } : null,
        out: o.out ? { x: cx + (o.out.x - cx) * cos - (o.out.y - cy) * sin, y: cy + (o.out.x - cx) * sin + (o.out.y - cy) * cos } : null,
      };
    });
    return convertToPath({ ...c, points: cpts });
  });
}