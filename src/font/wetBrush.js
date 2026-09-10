// Wet Brush — additive swept-region vector generator.
//
// Architecture: trajectory → Minkowski sum (capsules) → Boolean Union → clean contour.
//
// Each centerline segment becomes a capsule (Minkowski sum of segment + disc),
// generated as its own closed contour with consistent clockwise winding.
// All capsules are then united via the Boolean engine into a single clean
// contour (outer + holes). This is the additive region: R = ⋃ Fᵢ.
//
// Self-intersections remain filled because union is idempotent (A ∪ A = A).
// The result is a single editable vector object, not many separate capsules.
//
// If the Boolean engine fails (rare edge case), we fall back to the raw
// capsules with non-zero fill — still no holes, just multiple contours.
import { dist, ellipseContour, brushStrokeContour } from "./geometry";
import { runShapeShifter } from "./booleanEngine";

function perpDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Douglas-Peucker on an open centerline (keeps sharp turns, preserves pressure).
// This is the "Fidelity" filter: ε = tolerance controls how far the mouse must
// move before a new anchor point is registered.
function dpCL(points, tol) {
  if (points.length < 3) return points.slice();
  let maxD = 0, idx = -1;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (idx === -1 || maxD < tol) return [first, last];
  const left = dpCL(points.slice(0, idx + 1), tol);
  const right = dpCL(points.slice(idx), tol);
  return left.slice(0, -1).concat(right);
}

const K = 0.5522847498; // Bézier circle approximation constant

// Build a capsule (Minkowski sum of segment AB + disc of radius r).
// 6 smooth Bézier points, clockwise winding in font coords.
function capsule(a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const tx = dx / len, ty = dy / len;
  const nx = -ty, ny = tx; // left normal
  const k = K * r;
  const h = len / 3;
  const aTop = { x: a.x + nx * r, y: a.y + ny * r };
  const bTop = { x: b.x + nx * r, y: b.y + ny * r };
  const bCap = { x: b.x + tx * r, y: b.y + ty * r };
  const bBot = { x: b.x - nx * r, y: b.y - ny * r };
  const aBot = { x: a.x - nx * r, y: a.y - ny * r };
  const aCap = { x: a.x - tx * r, y: a.y - ty * r };
  return {
    closed: true,
    isWetBrush: true,
    fillRule: "nonzero",
    points: [
      { x: aTop.x, y: aTop.y, type: "smooth",
        in: { x: aTop.x - tx * k, y: aTop.y - ty * k },
        out: { x: aTop.x + tx * h, y: aTop.y + ty * h } },
      { x: bTop.x, y: bTop.y, type: "smooth",
        in: { x: bTop.x - tx * h, y: bTop.y - ty * h },
        out: { x: bTop.x + tx * k, y: bTop.y + ty * k } },
      { x: bCap.x, y: bCap.y, type: "smooth",
        in: { x: bCap.x + nx * k, y: bCap.y + ny * k },
        out: { x: bCap.x - nx * k, y: bCap.y - ny * k } },
      { x: bBot.x, y: bBot.y, type: "smooth",
        in: { x: bBot.x + tx * k, y: bBot.y + ty * k },
        out: { x: bBot.x - tx * h, y: bBot.y - ty * h } },
      { x: aBot.x, y: aBot.y, type: "smooth",
        in: { x: aBot.x + tx * h, y: aBot.y + ty * h },
        out: { x: aBot.x - tx * k, y: aBot.y - ty * k } },
      { x: aCap.x, y: aCap.y, type: "smooth",
        in: { x: aCap.x - nx * k, y: aCap.y - ny * k },
        out: { x: aCap.x + nx * k, y: aCap.y + ny * k } },
    ],
  };
}

// Generate capsules (Minkowski sums) for a centerline. Shared by Brush and
// Wet Brush. Each capsule is a separate contour with smooth Bézier anchor
// points and non-zero fill — overlaps accumulate without holes.
export function brushCapsules(points, baseSize) {
  const n = points.length;
  if (n === 0) return null;
  const rad = (p) => (baseSize * (p.p ?? 1)) / 2;

  if (n === 1) {
    const r = rad(points[0]);
    return [{ ...ellipseContour(points[0].x - r, points[0].y - r, r * 2, r * 2), fillRule: "nonzero" }];
  }

  let center = dpCL(points, Math.max(0.5, baseSize * 0.1));
  const dedup = [];
  for (const p of center) {
    if (!dedup.length || dist(dedup[dedup.length - 1], p) > 0.5) dedup.push(p);
  }
  center = dedup;

  if (center.length < 2) {
    const r = rad(center[0]);
    return [{ ...ellipseContour(center[0].x - r, center[0].y - r, r * 2, r * 2), fillRule: "nonzero" }];
  }

  const capsules = [];
  for (let i = 0; i < center.length - 1; i++) {
    const r = (rad(center[i]) + rad(center[i + 1])) / 2;
    const cap = capsule(center[i], center[i + 1], r);
    if (cap) capsules.push(cap);
  }
  return capsules.length ? capsules : null;
}

// Wet Brush: capsules → Boolean Union → single clean contour (outer + holes).
export function wetBrushOutline(points, baseSize) {
  const capsules = brushCapsules(points, baseSize);
  if (!capsules) return null;
  if (capsules.length <= 1) return capsules.map((c) => ({ ...c, isWetBrush: true }));

  // Boolean Union of all capsules → single clean contour (outer + holes).
  // R = ⋃ Fᵢ — additive, never subtracts. Self-intersections remain filled.
  try {
    const result = runShapeShifter(capsules, "unite", { steps: 20, removeRedundant: true });
    if (result.contours && result.contours.length) {
      return result.contours.map((c) => ({ ...c, isWetBrush: true }));
    }
  } catch (e) {
    // Fall back to raw capsules with non-zero fill (still no holes).
  }
  return capsules;
}

// Brush Tool: centerline → Douglas-Peucker simplification → single closed
// outline (Minkowski sum of centerline + disk). Returns ONE contour per stroke
// (not one per segment), with smooth Bézier runs, round joins/caps and
// miter inner corners. Pressure (p) is preserved through simplification.
export function brushStroke(points, baseSize) {
  const n = points ? points.length : 0;
  if (n === 0) return null;
  const rad = (p) => (baseSize * (p.p ?? 1)) / 2;
  if (n === 1) {
    const r = rad(points[0]);
    return { ...ellipseContour(points[0].x - r, points[0].y - r, r * 2, r * 2), fillRule: "nonzero", isBrush: true };
  }
  let center = dpCL(points, Math.max(0.5, baseSize * 0.1));
  const dedup = [];
  for (const p of center) {
    if (!dedup.length || dist(dedup[dedup.length - 1], p) > 0.5) dedup.push(p);
  }
  center = dedup;
  if (center.length < 2) {
    const r = rad(center[0]);
    return { ...ellipseContour(center[0].x - r, center[0].y - r, r * 2, r * 2), fillRule: "nonzero", isBrush: true };
  }
  return brushStrokeContour(center, baseSize);
}