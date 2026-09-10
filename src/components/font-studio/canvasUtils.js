// Pure helpers and constants extracted from VectorCanvas to keep it under the
// line limit. No component state dependencies.

export const HANDLE_HIT = 8;
export const NODE_HIT = 8;
export const SEG_HIT = 7;
export const SHAPE_TOOLS = ["rectangle", "roundedRect", "circle", "ellipse", "triangle", "polygon", "star"];

// Dynamic Pen Tool cursors: a pen nib plus a context glyph (* ready, + add, - remove, ^ convert, o close, ¬ join).
export const penCursorSVG = (glyph) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M2 2 L11 3 L3 11 Z' fill='#fff' stroke='#000' stroke-width='1' stroke-linejoin='round'/>${glyph ? `<text x='13' y='22' font-size='15' font-family='Arial,sans-serif' font-weight='bold' fill='#fff' stroke='#000' stroke-width='0.5' text-anchor='middle'>${glyph}</text>` : ``}</svg>`
)}") 2 2, crosshair`;

// Rotation cursor (Illustrator-style curved arrow).
export const rotateCursorSVG = () => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'><path d='M20.5 12a8.5 8.5 0 1 1-2.5-6L20.5 8' fill='none' stroke='#fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/><path d='M20.5 3v5h-5' fill='none' stroke='#fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/><path d='M20.5 12a8.5 8.5 0 1 1-2.5-6L20.5 8' fill='none' stroke='#000' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/><path d='M20.5 3v5h-5' fill='none' stroke='#000' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>`
)}") 14 14, crosshair`;

export const marqueeRect = (m) => ({ minX: Math.min(m.start.x, m.end.x), maxX: Math.max(m.start.x, m.end.x), minY: Math.min(m.start.y, m.end.y), maxY: Math.max(m.start.y, m.end.y) });
export const boundsIntersect = (b, r) => !!b && b.minX <= r.maxX && b.maxX >= r.minX && b.minY <= r.maxY && b.maxY >= r.minY;
export const pointInRect = (p, r) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;

// Build a filled path of circles (one per brush sample) whose radii scale with
// each point's pressure — gives a real-time, pressure-aware footprint preview
// without re-rendering React (imperative ref update).
export const brushFootprintPath = (pts, brushSize, zoom, toScreen) => {
  let d = "";
  for (const pt of pts) {
    const s = toScreen(pt);
    const r = Math.max(0.5, (brushSize * zoom * (pt.p ?? 1)) / 2);
    d += `M${s.x - r},${s.y}a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
  }
  return d;
};