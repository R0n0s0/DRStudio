import { bezPoint } from "@/font/geometry";

// ---------- Stroke option catalogs (used by the panel + renderer) ----------
export const CAP_OPTIONS = [
  { id: "butt", label: "Butt Cap" },
  { id: "round", label: "Round Cap" },
  { id: "projecting", label: "Projecting Cap" },
];
export const JOIN_OPTIONS = [
  { id: "miter", label: "Miter Join" },
  { id: "round", label: "Round Join" },
  { id: "bevel", label: "Bevel Join" },
];
export const ARROW_TYPES = [
  { id: "none", label: "None" },
  { id: "simple", label: "Simple" },
  { id: "stealth", label: "Stealth" },
  { id: "barbed", label: "Barbed" },
  { id: "circle", label: "Circle" },
  { id: "square", label: "Square" },
];
export const WIDTH_PROFILES = [
  { id: "uniform", label: "Uniform" },
  { id: "width1", label: "Width 1 · Oval" },
  { id: "width2", label: "Width 2 · Wave" },
  { id: "width3", label: "Width 3 · Taper" },
  { id: "width4", label: "Width 4 · Hex" },
  { id: "width5", label: "Width 5 · Half" },
];

// Map internal cap id -> SVG stroke-linecap value.
export function capToSvg(cap) {
  return cap === "round" ? "round" : cap === "projecting" ? "square" : "butt";
}

// Build an SVG stroke-dasharray string (screen space) from a dash pattern.
export function dashArrayCss(pattern, zoom) {
  if (!pattern || !pattern.length) return undefined;
  const arr = pattern.filter((v) => v > 0);
  if (!arr.length) return undefined;
  return arr.map((v) => +(v * zoom).toFixed(2)).join(" ");
}

// ---------- Variable Width Profiles ----------
// Returns a normalized width factor (0..1) at path position t (0..1).
export function widthFactor(profile, t, flipAlong, flipAcross) {
  const u = flipAlong ? 1 - t : t;
  let w;
  switch (profile) {
    case "width1": w = Math.sin(Math.PI * u); break;
    case "width2": w = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(2 * Math.PI * u)); break;
    case "width3": w = 1 - u; break;
    case "width4": w = Math.min(1, Math.min(u, 1 - u) / 0.18); break;
    case "width5": w = Math.sin(Math.PI * u); break;
    default: w = 1;
  }
  return Math.max(0, Math.min(1, w));
}

// Width 5 is inherently one-sided; flipAcross makes any profile one-sided.
export function isOneSided(profile, flipAcross) {
  return flipAcross || profile === "width5";
}

// Sample a contour into a list of points (font coords) with tangents.
function sampleContour(contour, stepsPerSeg = 14) {
  const pts = contour.points;
  const n = pts.length;
  if (n < 2) return [];
  const segCount = contour.closed ? n : n - 1;
  const out = [];
  for (let i = 0; i < segCount; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const curved = !!(a.out || b.in);
    const isLast = i === segCount - 1 && !contour.closed;
    const steps = isLast ? stepsPerSeg : stepsPerSeg - 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / stepsPerSeg;
      const p = curved ? bezPoint(a, a.out || a, b.in || b, b, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
}

// Build a filled tapered-stroke outline (screen-space path d) for a variable-width stroke.
export function buildTaperedStroke(contour, ap, toScreen) {
  const samples = sampleContour(contour);
  const N = samples.length;
  if (N < 2) return "";
  const pos = samples.map((p, i) => {
    const next = samples[(i + 1) % N];
    const prev = samples[(i - 1 + N) % N];
    let tx = next.x - prev.x, ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: p.x, y: p.y, tx: tx / len, ty: ty / len };
  });
  const oneSided = isOneSided(ap.widthProfile, ap.widthProfileFlipAcross);
  const side = ap.widthProfileFlipAcross ? -1 : 1;
  const left = [], right = [];
  for (let i = 0; i < N; i++) {
    const t = contour.closed ? i / N : i / (N - 1);
    const wf = widthFactor(ap.widthProfile, t, ap.widthProfileFlipAlong, ap.widthProfileFlipAcross);
    const w = wf * ap.strokeWidth;
    const nx = -pos[i].ty, ny = pos[i].tx;
    if (oneSided) {
      left.push({ x: pos[i].x + nx * w * side, y: pos[i].y + ny * w * side });
      right.push({ x: pos[i].x, y: pos[i].y });
    } else {
      left.push({ x: pos[i].x + nx * w / 2, y: pos[i].y + ny * w / 2 });
      right.push({ x: pos[i].x - nx * w / 2, y: pos[i].y - ny * w / 2 });
    }
  }
  const toD = (p) => { const s = toScreen(p); return `${s.x.toFixed(2)},${s.y.toFixed(2)}`; };
  let d = "M " + toD(left[0]);
  for (let i = 1; i < left.length; i++) d += " L " + toD(left[i]);
  for (let i = right.length - 1; i >= 0; i--) d += " L " + toD(right[i]);
  return d + " Z";
}

// Outward unit tangents (font coords) at the path start and end.
export function endpointTangents(contour) {
  const pts = contour.points;
  const n = pts.length;
  if (n < 2) return { start: { x: 1, y: 0 }, end: { x: 1, y: 0 } };
  const p0 = pts[0], p1 = pts[1];
  let sx = (p0.out ? p0.out.x : p1.x) - p0.x, sy = (p0.out ? p0.out.y : p1.y) - p0.y;
  const sl = Math.hypot(sx, sy) || 1; sx /= sl; sy /= sl;
  const pl = pts[n - 1], pm = pts[n - 2];
  let ex = pl.x - (pl.in ? pl.in.x : pm.x), ey = pl.y - (pl.in ? pl.in.y : pm.y);
  const el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
  return { start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

// Build an arrowhead path (screen coords) at point P with outward tangent T.
export function arrowheadPath(P, T, type, scale, align, strokeWidth, toScreen) {
  const s = (scale == null ? 100 : scale) / 100;
  const base = Math.max(strokeWidth, 1);
  const len = base * 4 * s + base * 2;
  const wid = base * 3 * s + base;
  const Ps = toScreen(P);
  const P2 = toScreen({ x: P.x + T.x, y: P.y + T.y });
  let tx = P2.x - Ps.x, ty = P2.y - Ps.y;
  const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const nx = -ty, ny = tx;
  const tip = align === "extend" ? { x: Ps.x + tx * len, y: Ps.y + ty * len } : Ps;
  const baseC = align === "extend" ? Ps : { x: Ps.x - tx * len, y: Ps.y - ty * len };
  const bl = { x: baseC.x + nx * wid / 2, y: baseC.y + ny * wid / 2 };
  const br = { x: baseC.x - nx * wid / 2, y: baseC.y - ny * wid / 2 };
  const f = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  switch (type) {
    case "simple": return `M ${f(tip)} L ${f(bl)} L ${f(br)} Z`;
    case "stealth": {
      const inner = { x: baseC.x + tx * len * 0.4, y: baseC.y + ty * len * 0.4 };
      return `M ${f(tip)} L ${f(bl)} L ${f(inner)} L ${f(br)} Z`;
    }
    case "barbed": {
      const back = { x: baseC.x - tx * len * 0.3, y: baseC.y - ty * len * 0.3 };
      return `M ${f(tip)} L ${f(bl)} L ${f(back)} L ${f(br)} Z`;
    }
    case "circle": {
      const r = len * 0.5;
      const cx = align === "extend" ? Ps.x + tx * r : Ps.x - tx * r;
      const cy = align === "extend" ? Ps.y + ty * r : Ps.y - ty * r;
      return `M ${cx - r},${cy} a ${r},${r} 0 1 0 ${r * 2},0 a ${r},${r} 0 1 0 ${-r * 2},0 Z`;
    }
    case "square": {
      const r = len * 0.5;
      const cx = align === "extend" ? Ps.x + tx * r : Ps.x - tx * r;
      const cy = align === "extend" ? Ps.y + ty * r : Ps.y - ty * r;
      const c1 = { x: cx + nx * r, y: cy + ny * r };
      const c2 = { x: cx + tx * r, y: cy + ty * r };
      const c3 = { x: cx - nx * r, y: cy - ny * r };
      const c4 = { x: cx - tx * r, y: cy - ty * r };
      return `M ${f(c1)} L ${f(c2)} L ${f(c3)} L ${f(c4)} Z`;
    }
    default: return "";
  }
}