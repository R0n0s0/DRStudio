// Artwork & presentation export engine for DR Font Studio.
// Generates real vector output (SVG / PDF / EPS) and raster (PNG / JPG) from
// the project's glyph geometry, honoring per-contour appearance (fill/stroke/
// opacity/cap/join/dash). Font export (OTF/TTF) is handled separately by
// ttfEncoder and re-exposed here for a single export API.
import { resolveContours, contourBounds } from "./geometry";
import { encodeTTF, encodeWOFF, encodeWOFF2 } from "./ttfEncoder";
import { groupByAppearance } from "./appearance";

const n = (v) => (Math.round(v * 100) / 100).toString();
const escXml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escPdf = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export const PAGE_SIZES = {
  A4: { w: 794, h: 1123 },
  A3: { w: 1123, h: 1587 },
  Letter: { w: 816, h: 1056 },
  Legal: { w: 816, h: 1344 },
};

export function designedGlyphs(project) {
  return Object.values(project.glyphs || {}).filter((g) => (g.contours || []).length > 0 || (g.components || []).length > 0);
}

function boundsOf(contours) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, has = false;
  for (const c of contours) {
    const b = contourBounds(c);
    if (!b) continue;
    has = true;
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }
  return has ? { minX, minY, maxX, maxY } : null;
}

function hexToRgb01(hex) {
  const h = String(hex || "#000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2) || "00", 16) / 255;
  const g = parseInt(full.slice(2, 4) || "00", 16) / 255;
  const b = parseInt(full.slice(4, 6) || "00", 16) / 255;
  return [n(r), n(g), n(b)];
}

function eachSeg(contour, emit) {
  const p = contour.points;
  if (!p || p.length === 0) return;
  const nn = p.length;
  const segCount = contour.closed ? nn : nn - 1;
  if (segCount <= 0) { emit("M", p[0]); return; }
  emit("M", p[0]);
  for (let i = 0; i < segCount; i++) {
    const a = p[i], b = p[(i + 1) % nn];
    if (a.out || b.in) emit("C", a.out || a, b.in || b, b);
    else emit("L", b);
  }
  if (contour.closed) emit("Z");
}

function fitGlyph(contours, W, H, pad) {
  const b = boundsOf(contours);
  if (!b) return { scale: 1, x: W / 2, y: H / 2 };
  const gw = Math.max(b.maxX - b.minX, 1), gh = Math.max(b.maxY - b.minY, 1);
  const scale = Math.min((W - 2 * pad) / gw, (H - 2 * pad) / gh) || 1;
  const x = (W - gw * scale) / 2 - b.minX * scale;
  const y = H / 2 + (b.maxY + b.minY) * scale / 2;
  return { scale, x, y };
}

// ---------- Scene builders ----------
// scene = { width, height, background, shapes, labels, lines }
// shapes: [{ contours, x, y, scale, color }]  (color = fallback fill for unstyled)
export function sceneGlyph(project, glyph, opts = {}) {
  const W = opts.width || 600, H = opts.height || 600;
  const contours = resolveContours(glyph, project.glyphs);
  const { scale, x, y } = fitGlyph(contours, W, H, opts.pad ?? 80);
  return { width: W, height: H, background: opts.background, shapes: [{ contours, x, y, scale, color: opts.color || "#000" }], labels: [], lines: [] };
}

export function sceneSheet(project, glyphList, opts = {}) {
  const cols = opts.columns || 6;
  const cell = opts.cellSize || 200;
  const gap = opts.gap ?? 24;
  const labelH = opts.showLabels ? 26 : 0;
  const rows = Math.ceil(glyphList.length / cols);
  const W = opts.width || (cols * cell + (cols + 1) * gap);
  const H = opts.height || (rows * (cell + labelH) + (rows + 1) * gap);
  const shapes = [], labels = [];
  glyphList.forEach((g, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const cx = gap + c * (cell + gap);
    const cy = gap + r * (cell + labelH + gap);
    const contours = resolveContours(g, project.glyphs);
    const { scale, x, y } = fitGlyph(contours, cell, cell, 18);
    shapes.push({ contours, x: cx + x, y: cy + y, scale, color: opts.color || "#000" });
    if (opts.showLabels) labels.push({ text: g.char === " " ? "SP" : g.char, x: cx + cell / 2, y: cy + cell + labelH - 6, size: 12, color: opts.labelColor || "#666", align: "center" });
  });
  return { width: W, height: H, background: opts.background, shapes, labels, lines: [] };
}

export function sceneSpecimen(project, opts = {}) {
  const page = PAGE_SIZES[opts.pageSize] || PAGE_SIZES.A4;
  const orient = opts.orientation || "portrait";
  const W = opts.width || (orient === "portrait" ? page.w : page.h);
  const H = opts.height || (orient === "portrait" ? page.h : page.w);
  const margin = opts.margin ?? 64;
  const upem = project.metrics.unitsPerEm || 1000;
  const asc = project.metrics.ascender || 800;
  const shapes = [], labels = [];
  let y = margin;
  if (opts.showName) { labels.push({ text: project.metadata.fontName || "", x: margin, y: y + 30, size: 30, color: opts.color || "#000" }); y += 56; }
  if (opts.showDesigner && project.metadata.designer) { labels.push({ text: "Designed by " + project.metadata.designer, x: margin, y: y + 14, size: 12, color: "#777" }); y += 28; }
  if (opts.showDescription && project.metadata.description) { labels.push({ text: project.metadata.description, x: margin, y: y + 12, size: 11, color: "#777" }); y += 24; }
  const sections = [];
  if (opts.text) sections.push({ text: opts.text, size: opts.size || 56, leading: opts.leading || 1.25, align: opts.align || "left", color: opts.color || "#000", tracking: opts.tracking || 0 });
  if (opts.showCharset) sections.push({ text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789", size: 36, leading: 1.3, align: "left", color: opts.color || "#000", tracking: 0 });
  for (const sec of sections) {
    const scale = sec.size / upem;
    const lineHeight = sec.size * (sec.leading || 1.25);
    for (const line of (sec.text || "").split("\n")) {
      let x = 0; const items = [];
      for (const ch of line) {
        const g = project.glyphs[ch];
        if (g) { items.push({ g, x }); x += (g.advanceWidth || 0) * scale + (sec.tracking || 0); }
        else x += (project.metrics.defaultAdvanceWidth || 600) * scale + (sec.tracking || 0);
      }
      let ox = margin;
      if (sec.align === "center") ox = (W - x) / 2;
      else if (sec.align === "right") ox = W - margin - x;
      for (const it of items) {
        const contours = resolveContours(it.g, project.glyphs);
        shapes.push({ contours, x: ox + it.x, y: y + asc * scale, scale, color: sec.color });
      }
      y += lineHeight;
    }
    y += 18;
  }
  return { width: W, height: Math.max(H, y + margin), background: opts.background, shapes, labels, lines: [] };
}

export function sceneCanvas(project, glyph, opts = {}) {
  const W = opts.width || 900, H = opts.height || 900;
  const m = project.metrics;
  const contours = resolveContours(glyph, project.glyphs);
  const b = boundsOf(contours) || { minX: 0, minY: m.descender, maxX: glyph.advanceWidth, maxY: m.ascender };
  const minX = Math.min(b.minX, glyph.leftSideBearing);
  const maxX = Math.max(b.maxX, glyph.advanceWidth);
  const minY = Math.min(b.minY, m.descender);
  const maxY = Math.max(b.maxY, m.ascender);
  const pad = 130;
  const gw = Math.max(maxX - minX, 1), gh = Math.max(maxY - minY, 1);
  const scale = Math.min((W - 2 * pad) / gw, (H - 2 * pad) / gh) || 1;
  const ox = (W - gw * scale) / 2 - minX * scale;
  const oy = H / 2 + (maxY + minY) * scale / 2;
  const toX = (fx) => ox + fx * scale;
  const toY = (fy) => oy - fy * scale;
  const shapes = [{ contours, x: ox, y: oy, scale, color: opts.color || "#000" }];
  const lines = [];
  if (opts.showGuides) [{ y: m.ascender, c: "#f59e0b" }, { y: m.capHeight, c: "#ef4444" }, { y: m.xHeight, c: "#3b82f6" }, { y: 0, c: "#10b981" }, { y: m.descender, c: "#f59e0b" }].forEach((g) => lines.push({ x1: 0, y1: toY(g.y), x2: W, y2: toY(g.y), color: g.c, width: 1 }));
  if (opts.showMetrics) { lines.push({ x1: toX(glyph.leftSideBearing), y1: 0, x2: toX(glyph.leftSideBearing), y2: H, color: "#a855f7", width: 1 }); lines.push({ x1: toX(glyph.advanceWidth), y1: 0, x2: toX(glyph.advanceWidth), y2: H, color: "#a855f7", width: 1 }); }
  if (opts.showGrid) { const step = 50; for (let gx = Math.ceil(minX / step) * step; gx <= maxX; gx += step) lines.push({ x1: toX(gx), y1: 0, x2: toX(gx), y2: H, color: "#888", width: 0.5 }); for (let gy = Math.ceil(minY / step) * step; gy <= maxY; gy += step) lines.push({ x1: 0, y1: toY(gy), x2: W, y2: toY(gy), color: "#888", width: 0.5 }); }
  return { width: W, height: H, background: opts.background, shapes, labels: [], lines };
}

export function sceneArtboard(project, glyph, opts = {}) {
  const ab = project.artboard || { width: 1080, height: 1080 };
  const W = opts.width || ab.width, H = opts.height || ab.height;
  const contours = resolveContours(glyph, project.glyphs);
  const { scale, x, y } = fitGlyph(contours, W, H, opts.pad ?? 80);
  return { width: W, height: H, background: opts.background, shapes: [{ contours, x, y, scale, color: opts.color || "#000" }], labels: [], lines: [] };
}

export function sceneSelection(project, glyph, selIndices, opts = {}) {
  const ab = project.artboard || { width: 1080, height: 1080 };
  const W = opts.width || ab.width, H = opts.height || ab.height;
  const all = resolveContours(glyph, project.glyphs);
  const contours = (selIndices || []).map((i) => all[i]).filter(Boolean);
  const { scale, x, y } = fitGlyph(contours.length ? contours : all, W, H, opts.pad ?? 80);
  return { width: W, height: H, background: opts.background, shapes: [{ contours, x, y, scale, color: opts.color || "#000" }], labels: [], lines: [] };
}

export function buildScene(project, target, opts = {}) {
  if (target === "glyph") return sceneGlyph(project, project.glyphs[opts.currentChar], opts);
  if (target === "selected" || target === "sheet") { const list = (opts.glyphs || []).map((ch) => project.glyphs[ch]).filter(Boolean); return sceneSheet(project, list.length ? list : designedGlyphs(project), opts); }
  if (target === "specimen") return sceneSpecimen(project, opts);
  if (target === "canvas") return sceneCanvas(project, project.glyphs[opts.currentChar], opts);
  if (target === "artboard") return sceneArtboard(project, project.glyphs[opts.currentChar], opts);
  if (target === "selection") return sceneSelection(project, project.glyphs[opts.currentChar], opts.selIndices || [], opts);
  return sceneGlyph(project, project.glyphs[opts.currentChar], opts);
}

// ---------- Renderers ----------

export function renderSVG(scene, opts = {}) {
  const prec = opts.precision != null ? Math.max(1, Math.min(5, opts.precision)) : 2;
  const r = (v) => { const f = Math.pow(10, prec); return (Math.round(v * f) / f).toString(); };
  const styling = opts.styling || "presentation";
  const minify = !!opts.minify;
  const sp = minify ? "" : " ";
  const { width: W, height: H, background, shapes, labels, lines } = scene;
  let head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  if (background) head += `<rect width="${W}" height="${H}" fill="${background}"/>`;
  let body = "";
  for (const ln of lines || []) body += `<line x1="${r(ln.x1)}" y1="${r(ln.y1)}" x2="${r(ln.x2)}" y2="${r(ln.y2)}" stroke="${ln.color}" stroke-width="${r(ln.width || 1)}"/>`;
  const cssMap = new Map();
  let nextClass = 0;
  let cssRules = "";
  const classFor = (g, sh) => {
    const key = `${g.fill}|${g.fillOpacity}|${g.stroke}|${g.strokeWidth * sh.scale}|${g.strokeOpacity}|${g.opacity}|${g.cap}|${g.join}|${g.dash ? g.dash.join(",") : ""}`;
    if (!cssMap.has(key)) {
      const cls = `s${nextClass++}`;
      cssMap.set(key, cls);
      const decl = [];
      if (g.fill != null) decl.push(`fill:${g.fill}`); else decl.push("fill:none");
      if (g.fillOpacity != null && g.fillOpacity !== 1) decl.push(`fill-opacity:${g.fillOpacity}`);
      if (g.stroke != null) { decl.push(`stroke:${g.stroke}`); decl.push(`stroke-width:${r(g.strokeWidth * sh.scale)}`); } else decl.push("stroke:none");
      if (g.strokeOpacity != null && g.strokeOpacity !== 1) decl.push(`stroke-opacity:${g.strokeOpacity}`);
      if (g.opacity != null && g.opacity !== 1) decl.push(`opacity:${g.opacity}`);
      if (g.cap) decl.push(`stroke-linecap:${g.cap}`);
      if (g.join) decl.push(`stroke-linejoin:${g.join}`);
      if (g.dash) decl.push(`stroke-dasharray:${r(g.dash[0] * sh.scale)}${sp}${r(g.dash[1] * sh.scale)}`);
      cssRules += `.${cls}{${decl.join(";")}}`;
      return cls;
    }
    return cssMap.get(key);
  };
  for (const sh of shapes) {
    const map = (p) => ({ x: sh.x + p.x * sh.scale, y: sh.y - p.y * sh.scale });
    for (const g of groupByAppearance(sh.contours, sh.color, { solidify: true })) {
      let d = "";
      for (const c of g.contours) {
        eachSeg(c, (op, ...a) => {
          if (op === "M") { const p = map(a[0]); d += `M${r(p.x)}${sp}${r(p.y)}${sp}`; }
          else if (op === "L") { const p = map(a[0]); d += `L${r(p.x)}${sp}${r(p.y)}${sp}`; }
          else if (op === "C") { const c1 = map(a[0]), c2 = map(a[1]), e = map(a[2]); d += `C${r(c1.x)}${sp}${r(c1.y)}${sp}${r(c2.x)}${sp}${r(c2.y)}${sp}${r(e.x)}${sp}${r(e.y)}${sp}`; }
          else if (op === "Z") d += `Z${sp}`;
        });
      }
      if (styling === "css") {
        const cls = classFor(g, sh);
        body += `<path class="${cls}" d="${d.trim()}" fill-rule="evenodd"/>`;
      } else if (styling === "inline") {
        const decl = [];
        if (g.fill != null) decl.push(`fill:${g.fill}`); else decl.push("fill:none");
        if (g.fillOpacity != null && g.fillOpacity !== 1) decl.push(`fill-opacity:${g.fillOpacity}`);
        if (g.stroke != null) { decl.push(`stroke:${g.stroke}`); decl.push(`stroke-width:${r(g.strokeWidth * sh.scale)}`); } else decl.push("stroke:none");
        if (g.strokeOpacity != null && g.strokeOpacity !== 1) decl.push(`stroke-opacity:${g.strokeOpacity}`);
        if (g.opacity != null && g.opacity !== 1) decl.push(`opacity:${g.opacity}`);
        if (g.cap) decl.push(`stroke-linecap:${g.cap}`);
        if (g.join) decl.push(`stroke-linejoin:${g.join}`);
        if (g.dash) decl.push(`stroke-dasharray:${r(g.dash[0] * sh.scale)}${sp}${r(g.dash[1] * sh.scale)}`);
        body += `<path d="${d.trim()}" style="${decl.join(";")}" fill-rule="evenodd"/>`;
      } else {
        const dash = g.dash ? `stroke-dasharray="${r(g.dash[0] * sh.scale)}${sp}${r(g.dash[1] * sh.scale)}" stroke-dashoffset="${r((g.dash[2] || 0) * sh.scale)}"` : "";
        body += `<path d="${d.trim()}" fill="${g.fill == null ? "none" : g.fill}" fill-opacity="${g.fillOpacity}" fill-rule="evenodd" stroke="${g.stroke == null ? "none" : g.stroke}" stroke-width="${g.stroke ? r(g.strokeWidth * sh.scale) : 0}" stroke-opacity="${g.strokeOpacity}" opacity="${g.opacity}" stroke-linecap="${g.cap}" stroke-linejoin="${g.join}" ${dash}/>`;
      }
    }
  }
  const css = styling === "css" && cssRules ? `<style>${cssRules}</style>` : "";
  let tail = "";
  for (const lb of labels || []) {
    if (opts.outlineText) continue;
    const anchor = lb.align === "center" ? "middle" : lb.align === "right" ? "end" : "start";
    tail += `<text x="${r(lb.x)}" y="${r(lb.y)}" font-family="Helvetica, Arial, sans-serif" font-size="${lb.size}" fill="${lb.color}" text-anchor="${anchor}">${escXml(lb.text)}</text>`;
  }
  return head + css + body + tail + "</svg>";
}

function buildPDF(W, H, content) {
  const bytes = [];
  const offsets = [];
  const push = (str) => { for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff); };
  push("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
  offsets[1] = bytes.length; push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = bytes.length; push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = bytes.length; push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(W)} ${n(H)}] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n`);
  offsets[4] = bytes.length;
  push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  const xref = bytes.length;
  push("xref\n0 5\n0000000000 65535 f\r\n");
  for (let i = 1; i <= 4; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n\r\n`);
  push(`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export function renderPDF(scene) {
  const us = 0.75;
  const W = scene.width * us, H = scene.height * us;
  let c = "";
  for (const ln of scene.lines || []) {
    const [r, g, b] = hexToRgb01(ln.color);
    c += `${r} ${g} ${b} RG\n${n((ln.width || 1) * us)} w\n${n(ln.x1 * us)} ${n((scene.height - ln.y1) * us)} m ${n(ln.x2 * us)} ${n((scene.height - ln.y2) * us)} l S\n`;
  }
  for (const sh of scene.shapes) {
    const map = (p) => ({ x: (sh.x + p.x * sh.scale) * us, y: (scene.height - (sh.y - p.y * sh.scale)) * us });
    for (const g of groupByAppearance(sh.contours, sh.color, { solidify: true })) {
      const [fr, fg, fb] = g.fill != null ? hexToRgb01(g.fill) : [0, 0, 0];
      const [sr, sg, sb] = g.stroke != null ? hexToRgb01(g.stroke) : [0, 0, 0];
      if (g.fill != null) c += `${fr} ${fg} ${fb} rg\n`;
      if (g.stroke != null) { c += `${sr} ${sg} ${sb} RG\n${n(g.strokeWidth * sh.scale * us)} w\n`; if (g.dash) c += `[${n(g.dash[0] * sh.scale * us)} ${n(g.dash[1] * sh.scale * us)}] ${n((g.dash[2] || 0) * sh.scale * us)} d\n`; else c += "[] 0 d\n"; }
      for (const con of g.contours) {
        eachSeg(con, (op, ...a) => {
          if (op === "M") { const p = map(a[0]); c += `${n(p.x)} ${n(p.y)} m\n`; }
          else if (op === "L") { const p = map(a[0]); c += `${n(p.x)} ${n(p.y)} l\n`; }
          else if (op === "C") { const c1 = map(a[0]), c2 = map(a[1]), e = map(a[2]); c += `${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(e.x)} ${n(e.y)} c\n`; }
          else if (op === "Z") c += "h\n";
        });
      }
      if (g.fill != null && g.stroke != null) c += "B*\n";
      else if (g.fill != null) c += "f*\n";
      else if (g.stroke != null) c += "S\n";
    }
  }
  for (const lb of scene.labels || []) {
    const [r, g, b] = hexToRgb01(lb.color);
    const py = (scene.height - lb.y) * us;
    let px = lb.x * us;
    if (lb.align === "center") px = lb.x * us - (lb.text.length * lb.size * 0.25 * us);
    else if (lb.align === "right") px = lb.x * us - lb.text.length * lb.size * 0.5 * us;
    c += `${r} ${g} ${b} rg\nBT /F1 ${n(lb.size * us)} Tf ${n(px)} ${n(py)} Td (${escPdf(lb.text)}) Tj ET\n`;
  }
  return buildPDF(W, H, c);
}

export function renderEPS(scene) {
  const us = 0.75;
  const W = scene.width * us, H = scene.height * us;
  let c = "";
  for (const ln of scene.lines || []) {
    const [r, g, b] = hexToRgb01(ln.color);
    c += `${r} ${g} ${b} setrgbcolor ${n((ln.width || 1) * us)} setlinewidth newpath ${n(ln.x1 * us)} ${n((scene.height - ln.y1) * us)} moveto ${n(ln.x2 * us)} ${n((scene.height - ln.y2) * us)} lineto stroke\n`;
  }
  for (const sh of scene.shapes) {
    const map = (p) => ({ x: (sh.x + p.x * sh.scale) * us, y: (scene.height - (sh.y - p.y * sh.scale)) * us });
    for (const g of groupByAppearance(sh.contours, sh.color, { solidify: true })) {
      const build = () => {
        let p = "";
        for (const con of g.contours) {
          eachSeg(con, (op, ...a) => {
            if (op === "M") { const q = map(a[0]); p += `${n(q.x)} ${n(q.y)} moveto\n`; }
            else if (op === "L") { const q = map(a[0]); p += `${n(q.x)} ${n(q.y)} lineto\n`; }
            else if (op === "C") { const c1 = map(a[0]), c2 = map(a[1]), e = map(a[2]); p += `${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(e.x)} ${n(e.y)} curveto\n`; }
            else if (op === "Z") p += "closepath\n";
          });
        }
        return p;
      };
      if (g.fill != null) { const [r, gg, b] = hexToRgb01(g.fill); c += `${r} ${gg} ${b} setrgbcolor ${build()}`; if (g.stroke != null) c += "gsave eofill grestore\n"; else c += "eofill\n"; }
      if (g.stroke != null) { const [r, gg, b] = hexToRgb01(g.stroke); c += `${r} ${gg} ${b} setrgbcolor ${n(g.strokeWidth * sh.scale * us)} setlinewidth `; if (g.dash) c += `[${n(g.dash[0] * sh.scale * us)} ${n(g.dash[1] * sh.scale * us)}] ${n((g.dash[2] || 0) * sh.scale * us)} setdash `; c += `${build()}stroke\n`; }
    }
  }
  for (const lb of scene.labels || []) {
    const [r, g, b] = hexToRgb01(lb.color);
    const py = (scene.height - lb.y) * us;
    let px = lb.x * us;
    if (lb.align === "center") px = lb.x * us - (lb.text.length * lb.size * 0.25 * us);
    else if (lb.align === "right") px = lb.x * us - lb.text.length * lb.size * 0.5 * us;
    c += `${r} ${g} ${b} setrgbcolor /Helvetica findfont ${n(lb.size * us)} scalefont setfont ${n(px)} ${n(py)} moveto (${escPdf(lb.text)}) show\n`;
  }
  return new Blob([`%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${n(W)} ${n(H)}\n%%EndComments\n${c}%%EOF\n`], { type: "application/postscript" });
}

export async function renderRaster(scene, format, opts = {}) {
  const mult = opts.scale || (opts.dpi ? opts.dpi / 96 : 1);
  const W = Math.max(1, Math.round(scene.width * mult)), H = Math.max(1, Math.round(scene.height * mult));
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = opts.smoothing !== false;
  ctx.scale(mult, mult);
  if (scene.background) { ctx.fillStyle = scene.background; ctx.fillRect(0, 0, scene.width, scene.height); }
  for (const ln of scene.lines || []) { ctx.beginPath(); ctx.moveTo(ln.x1, ln.y1); ctx.lineTo(ln.x2, ln.y2); ctx.strokeStyle = ln.color; ctx.lineWidth = ln.width || 1; ctx.stroke(); }
  for (const sh of scene.shapes) {
    const map = (p) => ({ x: sh.x + p.x * sh.scale, y: sh.y - p.y * sh.scale });
    for (const g of groupByAppearance(sh.contours, sh.color, { solidify: true })) {
      ctx.beginPath();
      for (const con of g.contours) {
        eachSeg(con, (op, ...a) => {
          if (op === "M") { const p = map(a[0]); ctx.moveTo(p.x, p.y); }
          else if (op === "L") { const p = map(a[0]); ctx.lineTo(p.x, p.y); }
          else if (op === "C") { const c1 = map(a[0]), c2 = map(a[1]), e = map(a[2]); ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y); }
          else if (op === "Z") ctx.closePath();
        });
      }
      ctx.globalAlpha = g.opacity;
      if (g.fill != null) { ctx.fillStyle = g.fill; ctx.globalAlpha = g.opacity * g.fillOpacity; ctx.fill("evenodd"); }
      if (g.stroke != null) { ctx.strokeStyle = g.stroke; ctx.lineWidth = g.strokeWidth * sh.scale; ctx.globalAlpha = g.opacity * g.strokeOpacity; ctx.lineCap = g.cap; ctx.lineJoin = g.join; if (g.dash) ctx.setLineDash([g.dash[0] * sh.scale, g.dash[1] * sh.scale]); else ctx.setLineDash([]); ctx.lineDashOffset = (g.dash?.[2] || 0) * sh.scale; ctx.stroke(); ctx.setLineDash([]); }
      ctx.globalAlpha = 1;
    }
  }
  for (const lb of scene.labels || []) { ctx.font = `${lb.size}px Helvetica, Arial, sans-serif`; ctx.fillStyle = lb.color; ctx.textAlign = lb.align || "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(lb.text, lb.x, lb.y); }
  return await new Promise((res) => canvas.toBlob(res, format === "jpg" ? "image/jpeg" : "image/png", opts.quality || 0.92));
}

// ---------- Dispatchers ----------

export function scaleProjectToUPM(project, targetUPM) {
  const cur = project.metrics.unitsPerEm || 1000;
  if (targetUPM === cur) return project;
  const k = targetUPM / cur;
  const scalePt = (p) => ({ ...p, x: p.x * k, y: p.y * k, in: p.in ? { x: p.in.x * k, y: p.in.y * k } : null, out: p.out ? { x: p.out.x * k, y: p.out.y * k } : null });
  const scaleContour = (c) => c.liveShape
    ? { ...c, liveShape: { ...c.liveShape, x: c.liveShape.x * k, y: c.liveShape.y * k, width: c.liveShape.width * k, height: c.liveShape.height * k } }
    : { ...c, points: (c.points || []).map(scalePt) };
  const glyphs = {};
  Object.keys(project.glyphs || {}).forEach((ch) => {
    const g = project.glyphs[ch];
    glyphs[ch] = { ...g, contours: (g.contours || []).map(scaleContour), advanceWidth: (g.advanceWidth || 0) * k, leftSideBearing: (g.leftSideBearing || 0) * k, rightSideBearing: (g.rightSideBearing || 0) * k };
  });
  const m = project.metrics;
  const metrics = { ...m, unitsPerEm: targetUPM, ascender: (m.ascender || 0) * k, capHeight: (m.capHeight || 0) * k, xHeight: (m.xHeight || 0) * k, descender: (m.descender || 0) * k, defaultAdvanceWidth: (m.defaultAdvanceWidth || 0) * k, defaultLSB: (m.defaultLSB || 0) * k, defaultRSB: (m.defaultRSB || 0) * k };
  return { ...project, metrics, glyphs };
}

export async function exportFont(project, format, opts = {}) {
  if (format === "ttf" || format === "otf") {
    const p = opts.upm ? scaleProjectToUPM(project, opts.upm) : project;
    const bytes = encodeTTF(p);
    return { blob: new Blob([bytes], { type: "font/ttf" }), ext: format };
  }
  if (format === "woff") {
    const p = opts.upm ? scaleProjectToUPM(project, opts.upm) : project;
    const bytes = await encodeWOFF(p);
    return { blob: new Blob([bytes], { type: "font/woff" }), ext: "woff" };
  }
  if (format === "woff2") {
    const p = opts.upm ? scaleProjectToUPM(project, opts.upm) : project;
    const bytes = await encodeWOFF2(p);
    return { blob: new Blob([bytes], { type: "font/woff2" }), ext: "woff2" };
  }
  return null;
}

export async function exportArtwork(project, target, format, opts) {
  const scene = buildScene(project, target, opts);
  if (format === "svg") return { blob: new Blob([renderSVG(scene, opts)], { type: "image/svg+xml" }), ext: "svg" };
  if (format === "pdf") return { blob: renderPDF(scene), ext: "pdf" };
  if (format === "eps") return { blob: renderEPS(scene), ext: "eps" };
  if (format === "png" || format === "jpg") { const blob = await renderRaster(scene, format, opts); return { blob, ext: format === "jpg" ? "jpg" : "png" }; }
  throw new Error("Unsupported format");
}

export async function exportAll(project, opts = {}) {
  const slug = opts.slug || "font";
  const files = [];
  try { const f = await exportFont(project, "ttf"); if (f) files.push({ name: `${slug}.ttf`, ...f }); } catch {}
  try { const f = await exportFont(project, "otf"); if (f) files.push({ name: `${slug}.otf`, ...f }); } catch {}
  try { const f = await exportFont(project, "woff"); if (f) files.push({ name: `${slug}.woff`, ...f }); } catch {}
  try { const f = await exportFont(project, "woff2"); if (f) files.push({ name: `${slug}.woff2`, ...f }); } catch {}
  files.push({ name: `${slug}-Glyph-Sheet.pdf`, blob: renderPDF(sceneSheet(project, designedGlyphs(project), { columns: 6, cellSize: 180, color: "#000", background: "#ffffff", showLabels: true })), ext: "pdf" });
  files.push({ name: `${slug}-Specimen.pdf`, blob: renderPDF(sceneSpecimen(project, { ...opts, background: "#ffffff" })), ext: "pdf" });
  for (const g of designedGlyphs(project)) { const safe = g.char === " " ? "space" : g.char; files.push({ name: `${slug}-${safe}.svg`, blob: new Blob([renderSVG(sceneGlyph(project, g, { width: 600, height: 600, color: "#000", pad: 80 }))], { type: "image/svg+xml" }), ext: "svg" }); }
  return files;
}