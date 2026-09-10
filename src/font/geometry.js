// Geometry & vector math for DR Font Studio.
// Contour model: { closed: bool, points: [ { x, y, in: {x,y}|null, out: {x,y}|null, type: "corner"|"smooth" } ] }
// "in"/"out" are absolute control-point coordinates (cubic Bézier handles).

import { expandCompounds } from "./booleanEngine";

// Cluster contours by containment so that only nested counterforms (a hole
// fully inside its outer) share a single even-odd path. Contours that merely
// overlap without containment land in separate clusters and are rendered as
// independent paths — so overlapping shapes stay filled instead of knocking
// out. Each contour's parent is the smallest contour whose bbox fully
// contains it and whose polygon contains one of its points.
export function clusterByContainment(contours) {
  const n = contours.length;
  if (n <= 1) return [contours.slice()];
  const bboxes = contours.map((c) => contourBounds(c));
  const parent = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const bi = bboxes[i];
    if (!bi) continue;
    let best = -1, bestArea = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const bj = bboxes[j];
      if (!bj) continue;
      if (bi.minX < bj.minX || bi.minY < bj.minY || bi.maxX > bj.maxX || bi.maxY > bj.maxY) continue;
      const poly = flattenContour(contours[j], 8);
      if (poly.length < 3) continue;
      const testPt = contours[i].points && contours[i].points[0];
      if (!testPt || !pointInPolygon(testPt, poly)) continue;
      const area = (bj.maxX - bj.minX) * (bj.maxY - bj.minY);
      if (area < bestArea) { bestArea = area; best = j; }
    }
    parent[i] = best;
  }
  const visited = new Array(n).fill(false);
  const clusters = [];
  for (let i = 0; i < n; i++) {
    if (parent[i] !== -1) continue;
    const cluster = [];
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      if (visited[k]) continue;
      visited[k] = true;
      cluster.push(contours[k]);
      for (let m = 0; m < n; m++) if (parent[m] === k && !visited[m]) stack.push(m);
    }
    clusters.push(cluster);
  }
  for (let i = 0; i < n; i++) if (!visited[i]) clusters.push([contours[i]]);
  return clusters;
}

export function bezPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt, t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

// Flatten a contour to a polyline (on-curve points only), subdividing curves.
export function flattenContour(contour, steps = 16) {
  contour = expandCorners(contour);
  const pts = [];
  const p = contour.points;
  if (!p || p.length === 0) return pts;
  const n = p.length;
  const segCount = contour.closed ? n : n - 1;
  if (segCount <= 0) {
    pts.push({ x: p[0].x, y: p[0].y });
    return pts;
  }
  for (let i = 0; i < segCount; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    pts.push({ x: a.x, y: a.y });
    const c1 = a.out, c2 = b.in;
    if (c1 || c2) {
      const cc1 = c1 || a;
      const cc2 = c2 || b;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        pts.push(bezPoint(a, cc1, cc2, b, t));
      }
    }
  }
  if (!contour.closed) pts.push({ x: p[n - 1].x, y: p[n - 1].y });
  return pts;
}

export function contourBounds(contour) {
  const pts = flattenContour(contour, 10);
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function glyphBounds(glyph) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const consider = (c) => {
    const b = contourBounds(c);
    if (!b) return;
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  };
  (glyph.contours || []).forEach(consider);
  return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

// Live Corners: info for a sharp convex corner at index i.
// Returns interior angle, inward bisector, edge unit vectors, edge lengths — or null.
export function cornerInfo(contour, i, isHoleOverride) {
  const p = contour.points;
  const n = p.length;
  if (!p || n < 3) return null;
  const closed = contour.closed;
  if (!closed && (i === 0 || i === n - 1)) return null;
  const pt = p[i];
  const prev = closed ? p[(i - 1 + n) % n] : p[i - 1];
  const next = closed ? p[(i + 1) % n] : p[i + 1];
  if (!prev || !next) return null;
  if (pt.in || pt.out || prev.out || next.in) return null; // only sharp corners
  const dInx = pt.x - prev.x, dIny = pt.y - prev.y;
  const dOutx = next.x - pt.x, dOuty = next.y - pt.y;
  const lenIn = Math.hypot(dInx, dIny), lenOut = Math.hypot(dOutx, dOuty);
  if (lenIn < 1e-6 || lenOut < 1e-6) return null;
  const uInx = dInx / lenIn, uIny = dIny / lenIn, uOutx = dOutx / lenOut, uOuty = dOuty / lenOut;
  const cross = uInx * uOuty - uIny * uOutx;
  const dot = uInx * uOutx + uIny * uOuty;
  let area = 0;
  for (let k = 0; k < n; k++) { const a = p[k], b = p[(k + 1) % n]; area += a.x * b.y - b.x * a.y; }
  const s = area >= 0 ? 1 : -1;
  const tau = Math.atan2(cross, dot);
  const theta = Math.PI - tau; // interior angle (convex: < PI, concave/reflex: > PI)
  if (theta <= 0.03 || theta >= Math.PI * 2 - 0.03) return null;
  const half = theta / 2;
  // Material side depends on whether this contour is a hole (inside another
  // contour), not just winding direction. The caller may pass isHoleOverride
  // (computed via containment testing) or set contour.isHole; otherwise we
  // fall back to winding (CCW = outer, CW = hole) which works for standard draws.
  const isHole = isHoleOverride !== undefined ? isHoleOverride : (contour.isHole || s < 0);
  const materialSign = isHole ? -s : s;
  // Convexity = material protrudes at corner. theta is the left-side angle.
  // For non-holes the material is on the interior side; for holes it's on the
  // exterior side — so hole status flips the convexity test.
  const isConvex = ((s > 0) === (theta < Math.PI)) !== isHole;
  const lnx = -uIny - uOuty, lny = uInx + uOutx; // sum of left normals
  const lnLen = Math.hypot(lnx, lny);
  if (lnLen < 1e-6) return null;
  // Bisector points into the material: materialSign * left-normals.
  const bx = (materialSign * lnx) / lnLen, by = (materialSign * lny) / lnLen;
  return { theta, half, bisector: { x: bx, y: by }, uIn: { x: uInx, y: uIny }, uOut: { x: uOutx, y: uOuty }, lenIn, lenOut, isConvex };
}

// Expand live corners (per-point radius r + type ct) into fillet geometry for
// rendering and export. Non-destructive: the source contour keeps the corner
// anchor with its r/ct; this returns a rendered copy.
export function expandCorners(contour, isHoleOverride) {
  const p = contour.points;
  if (!p || p.length === 0) return contour;
  if (!p.some((pt) => pt.r && pt.r > 0)) return contour;
  const n = p.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const pt = p[i];
    if (!pt.r || pt.r <= 0) { out.push(pt); continue; }
    const info = cornerInfo(contour, i, isHoleOverride);
    if (!info) { out.push(pt); continue; }
    const { theta, half, bisector, uIn, uOut, lenIn, lenOut, isConvex } = info;
    // effHalf depends on the raw geometric theta, not the adjusted isConvex.
    const effHalf = (theta < Math.PI) ? half : (Math.PI - half);
    const maxD = Math.min(lenIn, lenOut) * 0.49;
    let d = pt.r / Math.tan(effHalf);
    if (d > maxD) d = maxD;
    const r = d * Math.tan(effHalf);
    const T1 = { x: pt.x - uIn.x * d, y: pt.y - uIn.y * d };
    const T2 = { x: pt.x + uOut.x * d, y: pt.y + uOut.y * d };
    const type = pt.ct || "round";
    if (type === "chamfer") {
      out.push({ x: T1.x, y: T1.y, type: "corner", in: null, out: null });
      out.push({ x: T2.x, y: T2.y, type: "corner", in: null, out: null });
    } else if (type === "inverted") {
      const depth = d * 1.25;
      // Inverted pushes handles opposite to the normal fillet: into negative
      // space for convex (bump), into material for concave (notch).
      const idx = isConvex ? -bisector.x : bisector.x;
      const idy = isConvex ? -bisector.y : bisector.y;
      const cp1 = { x: T1.x + idx * depth, y: T1.y + idy * depth };
      const cp2 = { x: T2.x + idx * depth, y: T2.y + idy * depth };
      out.push({ x: T1.x, y: T1.y, type: "smooth", in: null, out: cp1 });
      out.push({ x: T2.x, y: T2.y, type: "smooth", in: cp2, out: null });
    } else {
      const cDist = r / Math.sin(effHalf);
      // Fillet center is in the material for convex corners (bisector direction),
      // in the negative space for concave corners (opposite bisector).
      const fdx = isConvex ? bisector.x : -bisector.x;
      const fdy = isConvex ? bisector.y : -bisector.y;
      const C = { x: pt.x + fdx * cDist, y: pt.y + fdy * cDist };
      const v1 = { x: T1.x - C.x, y: T1.y - C.y };
      const v2 = { x: T2.x - C.x, y: T2.y - C.y };
      const sweep = v1.x * v2.y - v1.y * v2.x > 0 ? 1 : -1;
      // Unit tangent vectors at the arc endpoints (perpendicular to the radii).
      // v1/v2 have magnitude r, so they MUST be normalized — otherwise the cubic
      // handle length scales by r a second time, extruding the arc outward into
      // balloon loops instead of an inward fillet.
      const m1 = Math.hypot(v1.x, v1.y) || 1;
      const m2 = Math.hypot(v2.x, v2.y) || 1;
      const t1x = (-v1.y * sweep) / m1, t1y = (v1.x * sweep) / m1;
      const t2x = (-v2.y * sweep) / m2, t2y = (v2.x * sweep) / m2;
      const phi = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (r * r))));
      const handleLen = r * (4 / 3) * Math.tan(phi / 4);
      out.push({ x: T1.x, y: T1.y, type: "smooth", in: null, out: { x: T1.x + t1x * handleLen, y: T1.y + t1y * handleLen } });
      out.push({ x: T2.x, y: T2.y, type: "smooth", in: { x: T2.x - t2x * handleLen, y: T2.y - t2y * handleLen }, out: null });
    }
  }
  return { ...contour, points: out };
}

// Build an SVG path "d" string. toScreen maps font coords -> screen coords.
export function pathD(contour, toScreen) {
  contour = expandCorners(contour);
  const p = contour.points;
  if (!p || p.length === 0) return "";
  const n = p.length;
  const segCount = contour.closed ? n : n - 1;
  const s0 = toScreen(p[0]);
  let d = `M ${s0.x.toFixed(4)} ${s0.y.toFixed(4)}`;
  for (let i = 0; i < segCount; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const bs = toScreen(b);
    if (a.out || b.in) {
      const c1s = toScreen(a.out || a);
      const c2s = toScreen(b.in || b);
      d += ` C ${c1s.x.toFixed(4)} ${c1s.y.toFixed(4)} ${c2s.x.toFixed(4)} ${c2s.y.toFixed(4)} ${bs.x.toFixed(4)} ${bs.y.toFixed(4)}`;
    } else {
      d += ` L ${bs.x.toFixed(4)} ${bs.y.toFixed(4)}`;
    }
  }
  if (contour.closed) d += " Z";
  return d;
}

export function transformContour(contour, fn) {
  if (contour.compound) {
    return { ...contour, compound: { ...contour.compound, members: contour.compound.members.map((m) => transformContour(m, fn)) } };
  }
  return {
    ...contour,
    points: contour.points.map((p) => ({
      x: fn(p.x, p.y).x,
      y: fn(p.x, p.y).y,
      in: p.in ? fn(p.in.x, p.in.y) : null,
      out: p.out ? fn(p.out.x, p.out.y) : null,
      type: p.type,
      r: p.r,
      ct: p.ct,
      hideHandles: p.hideHandles,
    })),
  };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Point-in-polygon test (ray casting).
export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Approximate a circle/ellipse contour with 4 cubic Bézier quarters.
export function ellipseContour(x, y, w, h) {
  const k = 0.5522847498;
  const rx = w / 2, ry = h / 2;
  const cx = x + rx, cy = y + ry;
  const ox = rx * k, oy = ry * k;
  const mk = (px, py, ix, iy, ox2, oy2) => ({
    x: px, y: py, type: "smooth",
    out: { x: cx + ix, y: cy + iy }, in: { x: cx + ox2, y: cy + oy2 },
  });
  return {
    closed: true,
    points: [
      mk(cx + rx, cy, rx, oy, rx, -oy),
      mk(cx, cy + ry, -ox, ry, ox, ry),
      mk(cx - rx, cy, -rx, -oy, -rx, oy),
      mk(cx, cy - ry, ox, -ry, -ox, -ry),
    ],
  };
}

export function rectContour(x, y, w, h) {
  const corner = (px, py) => ({ x: px, y: py, type: "corner", in: null, out: null });
  return {
    closed: true,
    points: [
      corner(x, y), corner(x + w, y), corner(x + w, y + h), corner(x, y + h),
    ],
  };
}

// Rounded rectangle: 8 tangent points, each corner a cubic Bézier quarter-arc.
export function roundedRectContour(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const k = 0.5522847498 * r;
  const P = (px, py, inH, outH) => ({ x: px, y: py, in: inH, out: outH, type: "corner" });
  return {
    closed: true,
    points: [
      P(x + r, y, { x: x + r - k, y }, null),
      P(x + w - r, y, null, { x: x + w - r + k, y }),
      P(x + w, y + r, { x: x + w, y: y + r - k }, null),
      P(x + w, y + h - r, null, { x: x + w, y: y + h - r + k }),
      P(x + w - r, y + h, { x: x + w - r + k, y: y + h }, null),
      P(x + r, y + h, null, { x: x + r - k, y: y + h }),
      P(x, y + h - r, { x: x, y: y + h - r + k }, null),
      P(x, y + r, null, { x: x, y: y + r - k }),
    ],
  };
}

// Isosceles triangle pointing up.
export function triangleContour(x, y, w, h) {
  const P = (px, py) => ({ x: px, y: py, in: null, out: null, type: "corner" });
  return { closed: true, points: [P(x + w / 2, y), P(x + w, y + h), P(x, y + h)] };
}

// Regular n-gon inscribed in the bounding box.
export function polygonContour(x, y, w, h, n) {
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), in: null, out: null, type: "corner" });
  }
  return { closed: true, points: pts };
}

// n-pointed star with alternating outer/inner radii.
export function starContour(x, y, w, h, n, innerRatio = 0.5) {
  const cx = x + w / 2, cy = y + h / 2;
  const rOut = Math.min(w, h) / 2;
  const rIn = rOut * innerRatio;
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), in: null, out: null, type: "corner" });
  }
  return { closed: true, points: pts };
}

// Build a contour for any shape tool from its drag bounding box.
export function shapeContour(type, x, y, w, h) {
  switch (type) {
    case "rectangle": return rectContour(x, y, w, h);
    case "roundedRect": return roundedRectContour(x, y, w, h, Math.min(w, h) * 0.2);
    case "circle": { const s = Math.max(w, h); return ellipseContour(x, y, s, s); }
    case "ellipse": return ellipseContour(x, y, w, h);
    case "triangle": return triangleContour(x, y, w, h);
    case "polygon": return polygonContour(x, y, w, h, 6);
    case "star": return starContour(x, y, w, h, 5, 0.5);
    default: return rectContour(x, y, w, h);
  }
}

// Unit vector of (x, y), or zero-length fallback.
function unit(x, y) { const len = Math.hypot(x, y) || 1; return { x: x / len, y: y / len }; }

// Circular arc (flattened) of radius r around `center`, from `fromAng` to `toAng`
// the short way. Returns intermediate corner points (outer round join).
function arcPoints(center, r, fromAng, toAng) {
  let delta = toAng - fromAng;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const sweep = delta >= 0 ? 1 : -1;
  const steps = Math.max(6, Math.ceil(Math.abs(delta) / (Math.PI / 16)));
  const pts = [];
  for (let s = 1; s < steps; s++) {
    const ang = fromAng + sweep * Math.abs(delta) * (s / steps);
    pts.push({ x: center.x + r * Math.cos(ang), y: center.y + r * Math.sin(ang), in: null, out: null, type: "corner" });
  }
  return pts;
}

// Semicircle end cap of radius r centered at `center`, from `startEdge` bulging
// in `capDir`. Returns intermediate corner points (round cap).
function capArc(center, r, startEdge, capDir) {
  const startAngle = Math.atan2(startEdge.y - center.y, startEdge.x - center.x);
  const poleAngle = Math.atan2(capDir.y, capDir.x);
  let delta = poleAngle - startAngle;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const sweep = delta >= 0 ? 1 : -1;
  const pts = [];
  for (let s = 1; s < 16; s++) {
    const ang = startAngle + sweep * Math.PI * (s / 16);
    pts.push({ x: center.x + r * Math.cos(ang), y: center.y + r * Math.sin(ang), in: null, out: null, type: "corner" });
  }
  return pts;
}

// Variable-width brush stroke: closed outline from a centerline with per-point
// pressure p (0..1). True round brush — outer corners get circular arcs (round
// join), inner corners get a miter intersection, ends get round caps. This is
// the Minkowski sum of the centerline with a disk, so edges are 100% round.
export function brushStrokeContour(points, baseSize) {
  const n = points.length;
  if (n === 0) return null;
  if (n === 1) {
    const r = (baseSize * points[0].p) / 2;
    return { ...ellipseContour(points[0].x - r, points[0].y - r, r * 2, r * 2), fillRule: "nonzero", isBrush: true };
  }
  const rad = (i) => (baseSize * points[i].p) / 2;
  const dirs = [];
  for (let i = 0; i < n - 1; i++) dirs.push(unit(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y));
  const segLen = (i) => dist(points[i], points[i + 1]);
  const lnorm = (d) => ({ x: -d.y, y: d.x });
  const rnorm = (d) => ({ x: d.y, y: -d.x });

  // Miter (inner corner): intersection of the two offset edges, clamped to avoid spikes.
  const miter = (i, normalFn) => {
    const d_in = dirs[i - 1], d_out = dirs[i];
    const n_in = normalFn(d_in), n_out = normalFn(d_out);
    const r = rad(i);
    const A = { x: points[i].x + n_in.x * r, y: points[i].y + n_in.y * r };
    const B = { x: points[i].x + n_out.x * r, y: points[i].y + n_out.y * r };
    const cross = d_in.x * d_out.y - d_in.y * d_out.x;
    if (Math.abs(cross) < 1e-6) return { ...A, in: null, out: null, type: "corner" };
    const t = ((B.x - A.x) * d_out.y - (B.y - A.y) * d_out.x) / cross;
    const mx = A.x + t * d_in.x, my = A.y + t * d_in.y;
    if (Math.hypot(mx - points[i].x, my - points[i].y) > r * 4) return { ...A, in: null, out: null, type: "corner" };
    return { x: mx, y: my, in: null, out: null, type: "corner" };
  };

  // Build one side forward (0..n-1). `normalFn` = lnorm/rnorm; `isOuterWhen(cross)`
  // returns true when this side is the outer (convex) side of the turn.
  const buildSide = (normalFn, isOuterWhen) => {
    const side = [];
    const r0 = rad(0), n0 = normalFn(dirs[0]);
    side.push({ x: points[0].x + n0.x * r0, y: points[0].y + n0.y * r0, in: null, out: null, type: "corner" });
    for (let i = 1; i < n - 1; i++) {
      const d_in = dirs[i - 1], d_out = dirs[i];
      const cross = d_in.x * d_out.y - d_in.y * d_out.x;
      const r = rad(i);
      if (Math.abs(cross) < 1e-4) {
        // Straight run: smooth point with handles along the segment direction.
        const p = { x: points[i].x + normalFn(d_out).x * r, y: points[i].y + normalFn(d_out).y * r };
        const dF = segLen(i) * 0.3, dB = segLen(i - 1) * 0.3;
        side.push({ x: p.x, y: p.y, type: "smooth", out: { x: p.x + d_out.x * dF, y: p.y + d_out.y * dF }, in: { x: p.x - d_in.x * dB, y: p.y - d_in.y * dB } });
      } else if (isOuterWhen(cross)) {
        // Outer corner: offset point from each segment + circular arc between.
        const n_in = normalFn(d_in), n_out = normalFn(d_out);
        const L_in = { x: points[i].x + n_in.x * r, y: points[i].y + n_in.y * r };
        const L_out = { x: points[i].x + n_out.x * r, y: points[i].y + n_out.y * r };
        side.push({ ...L_in, in: null, out: null, type: "corner" });
        side.push(...arcPoints(points[i], r, Math.atan2(L_in.y - points[i].y, L_in.x - points[i].x), Math.atan2(L_out.y - points[i].y, L_out.x - points[i].x)));
        side.push({ ...L_out, in: null, out: null, type: "corner" });
      } else {
        side.push(miter(i, normalFn));
      }
    }
    const rN = rad(n - 1), nN = normalFn(dirs[n - 2]);
    side.push({ x: points[n - 1].x + nN.x * rN, y: points[n - 1].y + nN.y * rN, in: null, out: null, type: "corner" });
    return side;
  };

  const leftSide = buildSide(lnorm, (cross) => cross < 0);
  const rightSideFwd = buildSide(rnorm, (cross) => cross > 0);
  // Right side is traversed backward: reverse and swap smooth in/out handles.
  const rightSide = rightSideFwd.slice().reverse().map((p) => (p.type === "smooth" ? { ...p, in: p.out, out: p.in } : p));

  const endCap = capArc(points[n - 1], rad(n - 1), leftSide[leftSide.length - 1], dirs[n - 2]);
  const startCap = capArc(points[0], rad(0), rightSide[0], { x: -dirs[0].x, y: -dirs[0].y });

  return { closed: true, points: [...leftSide, ...endCap, ...rightSide, ...startCap], fillRule: "nonzero", isBrush: true };
}

export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// De Casteljau split of a cubic segment at t. Returns handles to insert a node
// that preserves the curve exactly.
export function cubicSplit(p0, p1, p2, p3, t) {
  const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
  const d = lerp(a, b, t), e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return { point: f, leftOut: a, newIn: d, newOut: e, rightIn: c };
}

// Determine which contours are holes (inside an odd number of other contours)
// using the even-odd rule. Annotates each contour with an isHole boolean so
// that cornerInfo/expandCorners can compute the correct material side.
export function annotateHoles(contours) {
  const polys = contours.map((c) => {
    if (!c || !c.points || c.points.length < 3) return null;
    return c.points;
  });
  return contours.map((c, i) => {
    if (!c || !c.points || c.points.length < 3) return c;
    const testPoint = c.points[0];
    let inside = 0;
    for (let j = 0; j < contours.length; j++) {
      if (i === j || !polys[j] || polys[j].length < 3) continue;
      if (pointInPolygon(testPoint, polys[j])) inside++;
    }
    return { ...c, isHole: inside % 2 === 1 };
  });
}

// Resolve a glyph's renderable contours: own contours + transformed component
// contours (recursively). Used by canvas fill, preview, thumbnails, and export.
export function resolveContours(glyph, glyphs, depth = 0) {
  if (depth > 6) return [];
  let out = [...(glyph.contours || [])].filter((c) => !c.hidden);
  for (const comp of glyph.components || []) {
    const base = glyphs?.[comp.baseChar];
    if (!base) continue;
    const rad = ((comp.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const sx = comp.scaleX ?? 1, sy = comp.scaleY ?? 1;
    const tx = comp.x ?? 0, ty = comp.y ?? 0;
    const fn = (x, y) => {
      const px = x * sx, py = y * sy;
      return { x: px * cos - py * sin + tx, y: px * sin + py * cos + ty };
    };
    out = out.concat(resolveContours(base, glyphs, depth + 1).map((c) => transformContour(c, fn)));
  }
  return annotateHoles(expandCompounds(out));
}

export function reverseContour(contour) {
  return {
    ...contour,
    points: [...contour.points].reverse().map((p) => ({ ...p, in: p.out, out: p.in })),
  };
}