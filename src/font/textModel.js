// Text frame model, font loading, measurement, and line layout for the Type Tool.

export const PROJECT_FONT_ID = "__project__";

export const SYSTEM_FONTS = [
  "Arial", "Helvetica", "Times New Roman", "Georgia", "Courier New",
  "Verdana", "Trebuchet MS", "Tahoma", "Palatino Linotype", "Garamond",
  "Book Antiqua", "Impact", "Comic Sans MS", "Lucida Console",
  "system-ui", "serif", "sans-serif", "monospace", "cursive", "fantasy",
];

export const FONT_WEIGHTS = [
  { label: "Regular", value: "normal" },
  { label: "Bold", value: "bold" },
  { label: "Italic", value: "italic" },
  { label: "Light", value: "300" },
  { label: "Medium", value: "500" },
  { label: "Semibold", value: "600" },
  { label: "Black", value: "900" },
];

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96, 128, 200];

let _id = 0;
export const newFrameId = () => `tf${Date.now().toString(36)}_${(_id++).toString(36)}`;

export function makeTextFrame({ kind, x, y, width, height }) {
  return {
    id: newFrameId(),
    kind, // "point" | "area"
    x,
    y,
    width: kind === "area" ? width : null,
    height: kind === "area" ? height : null,
    text: "",
    fontFamily: "system-ui",
    fontWeight: "normal",
    fontSize: 48,
    tracking: 0,
    leading: 120, // percent of font size
    align: "left",
    opacity: 1,
    locked: false,
  };
}

export function defaultTextSettings() {
  return {
    fontFamily: "system-ui",
    fontWeight: "normal",
    fontSize: 48,
    tracking: 0,
    leading: 120,
    align: "left",
  };
}

// CSS font shorthand for a frame (used for SVG <text> + canvas measurement).
export function fontString(f) {
  const style = f.fontWeight === "italic" ? "italic " : "";
  const weight = f.fontWeight === "italic" ? "normal" : f.fontWeight;
  return `${style}${weight} ${f.fontSize}px "${f.fontFamily}", sans-serif`;
}

let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement("canvas").getContext("2d");
  return _measureCtx;
}

export function measureText(f, text) {
  if (!text) return 0;
  const ctx = measureCtx();
  ctx.font = fontString(f);
  return ctx.measureText(text).width + Math.max(0, text.length - 1) * f.tracking;
}

// Width of a line, project-font aware (sums designed advance widths).
export function measureLine(f, text, metrics, projectGlyphs) {
  if (f.fontFamily === PROJECT_FONT_ID && projectGlyphs) {
    const upm = metrics.unitsPerEm;
    const scale = f.fontSize / upm;
    let w = 0;
    for (const ch of text) {
      const g = projectGlyphs[ch];
      w += (g ? g.advanceWidth : upm * 0.5) * scale + f.tracking;
    }
    return w;
  }
  return measureText(f, text);
}

// Approximate ascent for baseline placement.
export function fontAscent(f, metrics, loadedFonts) {
  if (f.fontFamily === PROJECT_FONT_ID) {
    return (metrics.ascender * f.fontSize) / metrics.unitsPerEm;
  }
  const lf = loadedFonts?.find((l) => l.family === f.fontFamily || l.name === f.fontFamily);
  if (lf && lf.ascent) return (lf.ascent * f.fontSize) / lf.unitsPerEm;
  return f.fontSize * 0.8;
}

// Word-wrap a frame's text into an array of line strings.
export function wrapLines(f) {
  const text = f.text || "";
  const rawLines = text.split("\n");
  if (f.kind !== "area" || !f.width) return rawLines;
  const maxW = f.width;
  const out = [];
  for (const line of rawLines) {
    if (!line.trim()) { out.push(""); continue; }
    const words = line.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (measureText(f, test) > maxW && cur) { out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
  }
  return out;
}

// Lay out lines with baseline positions (font coords, y-up) and aligned x.
export function layoutText(f, metrics, loadedFonts, projectGlyphs) {
  const lines = wrapLines(f);
  const ascent = fontAscent(f, metrics, loadedFonts);
  const lineHeight = f.fontSize * (f.leading / 100);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const lw = measureLine(f, lines[i], metrics, projectGlyphs);
    let baselineY;
    let x;
    if (f.kind === "area") {
      baselineY = f.y - ascent - i * lineHeight;
      if (f.align === "center") x = f.x + (f.width - lw) / 2;
      else if (f.align === "right") x = f.x + f.width - lw;
      else x = f.x;
    } else {
      baselineY = f.y - i * lineHeight;
      if (f.align === "center") x = f.x - lw / 2;
      else if (f.align === "right") x = f.x - lw;
      else x = f.x;
    }
    out.push({ text: lines[i], x, baselineY });
  }
  return out;
}

// Bounding box of a frame in font coords (y-up).
export function textFrameBounds(f, metrics, loadedFonts, projectGlyphs) {
  if (f.kind === "area") {
    return { minX: f.x, maxX: f.x + f.width, minY: f.y - f.height, maxY: f.y };
  }
  const lines = layoutText(f, metrics, loadedFonts, projectGlyphs);
  if (!lines.length) return { minX: f.x, maxX: f.x + 40, minY: f.y - f.fontSize, maxY: f.y };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const ascent = fontAscent(f, metrics, loadedFonts);
  lines.forEach((ln) => {
    const lw = measureLine(f, ln.text, metrics, projectGlyphs);
    minX = Math.min(minX, ln.x);
    maxX = Math.max(maxX, ln.x + lw);
    minY = Math.min(minY, ln.baselineY - f.fontSize * 0.25);
    maxY = Math.max(maxY, ln.baselineY + ascent);
  });
  return { minX, maxX, minY, maxY };
}

// Load a font file: register with FontFace for rendering, keep ArrayBuffer for outlining.
export async function loadFontFile(file) {
  const buf = await file.arrayBuffer();
  const fontFace = new FontFace(file.name, buf);
  await fontFace.load();
  document.fonts.add(fontFace);
  let ascent = null, unitsPerEm = null;
  try {
    const opentype = (await import("opentype.js")).default;
    const parsed = opentype.parse(buf);
    ascent = parsed.ascender;
    unitsPerEm = parsed.unitsPerEm;
  } catch {}
  return {
    name: file.name,
    family: fontFace.family || file.name,
    buffer: buf,
    ascent,
    unitsPerEm,
  };
}