// Path simplification for the Wet Brush: reduces a dense ribbon outline to a
// sparse set of anchor points (corners at sharp turns, smooth Béziers
// elsewhere) so the result behaves like Illustrator's Blob Brush output.
import { flattenContour, dist } from "./geometry";

function perpDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const px = a.x + t * dx, py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

// Douglas-Peucker on an open polyline (keeps first and last).
function dpOpen(points, tol) {
  if (points.length < 3) return points.slice();
  let maxD = 0, idx = -1;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (idx === -1 || maxD < tol) return [first, last];
  const left = dpOpen(points.slice(0, idx + 1), tol);
  const right = dpOpen(points.slice(idx), tol);
  return left.slice(0, -1).concat(right);
}

// Douglas-Peucker on a closed polyline: split at the most distant pair, then
// simplify each arc.
function dpClosed(points, tol) {
  if (points.length < 4) return points.slice();
  let far = 1, farD = 0;
  for (let i = 1; i < points.length; i++) {
    const d = dist(points[0], points[i]);
    if (d > farD) { farD = d; far = i; }
  }
  const arc1 = points.slice(0, far + 1);
  const arc2 = points.slice(far).concat([points[0]]);
  const s1 = dpOpen(arc1, tol);
  const s2 = dpOpen(arc2, tol);
  return s1.slice(0, -1).concat(s2.slice(0, -1));
}

// Simplify a closed contour to sparse anchors: sharp turns become corner
// points (so Live Corner widgets apply), smooth stretches become smooth
// Bézier points with tangent handles. Marks the result as a Wet Brush shape.
export function simplifyContour(contour, tol) {
  const poly = flattenContour(contour, 12);
  if (poly.length < 4) return { ...contour, isBrush: false, isWetBrush: true, fillRule: "nonzero" };
  // Skip Douglas-Peucker — it can introduce self-intersections near the start
  // cap that cause fill holes. Keep all boolean union points and mark them smooth.
  const pts = poly;
  const n = pts.length;
  // Wet Brush results are always smooth blobs — mark every point smooth with
  // tangent Bézier handles. The tangent is the bisector of the two edge unit
  // vectors (not the chord), which gives accurate handles at curve/side
  // junctions and prevents the "cut corner" artifact on caps.
  const out = pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const v1x = p.x - prev.x, v1y = p.y - prev.y;
    const v2x = next.x - p.x, v2y = next.y - p.y;
    const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
    // Tangent = normalized sum of incoming and outgoing unit vectors (bisector)
    const tx = v1x / l1 + v2x / l2, ty = v1y / l1 + v2y / l2;
    const tlen = Math.hypot(tx, ty) || 1;
    const ux = tx / tlen, uy = ty / tlen;
    const h = Math.min(l1, l2) * 0.38;
    return { x: p.x, y: p.y, type: "smooth", in: { x: p.x - ux * h, y: p.y - uy * h }, out: { x: p.x + ux * h, y: p.y + uy * h } };
  });
  return { ...contour, points: out, isBrush: false, isWetBrush: true, fillRule: "nonzero" };
}