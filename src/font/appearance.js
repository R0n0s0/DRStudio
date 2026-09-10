// Appearance model for vector contours in DR Font Studio.
// Appearance is stored per-contour and is independent of geometry.
// Font export (OTF/TTF) ignores appearance and uses outline geometry only.

export const EDITOR_FILL = "#e5e7eb";

export const DEFAULT_APPEARANCE = {
  fill: "#000000",
  fillOpacity: 1,
  stroke: null,
  strokeWidth: 0,
  strokeOpacity: 1,
  opacity: 1,
  cap: "butt",
  join: "miter",
  miterLimit: 10,
  strokeAlign: "center", // center | inside | outside (closed paths only)
  dashPattern: null, // [d1,g1,d2,g2,d3,g3] in font units, or null = solid
  dashOffset: 0,
  dashCornerMode: "exact", // exact | align
  arrowStart: null, // { type, scale, align } or null
  arrowEnd: null,
  widthProfile: "uniform", // uniform | width1..width5
  widthProfileFlipAlong: false,
  widthProfileFlipAcross: false,
};

// Migrate legacy `dash: [dash, gap, offset]` into the new dashPattern/dashOffset model.
export function getAppearance(contour) {
  const raw = contour.appearance || {};
  const a = { ...DEFAULT_APPEARANCE, ...raw };
  if (Array.isArray(raw.dash) && raw.dashPattern == null) {
    const d = raw.dash;
    a.dashPattern = d.length >= 2 ? (d.length % 2 === 0 ? [...d] : d.slice(0, d.length - 1)) : null;
    if (a.dashOffset == null) a.dashOffset = d.length % 2 === 1 ? d[d.length - 1] : 0;
    delete a.dash;
  }
  return a;
}

export function setAppearance(contour, patch) {
  const a = { ...getAppearance(contour), ...patch };
  // normalize: zero-width stroke disables stroke rendering
  return { ...contour, appearance: a };
}

export function fillOf(contour, defaultFill) {
  const a = contour.appearance;
  if (!a) return defaultFill;
  return a.fill; // string | null
}

export function strokeOf(contour) {
  const a = contour.appearance;
  if (!a) return null;
  return a.strokeWidth > 0 && a.stroke ? a.stroke : null;
}

export function hasAppearance(contour) {
  return !!contour.appearance;
}

// ---------- Gradient fills ----------
// A fill/stroke value may be a solid hex string, null (none), or a gradient object:
// { type: "gradient", gradientType: "linear"|"radial", angle, stops: [{offset, color, opacity}] }
export function isGradientFill(fill) {
  return !!fill && typeof fill === "object" && fill.type === "gradient";
}
export function solidFillOf(fill) {
  if (fill == null) return null;
  if (typeof fill === "string") return fill;
  if (fill.type === "gradient") return (fill.stops && fill.stops[0] && fill.stops[0].color) || "#000000";
  return null;
}
export function defaultGradient() {
  return {
    type: "gradient",
    gradientType: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#8b5cf6", opacity: 1 },
      { offset: 1, color: "#ec4899", opacity: 1 },
    ],
  };
}
export function gradientToCss(fill) {
  if (!isGradientFill(fill)) return null;
  const stops = (fill.stops || []).map((s) => `${s.color} ${Math.round((s.offset || 0) * 100)}%`).join(", ");
  if (fill.gradientType === "radial") return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${fill.angle ?? 90}deg, ${stops})`;
}

export const DEFAULT_GRADIENT_STOPS = [
  { offset: 0, color: "#8b5cf6", opacity: 1, midpoint: 0.5 },
  { offset: 1, color: "#ec4899", opacity: 1, midpoint: 0.5 },
];

function hexChannels(hex) {
  const h = String(hex || "#000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [parseInt(full.slice(0, 2) || "00", 16), parseInt(full.slice(2, 4) || "00", 16), parseInt(full.slice(4, 6) || "00", 16)];
}
function rgbHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}
function blendHex(c1, c2) {
  const [r1, g1, b1] = hexChannels(c1), [r2, g2, b2] = hexChannels(c2);
  return rgbHex((r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2);
}

// Expand stops to simulate per-stop interpolation midpoints (Illustrator-style):
// inserts a 50%-blended stop at lerp(a.offset, b.offset, a.midpoint) when midpoint != 0.5.
export function expandStopsForRender(stops) {
  if (!stops || !stops.length) return [];
  const sorted = [...stops].sort((a, b) => (a.offset || 0) - (b.offset || 0));
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    out.push({ offset: a.offset, color: a.color, opacity: a.opacity != null ? a.opacity : 1 });
    if (i < sorted.length - 1) {
      const b = sorted[i + 1];
      const m = a.midpoint != null ? a.midpoint : 0.5;
      if (Math.abs(m - 0.5) > 0.005) {
        const off = (a.offset || 0) + ((b.offset || 0) - (a.offset || 0)) * m;
        out.push({ offset: off, color: blendHex(a.color, b.color), opacity: (((a.opacity ?? 1) + (b.opacity ?? 1)) / 2) });
      }
    }
  }
  return out;
}

export function cloneStops(stops) {
  return (stops || []).map((s) => ({ offset: s.offset, color: s.color, opacity: s.opacity ?? 1, midpoint: s.midpoint ?? 0.5 }));
}

// Build a points-based gradient spanning a font-coordinate bounding box.
export function buildGradientForBBox(b, gradientType = "linear", stops = DEFAULT_GRADIENT_STOPS) {
  const midX = (b.minX + b.maxX) / 2, midY = (b.minY + b.maxY) / 2;
  const r = Math.max((b.maxX - b.minX), (b.maxY - b.minY)) / 2 || 100;
  const s = cloneStops(stops);
  if (gradientType === "radial") {
    return { type: "gradient", gradientType: "radial", cx: midX, cy: midY, r, fx: midX, fy: midY, aspectRatio: 1, stops: s };
  }
  return { type: "gradient", gradientType: "linear", x1: b.minX, y1: midY, x2: b.maxX, y2: midY, stops: s };
}

// Group contours that share identical appearance so they can be rendered as a
// single even-odd path (correctly producing counterform holes), per appearance.
export function groupByAppearance(contours, defaultFill, opts = {}) {
  const solidify = !!opts.solidify;
  const ser = (v) => (v && typeof v === "object" ? JSON.stringify(v) : v);
  const map = new Map();
  for (const c of contours) {
    const a = c.appearance ? getAppearance(c) : null;
    const fr = c.fillRule || "evenodd";
    const key = a
      ? `f:${ser(a.fill)}|fo:${a.fillOpacity}|s:${ser(a.stroke)}|sw:${a.strokeWidth}|so:${a.strokeOpacity}|o:${a.opacity}|c:${a.cap}|j:${a.join}|ml:${a.miterLimit}|sa:${a.strokeAlign}|dp:${a.dashPattern ? a.dashPattern.join(",") : ""}|wp:${a.widthProfile}|as:${ser(a.arrowStart)}|ae:${ser(a.arrowEnd)}|fr:${fr}`
      : `default:${defaultFill}|fr:${fr}`;
    if (!map.has(key)) {
      const fillRaw = a ? a.fill : defaultFill;
      const strokeRaw = a ? (a.strokeWidth > 0 && a.stroke ? a.stroke : null) : null;
      map.set(key, {
        contours: [],
        fillRule: fr,
        fill: solidify ? solidFillOf(fillRaw) : fillRaw,
        fillOpacity: a ? a.fillOpacity : 1,
        stroke: solidify ? solidFillOf(strokeRaw) : strokeRaw,
        strokeWidth: a ? a.strokeWidth : 0,
        strokeOpacity: a ? a.strokeOpacity : 1,
        opacity: a ? a.opacity : 1,
        cap: a ? a.cap : "butt",
        join: a ? a.join : "miter",
        miterLimit: a ? a.miterLimit : 10,
        strokeAlign: a ? a.strokeAlign : "center",
        dashPattern: a ? a.dashPattern : null,
        dashOffset: a ? a.dashOffset : 0,
        // legacy-compatible single-pair dash array for exporters: [d, g, offset]
        dash: a && a.dashPattern ? [a.dashPattern[0], a.dashPattern[1] != null ? a.dashPattern[1] : a.dashPattern[0], a.dashOffset || 0] : null,
        arrowStart: a ? a.arrowStart : null,
        arrowEnd: a ? a.arrowEnd : null,
        widthProfile: a ? a.widthProfile : "uniform",
        widthProfileFlipAlong: a ? a.widthProfileFlipAlong : false,
        widthProfileFlipAcross: a ? a.widthProfileFlipAcross : false,
      });
    }
    map.get(key).contours.push(c);
  }
  return [...map.values()];
}

// Appearance clipboard (copy/paste appearance without geometry).
let _clip = null;
export function copyAppearance(contour) { _clip = contour ? getAppearance(contour) : null; return _clip; }
export function hasAppearanceClip() { return !!_clip; }
export function getAppearanceClip() { return _clip; }

// ---------- Color conversions ----------
export function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return { r: parseInt(full.slice(0, 2) || "00", 16) || 0, g: parseInt(full.slice(2, 4) || "00", 16) || 0, b: parseInt(full.slice(4, 6) || "00", 16) || 0 };
}
export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
export function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

// ---------- CMYK ----------
export function rgbToCmyk(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}
export function cmykToRgb(c, m, y, k) {
  c = Math.max(0, Math.min(100, c)) / 100;
  m = Math.max(0, Math.min(100, m)) / 100;
  y = Math.max(0, Math.min(100, y)) / 100;
  k = Math.max(0, Math.min(100, k)) / 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

// ---------- Alpha-aware HEX ----------
export function parseHexAlpha(s) {
  const h = String(s || "").replace("#", "").trim();
  if (/^[0-9a-fA-F]{8}$/.test(h)) return { hex: "#" + h.slice(0, 6), alpha: parseInt(h.slice(6, 8), 16) / 255 };
  if (/^[0-9a-fA-F]{6}$/.test(h)) return { hex: "#" + h, alpha: 1 };
  if (/^[0-9a-fA-F]{3}$/.test(h)) return { hex: "#" + h.split("").map((c) => c + c).join(""), alpha: 1 };
  return null;
}
export function hexWithAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(255, Math.round((alpha == null ? 1 : alpha) * 255))).toString(16).padStart(2, "0");
  return (hex || "#000000") + a;
}

// Reorder contours (object stack). sel = selected indices. Returns { contours, sel }.
export function reorderContours(contours, sel, dir) {
  const arr = contours.map((c, i) => ({ c, s: sel.includes(i) }));
  if (dir === "front") arr.sort((a, b) => (a.s === b.s ? 0 : a.s ? 1 : -1));
  else if (dir === "back") arr.sort((a, b) => (a.s === b.s ? 0 : a.s ? -1 : 1));
  else if (dir === "forward") {
    for (let i = arr.length - 2; i >= 0; i--) if (arr[i].s && !arr[i + 1].s) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; }
  } else if (dir === "backward") {
    for (let i = 1; i < arr.length; i++) if (arr[i].s && !arr[i - 1].s) { [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; }
  }
  const newContours = arr.map((x) => x.c);
  const newSel = arr.map((x, i) => (x.s ? i : -1)).filter((i) => i >= 0);
  return { contours: newContours, sel: newSel };
}