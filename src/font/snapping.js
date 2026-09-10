// Snapping helpers for the Direct Selection Tool.
// Typographic guides (baseline, cap, x-height, ascender, descender) + smart
// guides (alignment with other anchor points). All in font-space units.

export const TYPO_GUIDE_YS = (metrics) => [
  { y: 0, label: "Baseline" },
  { y: metrics.ascender, label: "Ascender" },
  { y: metrics.capHeight, label: "Cap" },
  { y: metrics.xHeight, label: "x" },
  { y: metrics.descender, label: "Descender" },
];

// Build a map of all editable anchor points: { "ci:pi": {x,y} }.
export function buildPointMap(contours) {
  const map = {};
  contours.forEach((c, ci) => {
    if (c.locked || c.hidden) return;
    c.points.forEach((p, pi) => { map[`${ci}:${pi}`] = { x: p.x, y: p.y }; });
  });
  return map;
}

// Snap a font-space point to nearby typographic guides (y) and other points (x/y).
// excludeKeys: keys being dragged (so they don't snap to themselves).
// tol: tolerance in font units.
// Returns { x, y, guides: [{axis:'h'|'v', pos}] } — guides are active snap lines to render.
export function snapPoint(fp, metrics, pointMap, excludeKeys, tol) {
  const ex = new Set(excludeKeys || []);
  const out = { x: fp.x, y: fp.y, guides: [] };

  // Y candidates: typographic guides + other points' y
  const yCands = TYPO_GUIDE_YS(metrics).map((g) => ({ pos: g.y, typo: true }));
  for (const key in pointMap) {
    if (ex.has(key)) continue;
    yCands.push({ pos: pointMap[key].y, typo: false });
  }
  let bestY = null, bestYD = tol;
  for (const c of yCands) {
    const d = Math.abs(fp.y - c.pos);
    if (d < bestYD) { bestYD = d; bestY = c; }
  }
  if (bestY) { out.y = bestY.pos; out.guides.push({ axis: "h", pos: bestY.pos, typo: bestY.typo }); }

  // X candidates: other points' x (no vertical typo guides)
  let bestX = null, bestXD = tol;
  for (const key in pointMap) {
    if (ex.has(key)) continue;
    const d = Math.abs(fp.x - pointMap[key].x);
    if (d < bestXD) { bestXD = d; bestX = pointMap[key].x; }
  }
  if (bestX !== null) { out.x = bestX; out.guides.push({ axis: "v", pos: bestX, typo: false }); }

  return out;
}