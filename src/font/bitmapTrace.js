// Bitmap-based text outline tracing for system fonts.
// Renders text to a high-resolution canvas, extracts the binary mask,
// and traces the boundary into polygon contours using edge-following.
// Results are polygonal (not smooth Bézier) but work for any font the
// browser can render — used as a fallback when no font file is available.

const SS = 4; // supersample factor for smoother outlines

// Render a single character and trace its outline into contours.
// Returns array of contours in font coordinates (y-up).
export function traceCharOutlines(ch, fontFamily, fontWeight, fontSize, originX, baselineY, groupId) {
  const renderSize = Math.max(1, fontSize * SS);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const fontStr = `${fontWeight} ${renderSize}px "${fontFamily}", sans-serif`;
  ctx.font = fontStr;
  const m = ctx.measureText(ch);
  const padX = Math.ceil(renderSize * 0.3);
  const padY = Math.ceil(renderSize * 0.6);
  const w = Math.max(1, Math.ceil(m.width) + padX * 2);
  const h = Math.ceil(renderSize * 1.3) + padY * 2;
  canvas.width = w;
  canvas.height = h;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = fontStr;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(ch, padX, padY + renderSize);

  const imageData = ctx.getImageData(0, 0, w, h);
  const bitmap = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bitmap[i] = imageData.data[i * 4] > 128 ? 1 : 0;

  const rings = traceBitmap(bitmap, w, h);
  const contours = [];
  for (const ring of rings) {
    const simplified = simplifyRing(ring, 1.2);
    if (simplified.length < 3) continue;
    const pts = simplified.map((p) => ({
      x: (p.x - padX) / SS + originX,
      y: -((p.y - padY - renderSize) / SS) + baselineY,
      in: null, out: null, type: "corner",
    }));
    contours.push({ points: pts, closed: true, group: groupId });
  }
  return contours;
}

// Measure character advance width using canvas metrics.
export function measureChar(ch, fontFamily, fontWeight, fontSize) {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
  return ctx.measureText(ch).width;
}

// Trace boundary contours of a binary bitmap by collecting boundary edges
// and chaining them into closed loops.
function traceBitmap(bitmap, width, height) {
  const edges = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!bitmap[y * width + x]) continue;
      // Edges form a consistent clockwise loop (in y-down screen coords):
      // top→right→bottom→left, each ending where the next begins.
      // Top boundary (going right)
      if (y === 0 || !bitmap[(y - 1) * width + x])
        edges.push({ x1: x, y1: y, x2: x + 1, y2: y });
      // Right boundary (going down)
      if (x + 1 >= width || !bitmap[y * width + x + 1])
        edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
      // Bottom boundary (going left)
      if (y + 1 >= height || !bitmap[(y + 1) * width + x])
        edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 });
      // Left boundary (going up)
      if (x === 0 || !bitmap[y * width + x - 1])
        edges.push({ x1: x, y1: y + 1, x2: x, y2: y });
    }
  }
  return chainEdges(edges);
}

// Chain edges into closed loops by matching endpoints.
function chainEdges(edges) {
  if (!edges.length) return [];
  const map = new Map();
  for (let i = 0; i < edges.length; i++) {
    const k = `${edges[i].x1},${edges[i].y1}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  const used = new Array(edges.length).fill(false);
  const rings = [];
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    const ring = [];
    let idx = i;
    let guard = 0;
    while (idx >= 0 && !used[idx] && guard <= edges.length) {
      used[idx] = true;
      ring.push({ x: edges[idx].x1, y: edges[idx].y1 });
      const k = `${edges[idx].x2},${edges[idx].y2}`;
      const candidates = map.get(k) || [];
      idx = candidates.find((c) => !used[c]);
      if (idx === undefined) idx = -1;
      guard++;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

// Simplify a closed ring: remove collinear points, then Douglas-Peucker.
function simplifyRing(points, tolerance) {
  if (points.length < 4) return points;
  const de = dedupCollinear(points);
  if (de.length < 4) return de;
  return dpDecurve(de, tolerance);
}

function dedupCollinear(points) {
  const n = points.length;
  if (n < 3) return points;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n];
    const b = points[i];
    const c = points[(i + 1) % n];
    const cross = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  return out.length >= 3 ? out : points;
}

function dpDecurve(points, tol) {
  if (points.length < 3) return points;
  let maxDist = 0, maxIdx = 0;
  const a = points[0], b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDist(points[i], a, b);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tol) {
    const left = dpDecurve(points.slice(0, maxIdx + 1), tol);
    const right = dpDecurve(points.slice(maxIdx), tol);
    return [...left, ...right.slice(1)];
  }
  return [a, b];
}

function pointLineDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}