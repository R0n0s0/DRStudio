// Live Shapes: parametric shape generation for DR Font Studio.
// A live shape contour stores its parameters in `liveShape` and regenerates its
// Bézier points on demand. "Convert to Path" strips the parametric data and
// keeps the points as a standard editable contour.
//
// liveShape schema:
//   { type, x, y, width, height, rotation,
//     cornerRadius: {tl,tr,br,bl},   // rectangle
//     sides,                          // polygon
//     points, innerRadius,            // star (innerRadius = ratio 0..1)
//     arcMode, startAngle, endAngle } // ellipse (arcMode: "full"|"pie"|"arc")

const K = 0.5522847498; // cubic Bézier circle approximation constant

export const LIVE_TOOLS = new Set(["rectangle", "roundedRect", "circle", "ellipse", "polygon", "star"]);

export function toolLiveType(tool) {
  if (tool === "rectangle" || tool === "roundedRect") return "rectangle";
  if (tool === "circle" || tool === "ellipse") return "ellipse";
  if (tool === "polygon") return "polygon";
  if (tool === "star") return "star";
  return null;
}

export function isLiveShape(c) { return !!(c && c.liveShape); }

function rotatePt(p, cx, cy, deg) {
  if (!deg) return { x: p.x, y: p.y };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos };
}

function rotatePoints(points, cx, cy, deg) {
  if (!deg) return points;
  return points.map((p) => {
    const r = rotatePt(p, cx, cy, deg);
    return {
      ...p,
      x: r.x, y: r.y,
      in: p.in ? rotatePt(p.in, cx, cy, deg) : null,
      out: p.out ? rotatePt(p.out, cx, cy, deg) : null,
    };
  });
}

// ---------- Local (unrotated) point builders ----------

function rectPoints(ls) {
  const { x, y, width: w, height: h } = ls;
  const r = ls.cornerRadius || {};
  const maxR = Math.min(w, h) / 2;
  const clamp = (v) => Math.max(0, Math.min(v || 0, maxR));
  const bl = clamp(typeof r === "number" ? r : r.bl);
  const br = clamp(typeof r === "number" ? r : r.br);
  const tr = clamp(typeof r === "number" ? r : r.tr);
  const tl = clamp(typeof r === "number" ? r : r.tl);
  const P = (px, py, inH, outH) => ({ x: px, y: py, in: inH || null, out: outH || null, type: "corner" });
  const pts = [];
  // Points are emitted in perimeter order (CCW): bottom edge, BR corner, right edge,
  // TR corner, top edge, TL corner, left edge, then BL corner closes back to start.
  // Bottom-left bottom tangent (start) — in handle for the BL corner arc
  if (bl > 0) pts.push(P(x + bl, y, { x: x + bl - K * bl, y }, null));
  else pts.push(P(x, y, null, null));
  // Bottom-right corner: bottom tangent (out) + right tangent (in)
  if (br > 0) {
    pts.push(P(x + w - br, y, null, { x: x + w - br + K * br, y }));
    pts.push(P(x + w, y + br, { x: x + w, y: y + br - K * br }, null));
  } else pts.push(P(x + w, y, null, null));
  // Top-right corner: right tangent (out) + top tangent (in)
  if (tr > 0) {
    pts.push(P(x + w, y + h - tr, null, { x: x + w, y: y + h - tr + K * tr }));
    pts.push(P(x + w - tr, y + h, { x: x + w - tr + K * tr, y: y + h }, null));
  } else pts.push(P(x + w, y + h, null, null));
  // Top-left corner: top tangent (out) + left tangent (in)
  if (tl > 0) {
    pts.push(P(x + tl, y + h, null, { x: x + tl - K * tl, y: y + h }));
    pts.push(P(x, y + h - tl, { x: x, y: y + h - tl + K * tl }, null));
  } else pts.push(P(x, y + h, null, null));
  // Bottom-left left tangent (end) — out handle for the BL corner arc (closes to start)
  if (bl > 0) pts.push(P(x, y + bl, null, { x: x, y: y + bl - K * bl }));
  return pts;
}

function ellipseFullPoints(ls) {
  const { x, y, width: w, height: h } = ls;
  const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
  const ox = rx * K, oy = ry * K;
  const mk = (px, py, ix, iy, ox2, oy2) => ({ x: px, y: py, type: "smooth", in: { x: cx + ix, y: cy + iy }, out: { x: cx + ox2, y: cy + oy2 } });
  return [
    mk(cx + rx, cy, rx, -oy, rx, oy),
    mk(cx, cy + ry, ox, ry, -ox, ry),
    mk(cx - rx, cy, -rx, oy, -rx, -oy),
    mk(cx, cy - ry, -ox, -ry, ox, -ry),
  ];
}

function ellipseArcPoints(ls) {
  const { x, y, width: w, height: h, startAngle, endAngle } = ls;
  const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
  const a0 = (startAngle * Math.PI) / 180, a1 = (endAngle * Math.PI) / 180;
  const sweep = a1 - a0;
  const segs = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
  const pt = (ang) => ({ x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
  const tan = (ang) => ({ x: -rx * Math.sin(ang), y: ry * Math.cos(ang) });
  const out = [];
  for (let i = 0; i <= segs; i++) {
    const ang = a0 + (sweep * i) / segs;
    const p = pt(ang);
    let inH = null, outH = null;
    if (i > 0) { const pa = a0 + (sweep * (i - 1)) / segs; const L = (4 / 3) * Math.tan((ang - pa) / 4); const t = tan(ang); inH = { x: p.x - t.x * L, y: p.y - t.y * L }; }
    if (i < segs) { const na = a0 + (sweep * (i + 1)) / segs; const L = (4 / 3) * Math.tan((na - ang) / 4); const t = tan(ang); outH = { x: p.x + t.x * L, y: p.y + t.y * L }; }
    out.push({ x: p.x, y: p.y, in: inH, out: outH, type: "smooth" });
  }
  return out;
}

function ellipsePiePoints(ls) {
  const cx = ls.x + ls.width / 2, cy = ls.y + ls.height / 2;
  const arc = ellipseArcPoints(ls);
  arc[0] = { ...arc[0], in: null, type: "corner" };
  arc[arc.length - 1] = { ...arc[arc.length - 1], out: null, type: "corner" };
  return [{ x: cx, y: cy, in: null, out: null, type: "corner" }, ...arc];
}

function ellipsePoints(ls) {
  if (ls.arcMode === "pie") return ellipsePiePoints(ls);
  if (ls.arcMode === "arc") return ellipseArcPoints(ls);
  return ellipseFullPoints(ls);
}

function polygonPoints(ls) {
  const { x, y, width: w, height: h, sides: n } = ls;
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), in: null, out: null, type: "corner" });
  }
  return pts;
}

function starPoints(ls) {
  const { x, y, width: w, height: h, points: n, innerRadius } = ls;
  const cx = x + w / 2, cy = y + h / 2;
  const rOut = Math.min(w, h) / 2;
  const rIn = rOut * (innerRadius ?? 0.5);
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), in: null, out: null, type: "corner" });
  }
  return pts;
}

function buildLocalPoints(ls) {
  switch (ls.type) {
    case "rectangle": return rectPoints(ls);
    case "ellipse": return ellipsePoints(ls);
    case "polygon": return polygonPoints(ls);
    case "star": return starPoints(ls);
    default: return rectPoints(ls);
  }
}

function isClosed(ls) {
  if (ls.type === "ellipse" && ls.arcMode === "arc") return false;
  return true;
}

// ---------- Public API ----------

export function resolveShapeParams(type, params = {}) {
  const p = { ...params };
  if (type === "rectangle") {
    if (p.cornerRadius == null) p.cornerRadius = 0;
    if (typeof p.cornerRadius === "number") p.cornerRadius = { tl: p.cornerRadius, tr: p.cornerRadius, br: p.cornerRadius, bl: p.cornerRadius };
  }
  if (type === "ellipse") {
    if (p.arcMode == null) p.arcMode = "full";
    if (p.startAngle == null) p.startAngle = 0;
    if (p.endAngle == null) p.endAngle = 360;
  }
  if (type === "polygon" && p.sides == null) p.sides = 6;
  if (type === "star") { if (p.points == null) p.points = 5; if (p.innerRadius == null) p.innerRadius = 0.5; }
  return p;
}

export function rebuildLiveShape(contour) {
  const ls = contour.liveShape;
  if (!ls) return contour;
  const local = buildLocalPoints(ls);
  const cx = ls.x + ls.width / 2, cy = ls.y + ls.height / 2;
  const points = rotatePoints(local, cx, cy, ls.rotation || 0);
  return { ...contour, closed: isClosed(ls), points };
}

export function withLiveShape(contour, patch) {
  const ls = { ...contour.liveShape, ...patch };
  return rebuildLiveShape({ ...contour, liveShape: ls });
}

export function moveLiveShape(contour, dx, dy) {
  return withLiveShape(contour, { x: contour.liveShape.x + dx, y: contour.liveShape.y + dy });
}

export function makeLiveShape(type, x, y, width, height, params = {}) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const resolved = resolveShapeParams(type, params);
  const ls = { type, x, y, width: w, height: h, rotation: params.rotation || 0, ...resolved };
  delete ls._altRotate;
  return rebuildLiveShape({ closed: isClosed(ls), points: [], liveShape: ls });
}

export function convertToPath(contour) {
  if (!contour?.liveShape) return contour;
  const { liveShape, ...rest } = contour;
  return rest;
}

// Scale a live shape from a local handle (rotation-aware). Returns a patch
// { x, y, width, height } for withLiveShape.
export function liveShapeScalePatch(origLS, handle, mouse, proportional) {
  const cx = origLS.x + origLS.width / 2, cy = origLS.y + origLS.height / 2;
  const rad = (-(origLS.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = mouse.x - cx, dy = mouse.y - cy;
  const lx = cx + dx * cos - dy * sin;
  const ly = cy + dx * sin + dy * cos;
  const left = origLS.x, right = origLS.x + origLS.width;
  const bottom = origLS.y, top = origLS.y + origLS.height;
  let nL = left, nR = right, nB = bottom, nT = top;
  switch (handle) {
    case "se": nR = lx; nB = ly; break;
    case "sw": nL = lx; nB = ly; break;
    case "ne": nR = lx; nT = ly; break;
    case "nw": nL = lx; nT = ly; break;
    case "e": nR = lx; break;
    case "w": nL = lx; break;
    case "n": nT = ly; break;
    case "s": nB = ly; break;
    default: break;
  }
  if (proportional && ["se", "sw", "ne", "nw"].includes(handle)) {
    const aspect = origLS.width / origLS.height;
    const dw = nR - nL, dh = nT - nB;
    if (Math.abs(dw) >= Math.abs(dh * aspect)) {
      const nh = dw / aspect;
      if (handle === "se" || handle === "sw") nB = nT - nh; else nT = nB + nh;
    } else {
      const nw = dh * aspect;
      if (handle === "se" || handle === "ne") nR = nL + nw; else nL = nR - nw;
    }
  }
  const width = Math.max(1, nR - nL);
  const height = Math.max(1, nT - nB);
  return { x: nL, y: nB, width, height };
}

// World positions of the 8 resize handles + rotate handle + center for a live shape.
export function liveShapeHandles(ls) {
  const cx = ls.x + ls.width / 2, cy = ls.y + ls.height / 2;
  const local = {
    sw: { x: ls.x, y: ls.y },
    se: { x: ls.x + ls.width, y: ls.y },
    ne: { x: ls.x + ls.width, y: ls.y + ls.height },
    nw: { x: ls.x, y: ls.y + ls.height },
    s: { x: ls.x + ls.width / 2, y: ls.y },
    n: { x: ls.x + ls.width / 2, y: ls.y + ls.height },
    e: { x: ls.x + ls.width, y: ls.y + ls.height / 2 },
    w: { x: ls.x, y: ls.y + ls.height / 2 },
  };
  const rotate = { x: ls.x + ls.width / 2, y: ls.y + ls.height + 60 / 1 };
  const out = {};
  for (const k of Object.keys(local)) out[k] = rotatePt(local[k], cx, cy, ls.rotation || 0);
  out.rotate = rotatePt(rotate, cx, cy, ls.rotation || 0);
  out.center = { x: cx, y: cy };
  return out;
}

// World positions of the start/end angle handles for an arc/pie ellipse.
export function arcAngleHandles(ls) {
  if (ls.type !== "ellipse" || ls.arcMode === "full") return null;
  const cx = ls.x + ls.width / 2, cy = ls.y + ls.height / 2;
  const rx = ls.width / 2, ry = ls.height / 2;
  const at = (deg) => {
    const a = (deg * Math.PI) / 180;
    return rotatePt({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }, cx, cy, ls.rotation || 0);
  };
  return { start: at(ls.startAngle), end: at(ls.endAngle) };
}

export function defaultDragParams(liveType, tool) {
  if (liveType === "rectangle") return { cornerRadius: tool === "roundedRect" ? null : 0 };
  if (liveType === "ellipse") return { arcMode: "full", startAngle: 0, endAngle: 360 };
  if (liveType === "polygon") return { sides: 6 };
  if (liveType === "star") return { points: 5, innerRadius: 0.5 };
  return {};
}