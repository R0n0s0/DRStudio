// SVG path → DR Studio contour import.
// Converts SVG <path> "d" attributes into the app's cubic-Bézier contour model,
// flips Y to font coordinates (y-up), and scales to the font's cap height.

import { DEFAULT_METRICS } from "./glyphModel";

function tokenize(d) {
  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push(m[1]);
    else tokens.push(parseFloat(m[0]));
  }
  return tokens;
}

const reflect = (p, about) => ({ x: 2 * about.x - p.x, y: 2 * about.y - p.y });

// Parse one SVG path 'd' into contours in SVG coordinate space.
// Each anchor: { x, y, in, out, type }. Handles are absolute SVG coords.
export function parseSvgPath(d) {
  const tokens = tokenize(d);
  const contours = [];
  let i = 0;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let pts = [];
  let lastCtrl = null;
  let lastCmd = null;

  const isNum = (k) => typeof tokens[k] === "number";
  const flush = (closed) => {
    if (pts.length >= 2) contours.push({ closed, points: pts });
    pts = [];
  };

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (typeof cmd === "string") { i++; } else { cmd = lastCmd; }
    if (typeof cmd !== "string") break;
    lastCmd = cmd;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    switch (C) {
      case "M": {
        flush(false);
        let x = tokens[i++], y = tokens[i++];
        if (rel) { x += cur.x; y += cur.y; }
        cur = { x, y }; start = { x, y };
        pts = [{ x, y, in: null, out: null, type: "corner" }];
        while (isNum(i) && isNum(i + 1)) {
          let nx = tokens[i++], ny = tokens[i++];
          if (rel) { nx += cur.x; ny += cur.y; }
          pts[pts.length - 1].out = null;
          pts.push({ x: nx, y: ny, in: null, out: null, type: "corner" });
          cur = { x: nx, y: ny };
        }
        lastCtrl = null;
        break;
      }
      case "L": {
        while (isNum(i) && isNum(i + 1)) {
          let nx = tokens[i++], ny = tokens[i++];
          if (rel) { nx += cur.x; ny += cur.y; }
          pts[pts.length - 1].out = null;
          pts.push({ x: nx, y: ny, in: null, out: null, type: "corner" });
          cur = { x: nx, y: ny };
        }
        lastCtrl = null;
        break;
      }
      case "H": {
        while (isNum(i)) {
          let nx = tokens[i++];
          if (rel) nx += cur.x;
          pts[pts.length - 1].out = null;
          pts.push({ x: nx, y: cur.y, in: null, out: null, type: "corner" });
          cur = { x: nx, y: cur.y };
        }
        lastCtrl = null;
        break;
      }
      case "V": {
        while (isNum(i)) {
          let ny = tokens[i++];
          if (rel) ny += cur.y;
          pts[pts.length - 1].out = null;
          pts.push({ x: cur.x, y: ny, in: null, out: null, type: "corner" });
          cur = { x: cur.x, y: ny };
        }
        lastCtrl = null;
        break;
      }
      case "C": {
        while (isNum(i) && isNum(i + 5)) {
          let x1 = tokens[i++], y1 = tokens[i++], x2 = tokens[i++], y2 = tokens[i++], x = tokens[i++], y = tokens[i++];
          if (rel) { x1 += cur.x; y1 += cur.y; x2 += cur.x; y2 += cur.y; x += cur.x; y += cur.y; }
          pts[pts.length - 1].out = { x: x1, y: y1 };
          pts.push({ x, y, in: { x: x2, y: y2 }, out: null, type: "smooth" });
          cur = { x, y };
          lastCtrl = { x: x2, y: y2 };
        }
        break;
      }
      case "S": {
        while (isNum(i) && isNum(i + 3)) {
          let x2 = tokens[i++], y2 = tokens[i++], x = tokens[i++], y = tokens[i++];
          if (rel) { x2 += cur.x; y2 += cur.y; x += cur.x; y += cur.y; }
          let x1, y1;
          if (lastCmd && lastCmd.toUpperCase() === "C") { const r = reflect(lastCtrl, cur); x1 = r.x; y1 = r.y; }
          else { x1 = cur.x; y1 = cur.y; }
          pts[pts.length - 1].out = { x: x1, y: y1 };
          pts.push({ x, y, in: { x: x2, y: y2 }, out: null, type: "smooth" });
          cur = { x, y };
          lastCtrl = { x: x2, y: y2 };
        }
        break;
      }
      case "Q": {
        while (isNum(i) && isNum(i + 3)) {
          let qx = tokens[i++], qy = tokens[i++], x = tokens[i++], y = tokens[i++];
          if (rel) { qx += cur.x; qy += cur.y; x += cur.x; y += cur.y; }
          const c1 = { x: cur.x + (2 / 3) * (qx - cur.x), y: cur.y + (2 / 3) * (qy - cur.y) };
          const c2 = { x: x + (2 / 3) * (qx - x), y: y + (2 / 3) * (qy - y) };
          pts[pts.length - 1].out = c1;
          pts.push({ x, y, in: c2, out: null, type: "smooth" });
          cur = { x, y };
          lastCtrl = { x: qx, y: qy };
        }
        break;
      }
      case "T": {
        while (isNum(i) && isNum(i + 1)) {
          let x = tokens[i++], y = tokens[i++];
          if (rel) { x += cur.x; y += cur.y; }
          let qx, qy;
          if (lastCmd && lastCmd.toUpperCase() === "Q") { const r = reflect(lastCtrl, cur); qx = r.x; qy = r.y; }
          else { qx = cur.x; qy = cur.y; }
          const c1 = { x: cur.x + (2 / 3) * (qx - cur.x), y: cur.y + (2 / 3) * (qy - cur.y) };
          const c2 = { x: x + (2 / 3) * (qx - x), y: y + (2 / 3) * (qy - y) };
          pts[pts.length - 1].out = c1;
          pts.push({ x, y, in: c2, out: null, type: "smooth" });
          cur = { x, y };
          lastCtrl = { x: qx, y: qy };
        }
        break;
      }
      case "A": {
        // Arcs are rare in font artwork; approximate end point only (skip curve fidelity).
        i += 7;
        lastCtrl = null;
        break;
      }
      case "Z": {
        flush(true);
        cur = start;
        lastCtrl = null;
        break;
      }
      default:
        i++;
    }
  }
  flush(false);
  return contours;
}

// Import an SVG document string into font-space contours.
// Scales to cap height, flips Y, seats the glyph on the baseline (y=0).
export function importSvgFile(svgText, metrics = DEFAULT_METRICS, options = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const paths = Array.from(doc.querySelectorAll("path"));
  const svgContours = [];
  paths.forEach((pEl) => {
    const d = pEl.getAttribute("d");
    if (d) svgContours.push(...parseSvgPath(d));
  });
  if (!svgContours.length) return { error: "No vector paths found in the SVG." };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  svgContours.forEach((c) => c.points.forEach((p) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    [p.in, p.out].forEach((h) => { if (h) { minX = Math.min(minX, h.x); maxX = Math.max(maxX, h.x); minY = Math.min(minY, h.y); maxY = Math.max(maxY, h.y); } });
  }));

  const svgW = maxX - minX, svgH = maxY - minY;
  const targetH = options.height || metrics.capHeight;
  const scale = svgH > 0 ? targetH / svgH : 1;
  const lsb = options.lsb != null ? options.lsb : 50;
  const rsb = options.rsb != null ? options.rsb : 50;
  const tx = (x) => (x - minX) * scale + lsb;
  const ty = (y) => (maxY - y) * scale; // svg bottom (maxY) → baseline 0
  const tf = (p) => (p ? { x: tx(p.x), y: ty(p.y) } : null);

  const contours = svgContours.map((c) => ({
    closed: c.closed,
    points: c.points.map((p) => ({ x: tx(p.x), y: ty(p.y), in: tf(p.in), out: tf(p.out), type: p.type })),
  }));

  const advanceWidth = Math.round(lsb + svgW * scale + rsb);
  return { contours, leftSideBearing: lsb, advanceWidth, width: Math.round(svgW * scale) };
}