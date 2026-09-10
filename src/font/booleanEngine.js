// Shape Shifter boolean operations for DR Font Studio.
//
// Real vector boolean engine: selected contours are flattened to polygons,
// split at every intersection into a planar arrangement, faces are traced and
// classified by winding number against each source polygon, then assembled
// into editable vector contours per the requested operation.
//
// Results are real, editable corner-point contours (curves are flattened at
// the chosen precision). Nothing is rasterized.

import { flattenContour, reverseContour } from "./geometry";

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;

function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

// Nonzero winding number of P w.r.t. a polygon ring.
function windingNumber(P, ring) {
  let wn = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    if (a.y <= P.y) {
      if (b.y > P.y && cross(sub(b, a), sub(P, a)) > 0) wn++;
    } else if (b.y <= P.y && cross(sub(b, a), sub(P, a)) < 0) wn--;
  }
  return wn;
}

// A point strictly inside a simple ring (scanline at mid-y).
function interiorPoint(ring) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of ring) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  if (!isFinite(minY) || maxY - minY < 1e-12) {
    let cx = 0, cy = 0; for (const p of ring) { cx += p.x; cy += p.y; }
    return { x: cx / ring.length, y: cy / ring.length };
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const y = minY + (maxY - minY) * (0.18 + 0.13 * attempt);
    const xs = [];
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) return { x: (xs[i] + xs[i + 1]) / 2, y };
  }
  let cx = 0, cy = 0; for (const p of ring) { cx += p.x; cy += p.y; }
  return { x: cx / ring.length, y: cy / ring.length };
}

// Interior point of a face (inside outer ring, outside all hole rings).
function facePoint(outer, holes) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of outer) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  if (!isFinite(minY)) return interiorPoint(outer);
  for (let attempt = 0; attempt < 6; attempt++) {
    const y = minY + (maxY - minY) * (0.18 + 0.13 * attempt);
    const xs = [];
    for (let i = 0, n = outer.length; i < n; i++) {
      const a = outer[i], b = outer[(i + 1) % n];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const P = { x: mx, y };
      if (!holes.some((h) => windingNumber(P, h) !== 0)) return P;
    }
  }
  return interiorPoint(outer);
}

// ---------- Arrangement ----------

function buildArrangement(rings, prec) {
  const snap = (x, y) => `${Math.round(x / prec)},${Math.round(y / prec)}`;
  // Collect directed segments from all rings.
  const segs = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (snap(a.x, a.y) === snap(b.x, b.y)) continue;
      segs.push({ a, b });
    }
  }
  // Split points per segment (param t -> {t, pt}).
  const splitMaps = segs.map(() => new Map());
  const addSplit = (si, t, pt) => {
    const k = t.toFixed(10);
    if (!splitMaps[si].has(k)) splitMaps[si].set(k, { t, pt });
  };
  for (let i = 0; i < segs.length; i++) {
    addSplit(i, 0, segs[i].a);
    addSplit(i, 1, segs[i].b);
  }
  const eps = 1e-9;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const p1 = segs[i].a, p2 = segs[i].b, p3 = segs[j].a, p4 = segs[j].b;
      const r = sub(p2, p1), s = sub(p4, p3);
      const denom = cross(r, s);
      if (Math.abs(denom) < eps) {
        // parallel; collinear overlap?
        if (Math.abs(cross(sub(p3, p1), r)) > eps) continue;
        const len = dot(r, r) || 1;
        const tc = dot(sub(p3, p1), r) / len;
        const td = dot(sub(p4, p1), r) / len;
        const lo = Math.max(0, Math.min(tc, td));
        const hi = Math.min(1, Math.max(tc, td));
        if (hi - lo < 1e-9) continue;
        const pa = { x: p1.x + r.x * lo, y: p1.y + r.y * lo };
        const pb = { x: p1.x + r.x * hi, y: p1.y + r.y * hi };
        addSplit(i, lo, pa); addSplit(i, hi, pb);
        const lenj = dot(s, s) || 1;
        const ta = dot(sub(pa, p3), s) / lenj;
        const tb = dot(sub(pb, p3), s) / lenj;
        addSplit(j, ta, pa); addSplit(j, tb, pb);
        continue;
      }
      const t = cross(sub(p3, p1), s) / denom;
      const u = cross(sub(p3, p1), r) / denom;
      if (t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps) {
        const ct = Math.max(0, Math.min(1, t));
        const cu = Math.max(0, Math.min(1, u));
        const px = p1.x + r.x * ct, py = p1.y + r.y * ct;
        const p = { x: Math.round(px / prec) * prec, y: Math.round(py / prec) * prec };
        addSplit(i, ct, p);
        addSplit(j, cu, p);
      }
    }
  }
  // Build half-edges from consecutive split points.
  const nodeMap = new Map();
  const getNode = (pt) => {
    const k = snap(pt.x, pt.y);
    if (!nodeMap.has(k)) nodeMap.set(k, { x: pt.x, y: pt.y, out: [] });
    return nodeMap.get(k);
  };
  // Dedup directed edges by (fromKey,toKey).
  const dirMap = new Map();
  const halfEdges = [];
  const addHalf = (a, b) => {
    const na = getNode(a), nb = getNode(b);
    const fk = snap(a.x, a.y), tk = snap(b.x, b.y);
    if (fk === tk) return;
    const dk = fk + ">" + tk;
    if (dirMap.has(dk)) return;
    const he = { id: halfEdges.length, from: na, to: nb, fromKey: fk, toKey: tk, angle: Math.atan2(nb.y - na.y, nb.x - na.x), twin: null, next: null, face: -1, used: false };
    halfEdges.push(he);
    dirMap.set(dk, he.id);
    na.out.push(he);
  };
  for (let si = 0; si < segs.length; si++) {
    const splits = [...splitMaps[si].values()].sort((a, b) => a.t - b.t);
    for (let k = 0; k + 1 < splits.length; k++) {
      addHalf(splits[k].pt, splits[k + 1].pt);
    }
  }
  // Ensure twins exist for every undirected edge (boundary edges need a back side).
  for (let i = 0; i < halfEdges.length; i++) {
    const he = halfEdges[i];
    const tk = he.toKey + ">" + he.fromKey;
    if (dirMap.has(tk)) { he.twin = halfEdges[dirMap.get(tk)]; continue; }
    const twin = { id: halfEdges.length, from: he.to, to: he.from, fromKey: he.toKey, toKey: he.fromKey, angle: Math.atan2(he.from.y - he.to.y, he.from.x - he.to.x), twin: he, next: null, face: -1, used: false };
    halfEdges.push(twin);
    dirMap.set(tk, twin.id);
    he.twin = twin;
    twin.twin = he;
    he.to.out.push(twin);
  }
  // Sort outgoing half-edges by angle at each node.
  for (const node of nodeMap.values()) node.out.sort((a, b) => a.angle - b.angle);
  return { halfEdges, nodes: nodeMap };
}

// Trace face cycles. Each half-edge belongs to exactly one cycle (face on its left).
function traceFaces(halfEdges, nodes) {
  let faceId = 0;
  const faces = []; // { id, ring: [points], area }
  for (let i = 0; i < halfEdges.length; i++) {
    const start = halfEdges[i];
    if (start.used) continue;
    const ring = [];
    let he = start;
    let guard = 0;
    while (!he.used) {
      he.used = true;
      he.face = faceId;
      ring.push({ x: he.from.x, y: he.from.y });
      // next: at destination node, pick the outgoing edge immediately clockwise
      // from the reverse (twin) of the incoming edge.
      const node = he.to;
      const out = node.out;
      let twinIdx = out.indexOf(he.twin);
      let next = null;
      for (let k = 1; k <= out.length; k++) {
        const cand = out[(twinIdx - k + out.length) % out.length];
        if (!cand.used || cand === start) { next = cand; break; }
      }
      if (!next) break;
      he = next;
      if (++guard > halfEdges.length + 4) break;
    }
    if (ring.length >= 3) {
      const area = signedArea(ring);
      if (Math.abs(area) > 1e-10) faces.push({ id: faceId, ring, area });
    }
    faceId++;
  }
  return faces;
}

// Nest cycles by containment. Returns parent index per cycle (or -1).
function nestCycles(faces) {
  const reps = faces.map((f) => ({ ...interiorPoint(f.ring), area: Math.abs(f.area), idx: f.id }));
  const parent = new Array(faces.length).fill(-1);
  for (let i = 0; i < faces.length; i++) {
    let best = -1, bestArea = Infinity;
    for (let j = 0; j < faces.length; j++) {
      if (i === j) continue;
      if (windingNumber(reps[i], faces[j].ring) !== 0) {
        if (Math.abs(faces[j].area) < bestArea) { bestArea = Math.abs(faces[j].area); best = j; }
      }
    }
    parent[i] = best;
  }
  return parent;
}

// Group cycles into faces (regions): outer cycle + its immediate holes.
// A cycle is an "outer" of a region if its parent is at even depth from root;
// holes are the cycles whose parent is that outer.
function buildRegions(faces, parent) {
  // depth from virtual root
  const depth = new Array(faces.length).fill(0);
  for (let i = 0; i < faces.length; i++) {
    let d = 0, p = parent[i];
    const seen = new Set([i]);
    while (p !== -1 && !seen.has(p)) { seen.add(p); d++; p = parent[p]; }
    depth[i] = d;
  }
  const regions = [];
  for (let i = 0; i < faces.length; i++) {
    if (depth[i] % 2 !== 0) continue; // outermost of a region at even depth
    const holes = [];
    for (let j = 0; j < faces.length; j++) if (parent[j] === i) holes.push(j);
    regions.push({ outer: i, holes });
  }
  return regions;
}

// ---------- Operations ----------

// options: { steps, removeRedundant, removeUnpainted }
// selectedContours: in stacking order (index 0 = back, last = front)
export function runShapeShifter(selectedContours, op, options = {}) {
  const steps = options.steps || 24;
  const warnings = [];
  if (!selectedContours || selectedContours.length < 2) {
    return { contours: [], warnings: ["Shape Shifter requires at least two objects."] };
  }

  // Flatten each contour to a ring; auto-close open paths.
  const rings = [];
  for (let i = 0; i < selectedContours.length; i++) {
    const c = selectedContours[i];
    if (!c || !c.points || c.points.length < 2) { warnings.push(`Object ${i + 1} has too few points.`); continue; }
    let pts = flattenContour(c, steps);
    if (!c.closed) {
      warnings.push(`Object ${i + 1} was an open path and has been closed.`);
    }
    // dedupe consecutive identical points
    const clean = [];
    for (const p of pts) {
      if (!clean.length || Math.abs(clean[clean.length - 1].x - p.x) > 1e-9 || Math.abs(clean[clean.length - 1].y - p.y) > 1e-9) clean.push(p);
    }
    if (clean.length >= 3) rings.push(clean);
  }
  if (rings.length < 2) {
    return { contours: selectedContours.map((c) => ({ ...c })), warnings: ["Not enough valid closed geometry to operate on."] };
  }

  const prec = 1e-3;
  const { halfEdges, nodes } = buildArrangement(rings, prec);
  const faces = traceFaces(halfEdges, nodes);
  if (!faces.length) {
    return { contours: [], warnings: ["These objects cannot be combined with this operation."] };
  }
  // Rep point for a traced cycle: a point just inside the face on its LEFT
  // (left-normal of the longest edge). This lies in the face the cycle bounds,
  // even when rings are concentric and non-intersecting.
  const cycleRep = (ring) => {
    let best = 0, bestLen = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > bestLen) { bestLen = len; best = i; }
    }
    const a = ring[best], b = ring[(best + 1) % ring.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = Math.max(len * 0.01, prec * 8);
    return { x: (a.x + b.x) / 2 + (-dy / len) * off, y: (a.y + b.y) / 2 + (dx / len) * off };
  };
  const cycleReps = faces.map((f) => cycleRep(f.ring));

  // Build nesting tree: parent[i] = smallest cycle containing cycle i.
  // Each traced cycle is its own face (group); its holes are its immediate
  // children in the nesting tree. This correctly distinguishes adjacent
  // (non-nested) faces that the old "same side of every other cycle" test
  // incorrectly merged.
  const parent = new Array(faces.length).fill(-1);
  for (let i = 0; i < faces.length; i++) {
    let best = -1, bestArea = Infinity;
    for (let j = 0; j < faces.length; j++) {
      if (i === j) continue;
      if (windingNumber(cycleReps[i], faces[j].ring) !== 0) {
        if (Math.abs(faces[j].area) < bestArea) { bestArea = Math.abs(faces[j].area); best = j; }
      }
    }
    parent[i] = best;
  }
  const groups = faces.map((f, i) => ({ cycles: [i], outer: i, holes: [], rep: cycleReps[i] }));
  for (let i = 0; i < faces.length; i++) {
    if (parent[i] !== -1) groups[parent[i]].holes.push(i);
  }
  // Refine rep: for bounded faces (CCW) with holes, use facePoint (inside
  // outer, outside holes). The unbounded face (CW, negative area) keeps
  // cycleRep — its left-normal points into the unbounded region, which is
  // correct; facePoint would wrongly land inside the bounded area.
  for (let i = 0; i < groups.length; i++) {
    const isUnbounded = faces[groups[i].outer].area < 0;
    if (!isUnbounded && groups[i].holes.length) {
      groups[i].rep = facePoint(faces[groups[i].outer].ring, groups[i].holes.map((h) => faces[h].ring));
    }
  }
  const faceIdToGroup = new Map();
  groups.forEach((g, gi) => faceIdToGroup.set(faces[gi].id, gi));
  const groupForFace = (faceId) => (faceIdToGroup.has(faceId) ? faceIdToGroup.get(faceId) : -1);

  const nSrc = rings.length;
  const groupInfo = groups.map((g) => {
    const inside = rings.map((r) => windingNumber(g.rep, r) !== 0);
    return { group: g, inside };
  });

  // Classify faces per operation.
  const back = 0, front = nSrc - 1;
  const isKept = (info) => {
    switch (op) {
      case "unite": return info.inside.some((x) => x);
      case "intersect": return info.inside.every((x) => x);
      case "exclude": return info.inside.filter((x) => x).length % 2 === 1;
      case "minusFront": return info.inside[back] && !info.inside.slice(1).some((x) => x);
      case "minusBack": return info.inside[front] && !info.inside.slice(0, front).some((x) => x);
      case "divide":
      case "trim":
      case "crop":
      case "merge": return info.inside.some((x) => x);
      default: return false;
    }
  };

  // Attribution: index of the topmost source object containing the face.
  const attribution = (info) => {
    for (let i = nSrc - 1; i >= 0; i--) if (info.inside[i]) return i;
    return -1;
  };

  const appearanceOf = (contour) => contour?.appearance ? { ...contour.appearance } : null;
  const noFillStroke = (a) => ({ ...(a || {}), fill: null, stroke: null, strokeWidth: 0 });

  let outContours = [];

  const buildGroupContours = (group, appearance, dropStroke) => {
    const ap = dropStroke ? noFillStroke(appearance) : appearance;
    const result = [];
    const outer = normalizeRing(faces[group.outer].ring, true);
    result.push(makeContour(outer, ap, true));
    for (const h of group.holes) {
      const hr = normalizeRing(faces[h].ring, false);
      result.push(makeContour(hr, ap, true));
    }
    return result;
  };

  if (op === "outline") {
    // Output every arrangement edge as an open 2-point contour, fill none / stroke none.
    const seen = new Set();
    for (const he of halfEdges) {
      const k = he.fromKey < he.toKey ? he.fromKey + ">" + he.toKey : he.toKey + ">" + he.fromKey;
      if (seen.has(k)) continue;
      seen.add(k);
      if (options.removeUnpainted) {
        // skip edges not adjacent to any painted face
        const lf = he.face >= 0 ? groupForFace(he.face) : -1;
        const rf = he.twin && he.twin.face >= 0 ? groupForFace(he.twin.face) : -1;
        const painted = (ri) => ri >= 0 && selectedContours[attribution(groupInfo[ri])]?.appearance?.fill;
        if (!painted(lf) && !painted(rf)) continue;
      }
      outContours.push(makeContour([{ x: he.from.x, y: he.from.y }, { x: he.to.x, y: he.to.y }], null, false));
    }
    // outline: no fill, no stroke
    outContours = outContours.map((c) => ({ ...c, appearance: { fill: null, fillOpacity: 1, stroke: null, strokeWidth: 0, strokeOpacity: 1, opacity: 1, cap: "butt", join: "miter", dash: null } }));
  } else if (op === "divide" || op === "trim") {
    const dropStroke = op === "trim";
    for (const info of groupInfo) {
      if (!info.inside.some((x) => x)) continue;
      const attr = attribution(info);
      const ap = appearanceOf(selectedContours[attr]);
      outContours.push(...buildGroupContours(info.group, ap, dropStroke));
    }
  } else if (op === "crop") {
    for (const info of groupInfo) {
      if (!info.inside[front]) continue; // must be inside the frontmost (crop boundary)
      let attr = -1;
      for (let i = front - 1; i >= 0; i--) if (info.inside[i]) { attr = i; break; }
      if (attr < 0) continue;
      const ap = appearanceOf(selectedContours[attr]);
      outContours.push(...buildGroupContours(info.group, ap, false));
    }
  } else if (op === "merge") {
    // Group source objects by appearance key; attribute each face to its topmost source,
    // then merge faces sharing the same appearance group into unified paths (strokes removed).
    const apKey = (a) => a ? `f:${a.fill}|fo:${a.fillOpacity}|o:${a.opacity}` : "none";
    const appearanceGroupOf = selectedContours.map((c) => apKey(c?.appearance));
    const byGroup = new Map();
    for (let ri = 0; ri < groupInfo.length; ri++) {
      const info = groupInfo[ri];
      if (!info.inside.some((x) => x)) continue;
      const attr = attribution(info);
      const g = appearanceGroupOf[attr];
      if (!byGroup.has(g)) byGroup.set(g, { faces: [], appearance: appearanceOf(selectedContours[attr]) });
      byGroup.get(g).faces.push(ri);
    }
    for (const { faces: fis, appearance } of byGroup.values()) {
      const kept = new Set(fis);
      const ap = noFillStroke(appearance);
      const ringsOut = traceMergedBoundary(halfEdges, (fid) => {
        const ri = groupForFace(fid);
        return ri >= 0 && kept.has(ri);
      });
      for (const r of ringsOut) outContours.push(makeContour(r, ap, true));
    }
  } else {
    // Merged ops: unite / intersect / exclude / minusFront / minusBack
    const kept = new Set();
    for (let ri = 0; ri < groupInfo.length; ri++) if (isKept(groupInfo[ri])) kept.add(ri);
    // Appearance: frontmost relevant source.
    let apIdx;
    if (op === "minusFront") apIdx = back;
    else if (op === "minusBack") apIdx = front;
    else apIdx = front;
    const ap = appearanceOf(selectedContours[apIdx]);
    const ringsOut = traceMergedBoundary(halfEdges, (fid) => {
      const ri = groupForFace(fid);
      return ri >= 0 && kept.has(ri);
    });
    for (const r of ringsOut) outContours.push(makeContour(r, ap, true));
    if (!ringsOut.length && (op === "intersect" || op === "minusFront" || op === "minusBack")) {
      warnings.push("No overlapping area — the result is empty.");
    }
  }

  // Remove Redundant Anchor Points runs automatically after every Shape Shifter
  // operation to prevent node clusters on straight lines and smooth curves.
  outContours = outContours.map((c) => ({ ...c, points: removeRedundant(c.points) }));
  outContours = outContours.map((c) => ({ ...c, points: cleanupRing(c.points) })).filter((c) => c.points.length >= (c.closed ? 3 : 2));

  return { contours: outContours, warnings };
}

// Map a traced face id -> region index.
function regionForFace(faceId, regions) {
  for (let i = 0; i < regions.length; i++) {
    if (regions[i].outer === faceId) return i;
    if (regions[i].holes.includes(faceId)) return i;
  }
  return -1;
}

// Trace the merged boundary of a set of kept regions (internal edges removed).
// keptOf(faceId) -> bool. Returns array of rings (outer CCW, holes CW).
function traceMergedBoundary(halfEdges, keptOf) {
  const isBoundary = (he) => {
    const lf = he.face >= 0 ? keptOf(he.face) : false;
    const rf = he.twin && he.twin.face >= 0 ? keptOf(he.twin.face) : false;
    return lf !== rf;
  };
  const rings = [];
  for (let i = 0; i < halfEdges.length; i++) {
    const he = halfEdges[i];
    if (he.mbUsed || !isBoundary(he)) continue;
    const ring = [];
    let cur = he;
    let guard = 0;
    while (cur && !cur.mbUsed) {
      cur.mbUsed = true;
      if (cur.twin) cur.twin.mbUsed = true; // prevent duplicate ring from the twin's reverse traversal
      ring.push({ x: cur.from.x, y: cur.from.y });
      // next boundary edge at destination, clockwise from reverse
      const node = cur.to;
      const out = node.out;
      let twinIdx = out.indexOf(cur.twin);
      let next = null;
      for (let k = 1; k <= out.length; k++) {
        const cand = out[(twinIdx - k + out.length) % out.length];
        if (cand.mbUsed && cand !== he) continue;
        if (isBoundary(cand)) { next = cand; break; }
      }
      cur = next;
      if (++guard > halfEdges.length + 4) break;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

// Normalize ring orientation: outer CCW, holes CW (y-up).
function normalizeRing(ring, outer) {
  const a = signedArea(ring);
  const wantPositive = outer;
  if ((a > 0) !== wantPositive) return [...ring].reverse();
  return [...ring];
}

function makeContour(points, appearance, closed) {
  const pts = points.map((p) => ({ x: p.x, y: p.y, in: null, out: null, type: "corner" }));
  return { points: pts, closed, appearance: appearance ? { ...appearance } : null };
}

// Remove collinear/redundant points (keep corners).
function removeRedundant(points) {
  if (points.length < 3) return points;
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[(i - 1 + n) % n], b = points[i], c = points[(i + 1) % n];
    const cr = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
    if (Math.abs(cr) > 1e-6) out.push(b);
  }
  return out.length >= 3 ? out : points;
}

function cleanupRing(points) {
  const out = [];
  for (const p of points) {
    if (out.length && Math.abs(out[out.length - 1].x - p.x) < 1e-9 && Math.abs(out[out.length - 1].y - p.y) < 1e-9) continue;
    out.push(p);
  }
  if (out.length >= 2 && Math.abs(out[0].x - out[out.length - 1].x) < 1e-9 && Math.abs(out[0].y - out[out.length - 1].y) < 1e-9) out.pop();
  return out;
}

// ---------- Glyph validation ----------
export function validateContours(contours) {
  const issues = [];
  for (let i = 0; i < contours.length; i++) {
    const c = contours[i];
    if (!c.closed) issues.push(`Contour ${i + 1} is open.`);
    const pts = c.points || [];
    if (pts.length < 3) issues.push(`Contour ${i + 1} has too few points.`);
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j], b = pts[(j + 1) % pts.length];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.5) issues.push(`Contour ${i + 1} has a very small segment.`);
    }
  }
  return issues;
}

// ---------- Compound Shapes (non-destructive) ----------
// A compound shape is a single contour entry whose real geometry is the live
// Boolean result of its stored member contours. Members stay fully editable;
// the rendered/exported result is recomputed on demand via expandCompounds.

export function createCompound(members, op, appearance) {
  const ap = appearance || (members.length ? members[members.length - 1].appearance : null);
  return {
    closed: true,
    points: [],
    compound: { op, members: members.map((m) => JSON.parse(JSON.stringify(m))) },
    appearance: ap ? { ...ap } : null,
  };
}

// Bake a single compound into its static boolean result contours.
export function bakeCompound(compound) {
  const members = (compound.compound.members || []).filter((m) => m && m.points && m.points.length >= 2);
  if (!members.length) return [];
  if (members.length === 1) return [{ ...members[0], appearance: compound.appearance ?? members[0].appearance }];
  const res = runShapeShifter(members, compound.compound.op, { steps: 24, removeRedundant: true });
  const ap = compound.appearance;
  return res.contours.map((c) => (ap ? { ...c, appearance: { ...ap } } : c));
}

// Expand every compound contour into its baked boolean result. Non-compound
// contours pass through unchanged. resolveContours() runs this so all renderers,
// previews, and exporters see compound geometry transparently.
export function expandCompounds(contours) {
  const out = [];
  for (const c of contours || []) {
    if (c && c.compound) { for (const rc of bakeCompound(c)) out.push(rc); }
    else out.push(c);
  }
  return out;
}

// Release a compound back into its individual member contours (no boolean).
export function releaseCompound(compound) {
  return (compound.compound.members || []).map((m) => ({ ...m }));
}

// Ensure consistent contour winding for OTF/TTF export: outer rings CCW, holes
// CW (y-up), assigned by nesting depth via containment of a representative point.
export function normalizeGlyphDirections(contours) {
  const closed = [];
  const idxs = [];
  (contours || []).forEach((c, i) => {
    if (c && c.closed && c.points && c.points.length >= 3) { closed.push(c); idxs.push(i); }
  });
  if (!closed.length) return contours;
  const polys = closed.map((c) => flattenContour(c, 8));
  const reps = polys.map((p) => interiorPoint(p));
  const depth = new Array(closed.length).fill(0);
  for (let i = 0; i < closed.length; i++) {
    for (let j = 0; j < closed.length; j++) {
      if (i === j) continue;
      if (windingNumber(reps[i], polys[j]) !== 0) depth[i]++;
    }
  }
  const out = contours.map((c) => ({ ...c }));
  closed.forEach((c, k) => {
    const wantCCW = depth[k] % 2 === 0;
    if ((signedArea(polys[k]) > 0) !== wantCCW) out[idxs[k]] = reverseContour(c);
  });
  return out;
}