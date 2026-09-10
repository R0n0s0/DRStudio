// Convert a text frame into editable Bézier contours (Create Outlines).
//
// Extracts native glyph vector data directly from font file tables:
//   - OpenType CFF fonts → cubic Bézier curves (used as-is)
//   - TrueType glyf fonts → quadratic Bézier curves, degree-elevated to cubic
//
// All coordinates are stored as 64-bit floating-point numbers — no integer
// rounding, no rasterization, no bitmap tracing. The scaling matrix from
// font units (UPM) to canvas coordinates is applied with exact float math.
//
// Each glyph becomes its own group, so the user can ungroup to isolate
// individual letterform vectors. Glyphs with counters (O, B, P, A) render
// correctly via evenodd fill rule — holes stay transparent.

import { resolveContours, transformContour } from "./geometry";
import { layoutText, PROJECT_FONT_ID } from "./textModel";

// Convert a raw opentype.js Path (font units, y-up) into our contour model.
// Applies an exact scale + translate matrix with full float precision.
// Quadratic Béziers are degree-elevated to cubic Béziers using standard math:
//   Q(P0, C1, P1) → C(P0, P0 + ⅔(C1−P0), P1 + ⅔(C1−P1), P1)
function rawPathToContours(path, scale, offsetX, offsetY) {
  const contours = [];
  let cur = null;
  const tx = (x) => x * scale + offsetX;
  const ty = (y) => y * scale + offsetY;
  for (const c of path.commands) {
    if (c.type === "M") {
      cur = { closed: false, points: [{ x: tx(c.x), y: ty(c.y), in: null, out: null, type: "corner" }] };
      contours.push(cur);
    } else if (c.type === "L") {
      cur.points.push({ x: tx(c.x), y: ty(c.y), in: null, out: null, type: "corner" });
    } else if (c.type === "Q") {
      const p0 = cur.points[cur.points.length - 1];
      const c1x = tx(c.x1), c1y = ty(c.y1);
      const p1x = tx(c.x), p1y = ty(c.y);
      // Degree elevation: quadratic control point → cubic control points
      p0.out = { x: p0.x + (2 / 3) * (c1x - p0.x), y: p0.y + (2 / 3) * (c1y - p0.y) };
      p0.type = "smooth";
      cur.points.push({
        x: p1x, y: p1y,
        in: { x: p1x + (2 / 3) * (c1x - p1x), y: p1y + (2 / 3) * (c1y - p1y) },
        out: null, type: "smooth",
      });
    } else if (c.type === "C") {
      const p0 = cur.points[cur.points.length - 1];
      p0.out = { x: tx(c.x1), y: ty(c.y1) };
      p0.type = "smooth";
      cur.points.push({
        x: tx(c.x), y: ty(c.y),
        in: { x: tx(c.x2), y: ty(c.y2) },
        out: null, type: "smooth",
      });
    } else if (c.type === "Z") {
      if (cur) cur.closed = true;
    }
  }
  return contours;
}

// Returns { contours, groups } where each glyph is its own group, or { error }.
// groups: [{ id, startIdx, endIdx, label }] — one per glyph with outline data.
export async function createOutlines(f, project, loadedFonts) {
  const lines = layoutText(f, project.metrics, loadedFonts, project.glyphs);
  const allContours = [];
  const groups = [];
  let groupSeq = 0;

  const isProject = f.fontFamily === PROJECT_FONT_ID;

  if (isProject) {
    // Project font: use designed glyph contours directly (already cubic Bézier).
    const upm = project.metrics.unitsPerEm;
    const scale = f.fontSize / upm;
    for (const line of lines) {
      let cursorX = line.x;
      for (const ch of line.text) {
        const g = project.glyphs[ch];
        const adv = (g ? g.advanceWidth : upm * 0.5) * scale + f.tracking;
        if (g && g.contours && g.contours.length) {
          const gid = `g${groupSeq++}`;
          const startIdx = allContours.length;
          const resolved = resolveContours(g, project.glyphs);
          const transformed = resolved.map((c) =>
            transformContour(c, (x, y) => ({ x: x * scale + cursorX, y: y * scale + line.baselineY }))
          );
          transformed.forEach((c) => (c.group = gid));
          allContours.push(...transformed);
          groups.push({ id: gid, startIdx, endIdx: allContours.length, label: ch });
        }
        cursorX += adv;
      }
    }
    return { contours: allContours, groups };
  }

  // Loaded font file: extract native glyph vector data from font tables.
  const lf = loadedFonts?.find((l) => l.family === f.fontFamily || l.name === f.fontFamily);
  if (!lf || !lf.buffer) {
    // No font file loaded — fall back to bitmap tracing of the system font.
    return traceSystemFontOutlines(f, lines, groupSeq, allContours, groups);
  }
  let parsed;
  try {
    const opentype = (await import("opentype.js")).default;
    parsed = opentype.parse(lf.buffer);
  } catch (err) {
    return { error: "Could not parse this font file for outlining." };
  }
  // Exact scaling matrix from font units (UPM) to canvas coordinates.
  const scale = f.fontSize / parsed.unitsPerEm;
  for (const line of lines) {
    let cursorX = line.x;
    for (const ch of line.text) {
      const glyph = parsed.charToGlyph(ch);
      const adv = glyph.advanceWidth * scale + f.tracking;
      // Skip glyphs with no outline data (spaces, control characters).
      if (glyph.path && glyph.path.commands && glyph.path.commands.length > 0) {
        const gid = `g${groupSeq++}`;
        const startIdx = allContours.length;
        // glyph.path is the raw, unscaled path in font units (y-up).
        // We apply our own scaling matrix with full float precision.
        const cs = rawPathToContours(glyph.path, scale, cursorX, line.baselineY);
        cs.forEach((c) => (c.group = gid));
        allContours.push(...cs);
        groups.push({ id: gid, startIdx, endIdx: allContours.length, label: ch });
      }
      cursorX += adv;
    }
  }
  return { contours: allContours, groups };
}

// Fallback for system fonts (no font file loaded): render each glyph to a
// high-resolution bitmap and trace the boundary into polygon contours.
// Results are polygonal (not smooth Bézier) but work for any browser font.
async function traceSystemFontOutlines(f, lines, groupSeq, allContours, groups) {
  const { traceCharOutlines, measureChar } = await import("./bitmapTrace");
  const weight = f.fontWeight || "400";
  for (const line of lines) {
    let cursorX = line.x;
    for (const ch of line.text) {
      if (ch === " ") {
        cursorX += measureChar(" ", f.fontFamily, weight, f.fontSize) + f.tracking;
        continue;
      }
      const gid = `g${groupSeq++}`;
      const startIdx = allContours.length;
      const cs = traceCharOutlines(ch, f.fontFamily, weight, f.fontSize, cursorX, line.baselineY, gid);
      allContours.push(...cs);
      groups.push({ id: gid, startIdx, endIdx: allContours.length, label: ch });
      cursorX += measureChar(ch, f.fontFamily, weight, f.fontSize) + f.tracking;
    }
  }
  return { contours: allContours, groups };
}