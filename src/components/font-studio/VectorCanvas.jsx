import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  pathD, contourBounds, flattenContour, pointInPolygon,
  transformContour, dist, bezPoint, cubicSplit, resolveContours, reverseContour, shapeContour, brushStrokeContour, cornerInfo, clusterByContainment,
} from "@/font/geometry";
import { groupByAppearance, EDITOR_FILL, setAppearance, isGradientFill, DEFAULT_GRADIENT_STOPS, buildGradientForBBox, getAppearance } from "@/font/appearance";
import { buildGrad } from "./gradientUtils";
import StrokeLayer from "./StrokeLayer";
import GradientAnnotator from "./GradientAnnotator";
import { expandCompounds } from "@/font/booleanEngine";
import { wetBrushOutline, brushStroke } from "@/font/wetBrush";
import { pointsBBox, scalePointsTransform, rotatePointsTransform, startSubSelectionDrag } from "@/font/subSelection";
import { snapPoint, buildPointMap } from "@/font/snapping";
import CanvasRulers from "./CanvasRulers";
import ContextualControlBar from "./ContextualControlBar";
import CornerTypeDialog from "./CornerTypeDialog";
import TextFrameLayer from "./TextFrameLayer";
import TextFrameEditor from "./TextFrameEditor";
import { makeTextFrame, textFrameBounds } from "@/font/textModel";
import { makeLiveShape, toolLiveType, liveShapeHandles, liveShapeScalePatch, withLiveShape, moveLiveShape, arcAngleHandles, defaultDragParams, convertToPath } from "@/font/liveShapes";
import NumericShapeDialog from "./NumericShapeDialog";
import DraggableFloatingBar from "./DraggableFloatingBar";
import VectorToolBar from "./VectorToolBar";
import PenPreviewLayer from "./PenPreviewLayer";
import { toDisplay, UNIT_LABELS } from "@/font/units";
import { penCursorSVG, rotateCursorSVG, HANDLE_HIT, NODE_HIT, SEG_HIT, SHAPE_TOOLS, marqueeRect, boundsIntersect, pointInRect, brushFootprintPath } from "./canvasUtils";
import NodesLayer from "./NodesLayer";
import SubSelectionBBox from "./SubSelectionBBox";
import CanvasStatusBar from "./CanvasStatusBar";



export default function VectorCanvas({ glyph, glyphs, metrics, tool, showGrid, showGuides, zoom, pan, setZoom, setPan, onCommit, selContours, setSelContours, selPoints, setSelPoints, selSegments, setSelSegments, brushSize, pressureEnabled, showRulers, rulerUnit, setRulerUnit, showBBox = true,   selTextFrameId, setSelTextFrameId, editingTextFrameId, setEditingTextFrameId,   selCompoundMember, setSelCompoundMember,   textDefaults, loadedFonts, artboard, onArtboardChange, workspaceMode = "font", canvasTheme = "dark", onGradientStyleChange, project, onProject, lockMargins = false, onMarginChange, autoAddDelete = true, rubberBand = true, onToggleAutoAddDelete, onToggleRubberBand }) {
  const svgRef = useRef(null);
  const [work, setWorkState] = useState(glyph);
  const workRef = useRef(work);
  const setWork = (next) => { workRef.current = next; setWorkState(next); };
  const [marquee, setMarquee] = useState(null);
  const [snapGuides, setSnapGuides] = useState([]);
  const [nodeHover, setNodeHover] = useState(null);
  const [nodeHoverContour, setNodeHoverContour] = useState(null);
  const [penDraft, setPenDraft] = useState(null);
  const penAltUsed = useRef(false);
  const [penHover, setPenHover] = useState(null);
  const penTargetRef = useRef(null);
  const [penCursor, setPenCursor] = useState(null);
  const [penAddHit, setPenAddHit] = useState(null);
  const [altHeld, setAltHeld] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [subMode, setSubMode] = useState(null); // null = full Vector Tool; "sharp" | "smooth" | "delete" = single-purpose sub-mode
  const [drag, setDragState] = useState(null);
  const dragRef = useRef(drag);
  const setDrag = (next) => { dragRef.current = next; setDragState(next); };
  const onUpRef = useRef(null);
  const [shapeDraft, setShapeDraft] = useState(null);
  const brushPtsRef = useRef([]);
  const previewRef = useRef(null);
  const [brushing, setBrushing] = useState(false);
  const [textDraft, setTextDraft] = useState(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [hoverHandle, setHoverHandle] = useState(null);
  const [hoverObj, setHoverObj] = useState(false);
  const [cornerDialog, setCornerDialog] = useState(null);
  const [shapeDialog, setShapeDialog] = useState(null);
  const [selCorners, setSelCorners] = useState([]);
  const ctrlInnerRef = useRef(null);

  const prevChar = useRef(glyph.char);
  useEffect(() => {
    // Don't clobber the in-progress local work while a drag is active — a parent
    // re-render would otherwise jump the shape back to its committed position
    // and create a ghost/flicker mid-drag.
    if (dragRef.current) return;
    setWork(glyph);
    if (prevChar.current !== glyph.char) {
      prevChar.current = glyph.char;
      setSelPoints([]); setSelContours([]); setSelSegments([]); setMarquee(null); setPenDraft(null); setDrag(null); setShapeDraft(null); brushPtsRef.current = []; setBrushing(false);       setSelTextFrameId(null); setEditingTextFrameId(null);       setTextDraft(null); setSelCompoundMember(null); setPenCursor(null); setPenHover(null); setSelCorners([]); setPenAddHit(null);
    } else if (glyph.contours) {
      setSelContours((sc) => {
        const f = sc.filter((ci) => ci < glyph.contours.length);
        return f.length === sc.length ? sc : f;
      });
      setSelPoints((sp) => {
        const f = sp.filter((s) => s.contour < glyph.contours.length && s.point < (glyph.contours[s.contour]?.points?.length ?? 0));
        return f.length === sp.length ? sp : f;
      });
      setSelSegments((ss) => {
        const f = ss.filter((s) => s.contour < glyph.contours.length && s.seg < (glyph.contours[s.contour]?.points?.length ?? 0));
        return f.length === ss.length ? ss : f;
      });
    }
  }, [glyph]);

  // Auto-fit the view to the artboard when entering Illustration mode (and on first mount if already in it).
  const prevMode = useRef(workspaceMode);
  const didFitArtboard = useRef(false);
  useEffect(() => {
    if (workspaceMode === "illustration" && artboard && !didFitArtboard.current) {
      const r = svgRef.current?.getBoundingClientRect();
      if (r && r.width) {
        const pad = 120;
        const z = Math.min((r.width - pad) / artboard.width, (r.height - pad) / artboard.height);
        const zoom = Math.max(0.1, Math.min(4, z || 0.5));
        setZoom(zoom);
        setPan({ x: r.width / 2 - (artboard.width / 2) * zoom, y: r.height / 2 + (artboard.height / 2) * zoom });
        didFitArtboard.current = true;
      }
    }
    if (workspaceMode !== "illustration") didFitArtboard.current = false;
    prevMode.current = workspaceMode;
  }, [workspaceMode, artboard]);

  // Clear point/segment selection when leaving the Direct Selection Tool
  useEffect(() => {
    if (tool !== "node") { setSelPoints([]); setSelSegments([]); setSnapGuides([]); setSelCompoundMember(null); setSelCorners([]); setNodeHoverContour(null); }
    if (tool !== "type") setEditingTextFrameId(null);
    if (tool !== "pen" && tool !== "node" && tool !== "select" && tool !== "transform") setPenCursor(null);
    if (tool !== "pen") { if (penDraft) { const c = workRef.current?.contours?.[penDraft.contourIdx]; if (c && c.points.length >= 2) { commitWork(workRef.current); setSelContours([penDraft.contourIdx]); } else setWork(glyph); } setPenHover(null); setPenDraft(null); setSubMode(null); }
    if (tool !== "penAdd") setPenAddHit(null);
  }, [tool]);

  const toScreen = useCallback((p) => ({ x: p.x * zoom + pan.x, y: -p.y * zoom + pan.y }), [zoom, pan]);
  const toFont = useCallback((sx, sy) => ({ x: (sx - pan.x) / zoom, y: -(sy - pan.y) / zoom }), [zoom, pan]);
  const getMouse = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return toFont(e.clientX - r.left, e.clientY - r.top);
  };

  const commitWork = (next) => { setWork(next); onCommit(next); };

  // Gradient Tool annotator live + commit (operate on the single selected contour's fill)
  const applyGradientLive = useCallback((newGrad) => {
    const ci = selContours[0];
    if (ci == null) return;
    const contours = work.contours.map((c, i) => (i === ci ? setAppearance(c, { fill: newGrad }) : c));
    setWork({ ...work, contours });
  }, [work, selContours]);
  const applyGradientCommit = useCallback((newGrad) => {
    const ci = selContours[0];
    if (ci == null) return;
    const contours = work.contours.map((c, i) => (i === ci ? setAppearance(c, { fill: newGrad }) : c));
    commitWork({ ...work, contours });
  }, [work, selContours]);

  const pressureOf = (e) => {
    if (!pressureEnabled) return 1;
    if (!e || e.pointerType === "mouse" || e.pointerType === "touch") return 1;
    const pr = typeof e.pressure === "number" ? e.pressure : 0.5;
    return Math.max(0.1, Math.min(1, pr));
  };

  // --- Keyboard ---
  useEffect(() => {
    const down = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space" && !e.repeat) setSpaceDown(true);
      if (e.altKey) setAltHeld(true);
      if (e.ctrlKey || e.metaKey) setCtrlHeld(true);
      if (e.shiftKey) setShiftHeld(true);
      if (e.key === "Delete" || e.key === "Backspace") {
        if (tool === "gradient") return;
        if (selTextFrameId) {
          e.preventDefault();
          const textFrames = (work.textFrames || []).filter((tf) => tf.id !== selTextFrameId);
          commitWork({ ...work, textFrames });
          setSelTextFrameId(null);
          return;
        }
        if (tool === "node" && selPoints.length) {
          e.preventDefault();
          const finalContours = [];
          work.contours.forEach((c, ci) => {
            const removed = selPoints.some((s) => s.contour === ci);
            const pts = c.points.filter((_, pi) => !selPoints.some((s) => s.contour === ci && s.point === pi));
            // Deleting a node opens the path contour at that location.
            if (pts.length >= 2) finalContours.push({ ...c, points: pts, closed: removed ? false : c.closed });
          });
          commitWork({ ...work, contours: finalContours });
          setSelPoints([]); setSelContours([]);
        } else if (tool === "node" && selSegments.length) {
          e.preventDefault();
          const finalContours = [];
          work.contours.forEach((c, ci) => {
            const segs = selSegments.filter((s) => s.contour === ci);
            if (!segs.length) { finalContours.push(c); return; }
            if (c.closed) {
              // Removing a segment from a closed path opens it at that point.
              const seg = segs[0].seg;
              finalContours.push({ ...c, closed: false, points: [...c.points.slice(seg + 1), ...c.points.slice(0, seg + 1)] });
            } else {
              // Removing a segment from an open path splits it into two sub-paths.
              const seg = segs[0].seg;
              const a = c.points.slice(0, seg + 1);
              const b = c.points.slice(seg + 1);
              if (a.length >= 2) finalContours.push({ ...c, closed: false, points: a });
              if (b.length >= 2) finalContours.push({ ...c, closed: false, points: b });
            }
          });
          commitWork({ ...work, contours: finalContours });
          setSelPoints([]); setSelSegments([]); setSelContours([]);
        } else if (selContours.length) {
          e.preventDefault();
          const contours = work.contours.filter((_, i) => !selContours.includes(i));
          commitWork({ ...work, contours });
          setSelContours([]); setSelPoints([]);
        }
      }
      if (e.key === "Enter" && penDraft) finishPen(false);
      if (e.key === "Escape") { if (penDraft) { setPenDraft(null); setWork(glyph); } setSelContours([]); setSelPoints([]); setSelSegments([]); setShapeDraft(null); setDrag(null); brushPtsRef.current = []; setBrushing(false); setMarquee(null); setPenHover(null); setSnapGuides([]); setSelCorners([]); setPenAddHit(null); }
      if ((tool === "select" || tool === "transform") && selContours.length && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = step;
        if (e.key === "ArrowDown") dy = -step;
        const contours = work.contours.map((c, i) => selContours.includes(i) ? transformContour(c, (x, y) => ({ x: x + dx, y: y + dy })) : c);
        commitWork({ ...work, contours });
      }
      if (tool === "node" && (selPoints.length || selSegments.length) && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = step;
        if (e.key === "ArrowDown") dy = -step;
        // Nudge selected anchor points (segment selection nudges their bounding anchors).
        const pointKeys = new Set();
        selPoints.forEach((s) => pointKeys.add(`${s.contour}:${s.point}`));
        selSegments.forEach((s) => { const n = work.contours[s.contour].points.length; pointKeys.add(`${s.contour}:${s.seg}`); pointKeys.add(`${s.contour}:${(s.seg + 1) % n}`); });
        const contours = work.contours.map((c, ci) => {
          const idxs = [];
          c.points.forEach((_, pi) => { if (pointKeys.has(`${ci}:${pi}`)) idxs.push(pi); });
          if (!idxs.length) return c;
          const pts = [...c.points];
          idxs.forEach((pi) => {
            const p = pts[pi];
            pts[pi] = {
              ...p, x: p.x + dx, y: p.y + dy,
              in: p.in ? { x: p.in.x + dx, y: p.in.y + dy } : null,
              out: p.out ? { x: p.out.x + dx, y: p.out.y + dy } : null,
            };
          });
          return { ...c, points: pts };
        });
        commitWork({ ...work, contours });
      }
      if (e.key === "R" && tool === "node" && selPoints.length) {
        e.preventDefault();
        const ci = selPoints[0].contour;
        const contours = work.contours.map((c, i) => (i === ci ? reverseContour(c) : c));
        commitWork({ ...work, contours });
      }
      if (drag?.type === "shape" && shapeDraft) {
        const t = shapeDraft.type;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const up = e.key === "ArrowUp";
          if (t === "rectangle" || t === "roundedRect") {
            const cur = shapeDraft.params.cornerRadius ?? 0;
            setShapeDraft({ ...shapeDraft, params: { ...shapeDraft.params, cornerRadius: Math.max(0, cur + (up ? 4 : -4)) } });
          } else if (t === "polygon") {
            const cur = shapeDraft.params.sides ?? 6;
            setShapeDraft({ ...shapeDraft, params: { ...shapeDraft.params, sides: Math.max(3, Math.min(64, cur + (up ? 1 : -1))) } });
          } else if (t === "star") {
            const cur = shapeDraft.params.points ?? 5;
            setShapeDraft({ ...shapeDraft, params: { ...shapeDraft.params, points: Math.max(3, Math.min(64, cur + (up ? 1 : -1))) } });
          }
          return;
        }
        if (e.key === "ArrowLeft" && (t === "rectangle" || t === "roundedRect")) { e.preventDefault(); setShapeDraft({ ...shapeDraft, params: { ...shapeDraft.params, cornerRadius: 0 } }); return; }
        if (e.key === "ArrowRight" && (t === "rectangle" || t === "roundedRect")) { e.preventDefault(); setShapeDraft({ ...shapeDraft, params: { ...shapeDraft.params, cornerRadius: 99999 } }); return; }
      }
      if (e.key === "B" && e.shiftKey && tool === "node" && selPoints.length === 1) {
        e.preventDefault();
        breakPath();
      }
    };
    const up = (e) => { if (e.code === "Space") setSpaceDown(false); if (!e.altKey) setAltHeld(false); if (!e.ctrlKey && !e.metaKey) setCtrlHeld(false); if (!e.shiftKey) setShiftHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [tool, work, penDraft, selContours, selPoints, drag, shapeDraft]);

  const finishPen = (close) => {
    if (!penDraft) return;
    const contours = [...work.contours];
    if (close && contours[penDraft.contourIdx]) {
      contours[penDraft.contourIdx] = { ...contours[penDraft.contourIdx], closed: true };
    }
    commitWork({ ...work, contours });
    if (close) setSelContours([penDraft.contourIdx]);
    setPenDraft(null);
  };

  // Resolved sub-contours for an entry: compounds expand to their boolean result
  // so hit testing, bounding boxes, and transforms see the real geometry.
  const resolvedSubContours = (ci) => {
    const c = work.contours[ci];
    if (!c) return [];
    if (c.compound) return expandCompounds([c]);
    return [c];
  };

  // --- Hit testing ---
  const hitTestPoint = (fp) => {
    const thr = NODE_HIT / zoom;
    for (let ci = work.contours.length - 1; ci >= 0; ci--) {
      const c = work.contours[ci];
      if (c.locked) continue;
      for (let pi = 0; pi < c.points.length; pi++) {
        if (dist(fp, c.points[pi]) < thr) return { contour: ci, point: pi };
      }
    }
    return null;
  };
  const hitTestHandle = (fp) => {
    const thr = HANDLE_HIT / zoom;
    for (let ci = work.contours.length - 1; ci >= 0; ci--) {
      const c = work.contours[ci];
      if (c.locked) continue;
      for (let pi = 0; pi < c.points.length; pi++) {
        const p = c.points[pi];
        if (p.out && dist(fp, p.out) < thr) return { contour: ci, point: pi, handle: "out" };
        if (p.in && dist(fp, p.in) < thr) return { contour: ci, point: pi, handle: "in" };
      }
    }
    return null;
  };
  const hitTestEndpoint = (fp) => {
    const thr = NODE_HIT / zoom;
    for (let ci = work.contours.length - 1; ci >= 0; ci--) {
      const c = work.contours[ci];
      if (c.locked || c.closed || c.points.length === 0) continue;
      if (dist(fp, c.points[0]) < thr) return { contour: ci, end: "start", point: 0 };
      if (c.points.length > 1 && dist(fp, c.points[c.points.length - 1]) < thr) return { contour: ci, end: "end", point: c.points.length - 1 };
    }
    return null;
  };
  const hitTestContour = (fp) => {
    for (let ci = work.contours.length - 1; ci >= 0; ci--) {
      if (work.contours[ci].locked || work.contours[ci].hidden) continue;
      for (const sub of resolvedSubContours(ci)) {
        const poly = flattenContour(sub, 8);
        if (poly.length >= 3 && pointInPolygon(fp, poly)) return ci;
      }
    }
    return -1;
  };
  const hitTestSegment = (fp) => {
    const thr = SEG_HIT / zoom;
    let best = null, bestD = thr;
    work.contours.forEach((c, ci) => {
      if (c.locked) return;
      const n = c.points.length;
      const segCount = c.closed ? n : n - 1;
      for (let i = 0; i < segCount; i++) {
        const a = c.points[i], b = c.points[(i + 1) % n];
        const curved = !!(a.out || b.in);
        const steps = curved ? 24 : 1;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const p = curved ? bezPoint(a, a.out || a, b.in || b, b, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          const d = dist(fp, p);
          if (d < bestD) { bestD = d; best = { contour: ci, seg: i, t, curved }; }
        }
      }
    });
    return best;
  };
  const insertNode = (hit) => {
    const c = work.contours[hit.contour];
    const n = c.points.length;
    const i = hit.seg;
    const a = c.points[i], b = c.points[(i + 1) % n];
    const pts = [...c.points];
    if (hit.curved) {
      const sp = cubicSplit(a, a.out || a, b.in || b, b, hit.t);
      pts[i] = { ...a, out: sp.leftOut };
      pts[(i + 1) % n] = { ...b, in: sp.rightIn };
      pts.splice(i + 1, 0, { x: sp.point.x, y: sp.point.y, in: sp.newIn, out: sp.newOut, type: "smooth" });
    } else {
      pts.splice(i + 1, 0, { x: a.x + (b.x - a.x) * hit.t, y: a.y + (b.y - a.y) * hit.t, in: null, out: null, type: "corner" });
    }
    const contours = [...work.contours];
    contours[hit.contour] = convertToPath({ ...c, points: pts });
    commitWork({ ...work, contours });
    setSelPoints([{ contour: hit.contour, point: i + 1 }]);
    setSelContours([hit.contour]);
  };
  // Remove an anchor and weld neighboring segments (neighbor Bézier handles preserved).
  const deleteAnchor = (ap) => {
    const finalContours = [];
    work.contours.forEach((c, ci) => {
      if (ci !== ap.contour) { finalContours.push(c); return; }
      const pts = c.points.filter((_, pi) => pi !== ap.point);
      if (pts.length >= 2) finalContours.push(convertToPath({ ...c, points: pts }));
    });
    commitWork({ ...work, contours: finalContours });
  };

  // Convert an anchor to corner (sharp) or smooth — used by the Vector Tool
  // sub-modes and the Alt/Ctrl+Alt convert drag. Smooth generates symmetric
  // handles from the neighboring anchors so the curve actually bends;
  // corner strips the handles.
  const setAnchorType = (ap, type) => {
    if (!ap) return;
    const c = work.contours[ap.contour];
    if (!c) return;
    const pts = [...c.points];
    const p = { ...pts[ap.point] };
    if (type === "corner") {
      p.type = "corner"; p.in = null; p.out = null;
    } else {
      const n = c.points.length;
      const prevIdx = c.closed ? (ap.point - 1 + n) % n : Math.max(0, ap.point - 1);
      const nextIdx = c.closed ? (ap.point + 1) % n : Math.min(n - 1, ap.point + 1);
      const prev = c.points[prevIdx], next = c.points[nextIdx];
      const dx = (next.x - prev.x) * 0.3, dy = (next.y - prev.y) * 0.3;
      p.type = "smooth";
      p.out = { x: p.x + dx, y: p.y + dy };
      p.in = { x: p.x - dx, y: p.y - dy };
    }
    pts[ap.point] = p;
    commitWork({ ...work, contours: work.contours.map((cc, i) => (i === ap.contour ? convertToPath({ ...cc, points: pts }) : cc)) });
    setSelPoints([ap]); setSelContours([ap.contour]);
  };

  // Distance from a point to a contour's outline (used for stroke-aware hit testing).
  const distToContour = (fp, c) => {
    const n = c.points.length;
    if (!n) return Infinity;
    const segCount = c.closed ? n : n - 1;
    let best = Infinity;
    for (let i = 0; i < segCount; i++) {
      const a = c.points[i], b = c.points[(i + 1) % n];
      const curved = !!(a.out || b.in);
      const steps = curved ? 24 : 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const p = curved ? bezPoint(a, a.out || a, b.in || b, b, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        best = Math.min(best, dist(fp, p));
      }
    }
    return best;
  };

  // Point on a segment at hit.t (Bézier-aware) — used to render the Add-Anchor hover marker.
  const pointOnSeg = (hit) => {
    const c = work.contours[hit.contour];
    if (!c) return null;
    const n = c.points.length;
    const a = c.points[hit.seg], b = c.points[(hit.seg + 1) % n];
    if (hit.curved) return bezPoint(a, a.out || a, b.in || b, b, hit.t);
    return { x: a.x + (b.x - a.x) * hit.t, y: a.y + (b.y - a.y) * hit.t };
  };
  // Add Anchor Point target: works on any path without pre-selection. Hits a
  // segment first, then the filled contour, then the nearest outline within a
  // tolerance (open / stroked paths).
  const penAddTarget = (fp) => {
    let seg = hitTestSegment(fp);
    if (!seg) {
      const ci = hitTestContour(fp);
      if (ci >= 0) seg = nearestPointOnContour(fp, ci);
      else {
        const tol = 8 / zoom;
        let best = null, bestD = tol;
        for (let i = 0; i < work.contours.length; i++) {
          const c = work.contours[i];
          if (c.locked || c.hidden) continue;
          const d = distToContour(fp, c);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best != null) seg = nearestPointOnContour(fp, best);
      }
    }
    return seg;
  };

  // All contours under a point, topmost first (fill OR stroke hit). Locked/hidden skipped.
  const hitTestContourStack = (fp) => {
    const hits = [];
    const tol = 6 / zoom;
    for (let ci = work.contours.length - 1; ci >= 0; ci--) {
      const c = work.contours[ci];
      if (c.locked || c.hidden) continue;
      let touched = false;
      for (const sub of resolvedSubContours(ci)) {
        const poly = flattenContour(sub, 8);
        if (poly.length >= 3 && pointInPolygon(fp, poly)) { touched = true; break; }
      }
      if (!touched) {
        for (const sub of resolvedSubContours(ci)) {
          const sw = (sub.appearance?.strokeWidth || 0) / 2;
          if (distToContour(fp, sub) <= tol + sw) { touched = true; break; }
        }
      }
      if (touched) hits.push(ci);
    }
    return hits;
  };

  // Hit test a member sub-shape within the selected compound (Direct Selection).
  const hitTestCompoundMember = (fp) => {
    const ci = selContours[0];
    const c = ci != null ? work.contours[ci] : null;
    if (!c || !c.compound) return null;
    for (let mi = c.compound.members.length - 1; mi >= 0; mi--) {
      const m = c.compound.members[mi];
      if (m.hidden) continue;
      const poly = flattenContour(m, 8);
      if (poly.length >= 3 && pointInPolygon(fp, poly)) return mi;
    }
    return null;
  };

  const distToRect = (p, bb) => {
    const dx = Math.max(bb.minX - p.x, 0, p.x - bb.maxX);
    const dy = Math.max(bb.minY - p.y, 0, p.y - bb.maxY);
    return Math.hypot(dx, dy);
  };

  // Bounding-box handle hit testing: 8 resize handles + an outer rotate zone.
  const hitTestBBoxHandle = (fp, bb) => {
    const thr = NODE_HIT / zoom;
    const midX = (bb.minX + bb.maxX) / 2, midY = (bb.minY + bb.maxY) / 2;
    const handles = [
      { id: "nw", p: { x: bb.minX, y: bb.maxY } }, { id: "n", p: { x: midX, y: bb.maxY } }, { id: "ne", p: { x: bb.maxX, y: bb.maxY } },
      { id: "e", p: { x: bb.maxX, y: midY } }, { id: "se", p: { x: bb.maxX, y: bb.minY } }, { id: "s", p: { x: midX, y: bb.minY } },
      { id: "sw", p: { x: bb.minX, y: bb.minY } }, { id: "w", p: { x: bb.minX, y: midY } },
    ];
    for (const h of handles) if (dist(fp, h.p) < thr) return h.id;
    // Rotación estilo Illustrator: hover justo fuera de una esquina (más allá
    // del handle de resize) activa el cursor de rotación. La zona es un anillo
    // alrededor de cada esquina, restringido al exterior del cuadro para que
    // los clics en el interior sigan siendo de mover.
    const rotThr = 18 / zoom;
    const corners = [
      { x: bb.minX, y: bb.maxY }, { x: bb.maxX, y: bb.maxY },
      { x: bb.maxX, y: bb.minY }, { x: bb.minX, y: bb.minY },
    ];
    const outside = fp.x < bb.minX || fp.x > bb.maxX || fp.y < bb.minY || fp.y > bb.maxY;
    if (outside) {
      for (const c of corners) {
        const d = dist(fp, c);
        if (d > thr && d <= rotThr) return "rotate";
      }
    }
    return null;
  };

  // Duplicate a set of contours (returns new indices); local work only — committed on drag end.
  const duplicateContours = (indices) => {
    const contours = [...work.contours];
    const newIdxs = [];
    indices.forEach((i) => {
      contours.push(JSON.parse(JSON.stringify(work.contours[i])));
      newIdxs.push(contours.length - 1);
    });
    setWork({ ...work, contours });
    return newIdxs;
  };

  // Find the nearest point on a specific contour's outline (no threshold).
  const nearestPointOnContour = (fp, ci) => {
    const c = work.contours[ci];
    if (!c) return null;
    const n = c.points.length;
    const segCount = c.closed ? n : n - 1;
    let best = null, bestD = Infinity;
    for (let i = 0; i < segCount; i++) {
      const a = c.points[i], b = c.points[(i + 1) % n];
      const curved = !!(a.out || b.in);
      const steps = curved ? 24 : 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const p = curved ? bezPoint(a, a.out || a, b.in || b, b, t) : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const d = dist(fp, p);
        if (d < bestD) { bestD = d; best = { contour: ci, seg: i, t, curved }; }
      }
    }
    return best;
  };

  // Break/cut a path at the selected anchor (Node tool: Shift+B).
  const breakPath = () => {
    const sp = selPoints[0];
    if (!sp) return;
    const c = work.contours[sp.contour];
    if (!c) return;
    const contours = work.contours.filter((_, i) => i !== sp.contour);
    if (c.closed) {
      const pts = [...c.points.slice(sp.point), ...c.points.slice(0, sp.point)];
      contours.splice(sp.contour, 0, { ...c, closed: false, points: pts });
    } else {
      const a = c.points.slice(0, sp.point + 1);
      const b = c.points.slice(sp.point);
      if (a.length > 1) contours.splice(sp.contour, 0, { ...c, closed: false, points: a });
      if (b.length > 1) contours.splice(sp.contour, 0, { ...c, closed: false, points: b });
    }
    commitWork({ ...work, contours });
    setSelPoints([]); setSelContours([]);
  };

  // ---------- Live Corners & Contextual Control Bar operations ----------
  const convertSelected = (toSmooth) => {
    const contours = work.contours.map((c, ci) => {
      const items = selPoints.filter((s) => s.contour === ci);
      if (!items.length) return c;
      const pts = [...c.points];
      items.forEach((s) => {
        const p = { ...pts[s.point] };
        if (toSmooth) {
          p.type = "smooth";
          const n = c.points.length;
          const prev = c.points[(s.point - 1 + n) % n], next = c.points[(s.point + 1) % n];
          const dx = (next.x - prev.x) * 0.3, dy = (next.y - prev.y) * 0.3;
          p.out = { x: p.x + dx, y: p.y + dy };
          p.in = { x: p.x - dx, y: p.y - dy };
        } else {
          // Convert to Sharp: strip Bézier handles, reset live-corner radius, force corner.
          p.type = "corner"; p.in = null; p.out = null; p.r = 0; p.ct = undefined;
        }
        pts[s.point] = p;
      });
      return { ...c, points: pts };
    });
    commitWork({ ...work, contours });
  };
  const removeSelectedPoints = () => {
    const finalContours = [];
    work.contours.forEach((c, ci) => {
      const pts = c.points.filter((_, pi) => !selPoints.some((s) => s.contour === ci && s.point === pi));
      if (pts.length >= 2) finalContours.push({ ...c, points: pts });
    });
    commitWork({ ...work, contours: finalContours });
    setSelPoints([]); setSelContours([]);
  };
  const addAnchorOnSegment = () => { if (selSegments.length) insertNode(selSegments[0]); };
  // Determine if a contour is a hole (inside an odd number of other contours)
  // using the even-odd rule — needed for correct corner-widget material side.
  const computeIsHole = (ci) => {
    const c = work.contours[ci];
    if (!c || !c.points || c.points.length < 3) return false;
    const testPoint = c.points[0];
    let inside = 0;
    for (let j = 0; j < work.contours.length; j++) {
      if (j === ci) continue;
      const other = work.contours[j];
      if (!other || !other.points || other.points.length < 3) continue;
      if (pointInPolygon(testPoint, other.points)) inside++;
    }
    return inside % 2 === 1;
  };
  const setCornersRadius = (r) => {
    const corners = selCorners.length
      ? selCorners
      : selPoints.map((s) => ({ ci: s.contour, pi: s.point }));
    const contours = work.contours.map((c, ci) => {
      const hole = computeIsHole(ci);
      const items = corners.filter((s) => s.ci === ci && cornerInfo(c, s.pi, hole));
      if (!items.length) return c;
      const pts = [...c.points];
      items.forEach((s) => { pts[s.pi] = { ...pts[s.pi], r: Math.max(0, r) }; });
      return { ...c, points: pts };
    });
    commitWork({ ...work, contours });
  };
  const toggleHandles = (show) => {
    const contours = work.contours.map((c, ci) => {
      const items = selPoints.filter((s) => s.contour === ci);
      if (!items.length) return c;
      const pts = [...c.points];
      items.forEach((s) => { pts[s.point] = { ...pts[s.point], hideHandles: !show }; });
      return { ...c, points: pts };
    });
    commitWork({ ...work, contours });
  };
  const hitTestCornerWidget = (fp) => {
    const offsetFont = 16 / zoom;
    const candidates = [];
    if (tool === "node") {
      if (selPoints.length) selPoints.forEach((s) => candidates.push({ ci: s.contour, pi: s.point, individual: false }));
      else selContours.forEach((ci) => { const c = work.contours[ci]; if (!c || c.isBrush) return; c.points.forEach((_, pi) => candidates.push({ ci, pi, individual: false })); });
    }
    else if (tool === "select" || tool === "transform") selContours.forEach((ci) => { const c = work.contours[ci]; if (!c || c.isBrush) return; c.points.forEach((_, pi) => candidates.push({ ci, pi, individual: false })); });
    for (const cand of candidates) {
      const pt0 = work.contours[cand.ci]?.points[cand.pi];
      if (pt0 && pt0.r && pt0.r > 0) continue; // already rounded — no widget
      const info = cornerInfo(work.contours[cand.ci], cand.pi, computeIsHole(cand.ci));
      if (!info) continue;
      const pt = work.contours[cand.ci].points[cand.pi];
      const r = pt.r || 0;
      const wpos = { x: pt.x + info.bisector.x * (r + offsetFont), y: pt.y + info.bisector.y * (r + offsetFont) };
      if (dist(fp, wpos) < 8 / zoom) return cand;
    }
    return null;
  };
  const startCornerDrag = (hit, explicitSet) => {
    const offsetFont = 16 / zoom;
    let set;
    if (explicitSet) {
      set = explicitSet;
    } else if (tool === "node") {
      set = selPoints.map((s) => ({ ci: s.contour, pi: s.point })).filter((s) => cornerInfo(work.contours[s.ci], s.pi, computeIsHole(s.ci)));
      if (!set.length && selContours.length) {
        selContours.forEach((ci) => { const c = work.contours[ci]; if (!c) return; const h = computeIsHole(ci); c.points.forEach((_, pi) => { if (cornerInfo(c, pi, h)) set.push({ ci, pi }); }); });
      }
      if (!set.length) set = [{ ci: hit.ci, pi: hit.pi }];
    } else {
      set = [];
      selContours.forEach((ci) => { const c = work.contours[ci]; if (!c) return; const h = computeIsHole(ci); c.points.forEach((_, pi) => { if (cornerInfo(c, pi, h)) set.push({ ci, pi }); }); });
    }
    const pInfo = cornerInfo(work.contours[hit.ci], hit.pi, computeIsHole(hit.ci));
    if (!pInfo) return;
    setDrag({ type: "corner", set, bisector: pInfo.bisector, P: { ...work.contours[hit.ci].points[hit.pi] }, offsetFont });
  };
  const renderCornerWidgets = () => {
    const items = [];
    const offsetFont = 16 / zoom;
    const add = (ci, pi) => {
      const c = work.contours[ci]; if (!c || c.isBrush) return;
      const pt0 = c.points[pi];
      if (pt0 && pt0.r && pt0.r > 0) return; // already rounded — no widget
      const info = cornerInfo(c, pi, computeIsHole(ci)); if (!info) return;
      const pt = c.points[pi];
      const r = pt.r || 0;
      const wpos = { x: pt.x + info.bisector.x * (r + offsetFont), y: pt.y + info.bisector.y * (r + offsetFont) };
      const s = toScreen(wpos);
      const targeted = selCorners.some((cc) => cc.ci === ci && cc.pi === pi);
      items.push(
        <g key={`cw${ci}-${pi}`} className="cursor-pointer">
          <circle cx={s.x} cy={s.y} r={6} fill="none" stroke="#0ea5e9" strokeWidth={1.5} opacity={0.9} />
          {targeted && <circle cx={s.x} cy={s.y} r={3} fill="#0ea5e9" />}
        </g>
      );
    };
    if (tool === "node") {
      if (selPoints.length) selPoints.forEach((p) => add(p.contour, p.point));
      else selContours.forEach((ci) => work.contours[ci]?.points.forEach((_, pi) => add(ci, pi)));
    }
    else if (tool === "select" || tool === "transform") selContours.forEach((ci) => work.contours[ci]?.points.forEach((_, pi) => add(ci, pi)));
    return items;
  };
  const currentCornerRadius = () => {
    for (const c of selCorners) { const p = work.contours[c.ci]?.points[c.pi]; if (p && p.r) return Math.round(p.r); }
    for (const s of selPoints) { const p = work.contours[s.contour]?.points[s.point]; if (p && p.r) return Math.round(p.r); }
    return 0;
  };
  const hasHandlesVisible = () => selPoints.length > 0 && selPoints.every((s) => !work.contours[s.contour]?.points[s.point]?.hideHandles);

  // Transform bbox of selected contours
  const selBBox = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let has = false;
    selContours.forEach((ci) => {
      if (!work.contours[ci]) return;
      for (const sub of resolvedSubContours(ci)) {
        const b = contourBounds(sub);
        if (!b) continue;
        has = true;
        minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
      }
    });
    return has ? { minX, minY, maxX, maxY } : null;
  };

  const hitTestTextFrame = (fp) => {
    for (let i = (work.textFrames || []).length - 1; i >= 0; i--) {
      const f = work.textFrames[i];
      const b = textFrameBounds(f, metrics, loadedFonts, glyphs);
      if (b && fp.x >= b.minX && fp.x <= b.maxX && fp.y >= b.minY && fp.y <= b.maxY) return f;
    }
    return null;
  };

  const onDown = (e) => {
    const drag = dragRef.current;
    const work = workRef.current;
    // Capture the pointer so drags (shape, marquee, pen, etc.) keep receiving
    // move/up events even if the cursor leaves the SVG — otherwise onPointerLeave
    // aborts the drag mid-stroke and nothing gets committed.
    if (e.pointerId != null && svgRef.current && e.button !== 1) {
      try { svgRef.current.setPointerCapture(e.pointerId); } catch {}
    }
    if (e.button === 1 || spaceDown || tool === "hand") {
      setDrag({ type: "pan", startX: e.clientX - pan.x, startY: e.clientY - pan.y });
      return;
    }
    if (tool === "zoom") {
      const r = svgRef.current.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.altKey ? 1 / 1.3 : 1.3);
      return;
    }
    const fp = getMouse(e);

    if (tool === "eyedropper") {
      const ci = hitTestContour(fp);
      if (ci >= 0) {
        const fill = work.contours[ci].appearance?.fill ?? "#000000";
        const targets = selContours.length ? selContours : [ci];
        const contours = work.contours.map((cc, i) => (targets.includes(i) ? setAppearance(cc, { fill, fillOpacity: 1 }) : cc));
        commitWork({ ...work, contours });
        if (!selContours.length) setSelContours([ci]);
      }
      return;
    }

    if (tool === "gradient") {
      const ci = hitTestContour(fp);
      if (ci >= 0) {
        if (selContours.length !== 1 || selContours[0] !== ci) setSelContours([ci]);
        setSelPoints([]); setSelSegments([]); setSelCorners([]); setSelTextFrameId(null);
        const existing = work.contours[ci].appearance?.fill;
        setDrag({ type: "gradientDraw", ci, start: fp, end: fp, existing });
      }
      return;
    }

    // Type Tool: click a frame to edit, click empty to create point text, drag for area text.
    if (tool === "type") {
      const hit = hitTestTextFrame(fp);
      if (hit) {
        setSelContours([]);
        if (hit.locked) { setSelTextFrameId(hit.id); setEditingTextFrameId(null); return; }
        setSelTextFrameId(hit.id);
        setEditingTextFrameId(hit.id);
        return;
      }
      setDrag({ type: "textCreate", start: fp, moved: false });
      return;
    }

    // Sub-selection bbox: scale/rotate a group of selected anchors (Direct Selection §26).
    if (tool === "node" && selPoints.length > 1) {
      const subDrag = startSubSelectionDrag(fp, work.contours, selPoints, hitTestBBoxHandle);
      if (subDrag) { setDrag(subDrag); return; }
    }

    // Live Corner widgets: A tool = click+drag rounds ALL corners of selected path;
    // Shift+click multi-targets individual corners; double-click = single corner dialog.
    // V tool = drag rounds ALL corners of selected objects.
    // The widget sits inside the shape along the inward bisector, so it must be
    // hit-tested unconditionally — a click on the widget should round, not move.
    if ((tool === "node" && (selPoints.length || selContours.length)) || ((tool === "select" || tool === "transform") && selContours.length)) {
      const w = hitTestCornerWidget(fp);
      if (w) {
        if (tool === "node") {
          if (e.shiftKey) {
            const exists = selCorners.some((c) => c.ci === w.ci && c.pi === w.pi);
            if (exists) { setSelCorners(selCorners.filter((c) => !(c.ci === w.ci && c.pi === w.pi))); return; }
            const newCorners = [...selCorners, { ci: w.ci, pi: w.pi }];
            setSelCorners(newCorners);
            startCornerDrag(w, newCorners.filter((c) => cornerInfo(work.contours[c.ci], c.pi)));
            return;
          }
          // Default: drag rounds ALL corners of the selected path
          setSelCorners([]);
          startCornerDrag(w);
          return;
        }
        startCornerDrag(w);
        return;
      }
    }

    if (tool === "pen") {
      penAltUsed.current = false;
      const contours = [...work.contours];

      // Sub-modes (Sharp / Smooth / Delete) override the full Vector Tool:
      // a click applies just that one action to the anchor under the cursor.
      if (subMode === "sharp" || subMode === "smooth" || subMode === "delete") {
        const ap = hitTestPoint(fp);
        if (ap) {
          if (subMode === "delete") { deleteAnchor(ap); setSelPoints([]); }
          else { setAnchorType(ap, subMode === "sharp" ? "corner" : "smooth"); }
          return;
        }
        setSelContours([]); setSelPoints([]);
        return;
      }

      // Direct sub-mode: grab a Bézier handle to move it independently, or grab
      // an anchor to reposition it. Lets you shape the levers that appear after
      // smoothing. (Same as holding Ctrl/Cmd in the default Vector Tool.)
      if (subMode === "direct") {
        const h = hitTestHandle(fp);
        if (h) {
          setSelPoints([{ contour: h.contour, point: h.point }]);
          setSelContours([h.contour]);
          setSelSegments([]); setSelCorners([]);
          setDrag({ type: "handle", ...h, last: fp, altBreak: false });
          return;
        }
        const ap = hitTestPoint(fp);
        if (ap) {
          setSelPoints([ap]); setSelContours([ap.contour]);
          const origPts = [{ ...work.contours[ap.contour].points[ap.point], ci: ap.contour, pi: ap.point }];
          setDrag({ type: "points", start: fp, origPts, primary: ap, snap: true });
          return;
        }
        setPenDraft(null); setSelContours([]); setSelPoints([]);
        return;
      }

      // Curve Handle sub-mode: drag a single lever — only the grabbed handle
      // moves, the opposite handle stays put and the point becomes a corner,
      // so one side can curve while the other stays sharp.
      if (subMode === "curveHandle") {
        const h = hitTestHandle(fp);
        if (h) {
          setSelPoints([{ contour: h.contour, point: h.point }]);
          setSelContours([h.contour]);
          setSelSegments([]); setSelCorners([]);
          setDrag({ type: "handle", ...h, last: fp, altBreak: false, single: true });
          return;
        }
        const ap = hitTestPoint(fp);
        if (ap) {
          setSelPoints([ap]); setSelContours([ap.contour]);
          const origPts = [{ ...work.contours[ap.contour].points[ap.point], ci: ap.contour, pi: ap.point }];
          setDrag({ type: "points", start: fp, origPts, primary: ap, snap: true });
          return;
        }
        setPenDraft(null); setSelContours([]); setSelPoints([]);
        return;
      }

      // Alt/Option over an anchor = Convert Anchor Point.
      // Alt+drag pulls smooth handles; Ctrl+Alt+drag (or click) sharpens to a corner.
      // Checked before the Ctrl/move branch so Ctrl+Alt triggers convert, not move.
      if (e.altKey) {
        const ap = hitTestPoint(fp);
        if (ap) {
          setSelPoints([ap]); setSelContours([ap.contour]);
          setDrag({ type: "penConvert", contour: ap.contour, point: ap.point, start: fp, sharp: !!(e.ctrlKey || e.metaKey) });
          return;
        }
      }

      // Ctrl/Cmd = temporary Direct Selection: drag a handle or an anchor to
      // move it, or deselect on empty. Hold Alt while dragging a handle to
      // break its symmetry (move just that lever).
      if (e.ctrlKey || e.metaKey) {
        const h = hitTestHandle(fp);
        if (h) {
          setSelPoints([{ contour: h.contour, point: h.point }]);
          setSelContours([h.contour]);
          setSelSegments([]); setSelCorners([]);
          setDrag({ type: "handle", ...h, last: fp, altBreak: false });
          return;
        }
        const ap = hitTestPoint(fp);
        if (ap) {
          setSelPoints([ap]); setSelContours([ap.contour]);
          const origPts = [{ ...work.contours[ap.contour].points[ap.point], ci: ap.contour, pi: ap.point }];
          setDrag({ type: "points", start: fp, origPts, primary: ap, snap: true });
          return;
        }
        setPenDraft(null); setSelContours([]); return;
      }

      // Auto Add/Delete (suppressed by Shift, or when the preference is off).
      const autoAD = autoAddDelete && !e.shiftKey;
      if (autoAD && penHover?.type === "anchor") {
        const ap = hitTestPoint(fp);
        if (ap) { deleteAnchor(ap); return; }
      }
      if (autoAD && penHover?.type === "segment") {
        const seg = hitTestSegment(fp);
        if (seg) { insertNode(seg); return; }
      }

      const ep = hitTestEndpoint(fp);

      if (!penDraft) {
        if (ep) {
          // Continue an existing open path from this endpoint.
          setPenDraft({ contourIdx: ep.contour, continueEnd: ep.end, dragging: false });
          setSelContours([ep.contour]);
          return;
        }
        contours.push({ closed: false, points: [{ x: fp.x, y: fp.y, in: null, out: null, type: "corner" }] });
        setWork({ ...work, contours });
        setPenDraft({ contourIdx: contours.length - 1, continueEnd: "end", dragging: true, start: fp });
        return;
      }

      const ci = penDraft.contourIdx;
      const c = contours[ci];
      if (!c) {
        // Stale draft (contour removed by undo/etc.) — start a fresh path.
        contours.push({ closed: false, points: [{ x: fp.x, y: fp.y, in: null, out: null, type: "corner" }] });
        setWork({ ...work, contours });
        setPenDraft({ contourIdx: contours.length - 1, continueEnd: "end", dragging: true, start: fp });
        return;
      }

      if (ep) {
        if (ep.contour === ci) {
          const isCloseTarget = (penDraft.continueEnd === "end" && ep.end === "start") || (penDraft.continueEnd === "start" && ep.end === "end");
          if (isCloseTarget && c.points.length > 1) { finishPen(true); return; }
          return; // clicked the active end — no-op
        }
        // Join a different open path: merge the other contour into the current draft.
        const other = work.contours[ep.contour];
        let merged;
        if (penDraft.continueEnd === "end") {
          merged = ep.end === "start" ? [...c.points, ...other.points] : [...c.points, ...other.points.slice().reverse()];
        } else {
          merged = ep.end === "end" ? [...other.points, ...c.points] : [...other.points.slice().reverse(), ...c.points];
        }
        const newContours = work.contours.map((cc, i) => (i === ci ? { ...c, points: merged } : i === ep.contour ? null : cc)).filter(Boolean);
        commitWork({ ...work, contours: newContours });
        setPenDraft(null);
        setSelContours([]);
        return;
      }

      // Append / prepend a new anchor point. Shift constrains the segment angle to 45°.
      let nx = fp.x, ny = fp.y;
      if (e.shiftKey && c.points.length >= 1) {
        const ref = penDraft.continueEnd === "start" ? c.points[0] : c.points[c.points.length - 1];
        const ang = Math.atan2(ny - ref.y, nx - ref.x);
        const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(nx - ref.x, ny - ref.y);
        nx = ref.x + Math.cos(snap) * len;
        ny = ref.y + Math.sin(snap) * len;
      }
      const newPoint = { x: nx, y: ny, in: null, out: null, type: "corner" };
      if (penDraft.continueEnd === "start") {
        contours[ci] = { ...c, points: [newPoint, ...c.points] };
      } else {
        contours[ci] = { ...c, points: [...c.points, newPoint] };
      }
      setWork({ ...work, contours });
      setPenDraft({ ...penDraft, dragging: true, start: fp });
      return;
    }

    if (tool === "penAdd") {
      const seg = penAddTarget(fp);
      if (seg) insertNode(seg);
      return;
    }

    if (tool === "penDelete") {
      const p = hitTestPoint(fp);
      if (p) {
        const finalContours = [];
        work.contours.forEach((c, ci) => {
          if (ci !== p.contour) { finalContours.push(c); return; }
          const pts = c.points.filter((_, pi) => pi !== p.point);
          if (pts.length >= 2) finalContours.push({ ...c, points: pts });
        });
        commitWork({ ...work, contours: finalContours });
        setSelPoints([]); setSelContours([]);
      }
      return;
    }

    if (tool === "penConvert") {
      const h = hitTestPoint(fp);
      if (h) {
        setSelPoints([h]); setSelContours([h.contour]);
        setDrag({ type: "penConvert", contour: h.contour, point: h.point, start: fp, sharp: e.ctrlKey || e.metaKey });
      }
      return;
    }

    if (tool === "pencil") {
      const contours = [...work.contours, { closed: false, points: [{ x: fp.x, y: fp.y, in: null, out: null, type: "corner" }] }];
      setWork({ ...work, contours });
      setDrag({ type: "pencil", contourIdx: contours.length - 1, last: fp });
      return;
    }

    if (tool === "brush" || tool === "wetbrush") {
      brushPtsRef.current = [{ x: fp.x, y: fp.y, p: pressureOf(e) }];
      setBrushing(true);
      if (previewRef.current) { previewRef.current.setAttribute("d", brushFootprintPath(brushPtsRef.current, brushSize, zoom, toScreen)); }
      setDrag({ type: tool === "wetbrush" ? "wetbrush" : "brush", last: fp });
      return;
    }

    if (tool === "node") {
      // Compound sub-shape selection: click a member to select & drag it live.
      if (selContours.length === 1 && work.contours[selContours[0]]?.compound) {
        const mi = hitTestCompoundMember(fp);
        if (mi != null) {
          setSelCompoundMember(mi);
          const member = work.contours[selContours[0]].compound.members[mi];
          const origPts = member.points.map((p) => ({ ...p }));
          setDrag({ type: "compoundMember", ci: selContours[0], mi, start: fp, origPts });
          return;
        }
      }
      // 1) Bézier handle
      const h = hitTestHandle(fp);
      if (h) {
        setSelPoints([{ contour: h.contour, point: h.point }]);
        setSelContours([h.contour]);
        setSelSegments([]);
        setSelCorners([]);
        setDrag({ type: "handle", ...h, last: fp, altBreak: false });
        return;
      }
      // 2) Anchor point
      const p = hitTestPoint(fp);
      if (p) {
        let next;
        if (e.shiftKey) {
          const exists = selPoints.some((s) => s.contour === p.contour && s.point === p.point);
          next = exists ? selPoints.filter((s) => !(s.contour === p.contour && s.point === p.point)) : [...selPoints, p];
        } else next = [p];
        setSelPoints(next);
        setSelContours([...new Set(next.map((s) => s.contour))]);
        setSelSegments([]);
        setSelCorners([]);
        if (next.some((s) => s.contour === p.contour && s.point === p.point)) {
          const origPts = next.map((s) => ({ ...work.contours[s.contour].points[s.point], ci: s.contour, pi: s.point }));
          setDrag({ type: "points", start: fp, origPts, primary: p, snap: true });
        }
        return;
      }
      // 3) Path segment
      const seg = hitTestSegment(fp);
      if (seg) {
        const key = `${seg.contour}:${seg.seg}`;
        let nextSegs;
        if (e.shiftKey) {
          const exists = selSegments.some((s) => `${s.contour}:${s.seg}` === key);
          nextSegs = exists ? selSegments.filter((s) => `${s.contour}:${s.seg}` !== key) : [...selSegments, seg];
        } else nextSegs = [seg];
        setSelSegments(nextSegs);
        setSelContours([...new Set(nextSegs.map((s) => s.contour))]);
        if (!e.shiftKey) setSelPoints([]);
        setSelCorners([]);
        if (nextSegs.some((s) => s.contour === seg.contour && s.seg === seg.seg)) setDrag({ type: "segment", segments: nextSegs, last: fp });
        return;
      }
      // 4) Filled area
      const ci = hitTestContour(fp);
      if (ci >= 0) {
        // Alt+drag duplicate: clone the clicked (or already-selected) contour(s)
        // and drag the copy — same behavior as the Selection Tool.
        if (e.altKey) {
          const base = selContours.includes(ci) && selContours.length > 1 ? selContours : [ci];
          const dup = duplicateContours(base);
          setSelContours(dup);
          setSelPoints([]); setSelSegments([]); setSelCorners([]);
          setDrag({ type: "move", contours: dup, last: fp });
          return;
        }
        if (work.contours[ci].liveShape) {
          // Live shape: select contour and move parametrically (no per-point editing).
          if (e.shiftKey) {
            const next = selContours.includes(ci) ? selContours.filter((x) => x !== ci) : [...selContours, ci];
            setSelContours(next);
          } else {
            setSelContours([ci]); setSelPoints([]); setSelSegments([]); setSelCorners([]);
            setDrag({ type: "move", contours: [ci], last: fp });
          }
          return;
        }
        const allPts = work.contours[ci].points.map((_, pi) => ({ contour: ci, point: pi }));
        if (e.shiftKey) {
          const merged = [...selPoints, ...allPts];
          const dedup = merged.filter((s, idx) => !merged.slice(0, idx).some((t) => t.contour === s.contour && t.point === s.point));
          setSelPoints(dedup);
          setSelContours([...new Set(dedup.map((s) => s.contour))]);
        } else {
          const origPts = allPts.map((s) => ({ ...work.contours[s.contour].points[s.point], ci: s.contour, pi: s.point }));
          setSelPoints(allPts);
          setSelContours([ci]);
          setDrag({ type: "points", start: fp, origPts, primary: allPts[0], snap: true });
        }
        setSelSegments([]);
        setSelCorners([]);
        return;
      }
      // 5) Marquee
      setDrag({ type: "marquee", start: fp, shift: e.shiftKey, mode: "node" });
      setMarquee({ start: fp, end: fp });
      if (!e.shiftKey) { setSelContours([]); setSelPoints([]); setSelSegments([]); setSelCorners([]); }
      return;
    }

    if (tool === "select" || tool === "transform") {
      // If a text frame is already selected, check for scale handle hits first.
      if (selTextFrameId) {
        const sf = (work.textFrames || []).find((tf) => tf.id === selTextFrameId);
        if (sf && !sf.locked) {
          const tbb = textFrameBounds(sf, metrics, loadedFonts, glyphs);
          if (tbb) {
            const th = hitTestBBoxHandle(fp, tbb);
            if (th && th !== "rotate") {
              setDrag({ type: "textScale", id: sf.id, handle: th, orig: JSON.parse(JSON.stringify(sf)), bb: tbb, start: fp });
              return;
            }
          }
        }
      }
      // Text frame hit takes priority over contours.
      const tfHit = hitTestTextFrame(fp);
      if (tfHit) {
        setSelContours([]);
        setSelTextFrameId(tfHit.id);
        if (!tfHit.locked) setDrag({ type: "textMove", id: tfHit.id, last: fp });
        return;
      }
      const bb = selContours.length ? selBBox() : null;
      const liveSel = selContours.length === 1 && work.contours[selContours[0]]?.liveShape;

      // 1) Live-shape parametric handles (local, rotation-aware) + pie/arc widgets.
      if (liveSel && showBBox) {
        const lc = work.contours[selContours[0]];
        const hs = liveShapeHandles(lc.liveShape);
        const thr = NODE_HIT / zoom;
        let hitH = null;
        for (const id of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
          if (dist(fp, hs[id]) < thr) { hitH = id; break; }
        }
        if (hitH) {
          setDrag({ type: "scale", handle: hitH, orig: [lc], bb, center: hs.center, start: fp, live: true });
          return;
        }
        if (dist(fp, hs.rotate) < thr) {
          setDrag({ type: "rotate", center: hs.center, startAngle: Math.atan2(fp.y - hs.center.y, fp.x - hs.center.x), orig: [lc], live: true });
          return;
        }
        if (lc.liveShape.type === "ellipse" && lc.liveShape.arcMode !== "full") {
          const ah = arcAngleHandles(lc.liveShape);
          if (ah) {
            if (dist(fp, ah.start) < thr) { setDrag({ type: "arcAngle", ci: selContours[0], which: "start" }); return; }
            if (dist(fp, ah.end) < thr) { setDrag({ type: "arcAngle", ci: selContours[0], which: "end" }); return; }
          }
        }
      }

      // 1b) Bounding-box handles (axis-aligned) for non-live selections.
      if (bb && showBBox && !liveSel) {
        const h = hitTestBBoxHandle(fp, bb);
        if (h) {
          const center = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
          const orig = selContours.map((i) => work.contours[i]);
          if (h === "rotate") {
            setDrag({ type: "rotate", center, startAngle: Math.atan2(fp.y - center.y, fp.x - center.x), orig });
          } else {
            setDrag({ type: "scale", handle: h, bb, center, start: fp, orig });
          }
          return;
        }
      }

      // 2) Object hit testing (fill + stroke aware). Ctrl/Cmd cycles to objects behind.
      const stack = hitTestContourStack(fp);
      let ci = -1;
      if (stack.length) {
        if (e.ctrlKey || e.metaKey) {
          const selUnder = stack.filter((s) => selContours.includes(s));
          if (selUnder.length) {
            const top = selUnder[0];
            ci = stack[(stack.indexOf(top) + 1) % stack.length];
          } else {
            ci = stack[0];
          }
        } else {
          ci = stack[0];
        }
      }

      if (ci >= 0) {
        setSelTextFrameId(null);
        if (e.shiftKey) {
          const next = selContours.includes(ci) ? selContours.filter((x) => x !== ci) : [...selContours, ci];
          setSelContours(next);
          if (next.includes(ci)) setDrag({ type: "move", contours: next, last: fp });
        } else if (e.altKey) {
          // Alt+drag duplicate: clone the selection (or clicked object) and drag the clone.
          const base = selContours.includes(ci) && selContours.length > 1 ? selContours : [ci];
          const dup = duplicateContours(base);
          setSelContours(dup);
          setDrag({ type: "move", contours: dup, last: fp });
        } else if (selContours.includes(ci) && selContours.length > 1) {
          setDrag({ type: "move", contours: selContours, last: fp });
        } else {
          setSelContours([ci]);
          setDrag({ type: "move", contours: [ci], last: fp });
        }
      } else if (tool === "select") {
        setDrag({ type: "marquee", start: fp, shift: e.shiftKey, mode: "select" });
        setMarquee({ start: fp, end: fp });
        if (!e.shiftKey) { setSelContours([]); setSelTextFrameId(null); }
      } else {
        setSelContours([]); setSelTextFrameId(null);
      }
      return;
    }

    if (SHAPE_TOOLS.includes(tool)) {
      const lt = toolLiveType(tool);
      const params = lt ? defaultDragParams(lt, tool) : null;
      setShapeDraft({ type: tool, liveType: lt, start: { x: fp.x, y: fp.y }, end: { x: fp.x, y: fp.y }, params });
      setDrag({ type: "shape", start: { x: fp.x, y: fp.y }, moved: false });
      ctrlInnerRef.current = null;
      return;
    }
  };

  const zoomAt = (cx, cy, factor) => {
    const newZoom = Math.max(0.1, Math.min(8, zoom * factor));
    const fx = (cx - pan.x) / zoom, fy = (cy - pan.y) / zoom;
    setPan({ x: cx - fx * newZoom, y: cy - fy * newZoom });
    setZoom(newZoom);
  };

  const onMove = (e) => {
    const drag = dragRef.current;
    const work = workRef.current;
    const r = svgRef.current.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (drag?.type === "pan") { setPan({ x: e.clientX - drag.startX, y: e.clientY - drag.startY }); return; }
    const fp = toFont(sx, sy);
    if (drag?.type === "gradientDraw") {
      let end = fp;
      if (e.shiftKey) {
        const ang = Math.atan2(end.y - drag.start.y, end.x - drag.start.x);
        const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(end.x - drag.start.x, end.y - drag.start.y);
        end = { x: drag.start.x + Math.cos(snap) * len, y: drag.start.y + Math.sin(snap) * len };
      }
      setDrag({ ...drag, end });
      return;
    }
    if (tool === "pen" || tool === "node" || tool === "select" || tool === "transform") setPenCursor(fp);

    if (drag?.type === "marquee") { setMarquee({ start: drag.start, end: fp }); return; }

    if (drag?.type === "arcAngle") {
      const lc = work.contours[drag.ci];
      if (!lc?.liveShape) { setDrag(null); return; }
      const ls = lc.liveShape;
      const cx = ls.x + ls.width / 2, cy = ls.y + ls.height / 2;
      const rad = (-(ls.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const dx = fp.x - cx, dy = fp.y - cy;
      const lx = cx + dx * cos - dy * sin, ly = cy + dx * sin + dy * cos;
      let ang = (Math.atan2(ly - cy, lx - cx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const patch = drag.which === "start" ? { startAngle: Math.round(ang) } : { endAngle: Math.round(ang) };
      const contours = work.contours.map((c, i) => (i === drag.ci ? withLiveShape(c, patch) : c));
      setWork({ ...work, contours });
      return;
    }

    if (drag?.type === "compoundMember") {
      let dx = fp.x - drag.start.x, dy = fp.y - drag.start.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const c = work.contours[drag.ci];
      const members = c.compound.members.map((m, i) => (i === drag.mi ? transformContour(m, (x, y) => ({ x: x + dx, y: y + dy })) : m));
      const contours = work.contours.map((cc, i) => (i === drag.ci ? { ...cc, compound: { ...cc.compound, members } } : cc));
      setWork({ ...work, contours });
      return;
    }

    if (drag?.type === "textCreate") {
      if (dist(fp, drag.start) > 4 / zoom) drag.moved = true;
      setTextDraft({ start: drag.start, end: fp });
      return;
    }
    if (drag?.type === "textMove") {
      const dx = fp.x - drag.last.x, dy = fp.y - drag.last.y;
      const textFrames = work.textFrames.map((tf) => (tf.id === drag.id ? { ...tf, x: tf.x + dx, y: tf.y + dy } : tf));
      setWork({ ...work, textFrames });
      setDrag({ ...drag, last: fp });
      return;
    }
    if (drag?.type === "textScale") {
      const sf = (work.textFrames || []).find((tf) => tf.id === drag.id);
      if (!sf) { setDrag(null); return; }
      const { handle, orig, bb } = drag;
      const opp = { nw: "se", ne: "sw", se: "nw", sw: "ne", n: "s", s: "n", e: "w", w: "e" };
      const axis = { nw: "both", ne: "both", se: "both", sw: "both", n: "y", s: "y", e: "x", w: "x" };
      const midX = (bb.minX + bb.maxX) / 2, midY = (bb.minY + bb.maxY) / 2;
      const pts = {
        nw: [bb.minX, bb.maxY], n: [midX, bb.maxY], ne: [bb.maxX, bb.maxY],
        e: [bb.maxX, midY], se: [bb.maxX, bb.minY], s: [midX, bb.minY],
        sw: [bb.minX, bb.minY], w: [bb.minX, midY],
      };
      const [anchorX, anchorY] = pts[opp[handle]];
      const [ohx, ohy] = pts[handle];
      const sx = Math.abs((fp.x - anchorX) / ((ohx - anchorX) || 1e-6));
      const sy = Math.abs((fp.y - anchorY) / ((ohy - anchorY) || 1e-6));
      let fontScale;
      if (axis[handle] === "both") fontScale = e.shiftKey ? Math.max(sx, sy) : Math.sqrt(sx * sy);
      else if (axis[handle] === "x") fontScale = sx;
      else fontScale = sy;
      fontScale = Math.max(0.05, fontScale);
      const newFontSize = Math.max(1, Math.round(orig.fontSize * fontScale));
      const actualScale = newFontSize / orig.fontSize;
      const patch = { fontSize: newFontSize };
      if (orig.tracking) patch.tracking = Math.round(orig.tracking * actualScale);
      patch.x = anchorX + (orig.x - anchorX) * actualScale;
      patch.y = anchorY + (orig.y - anchorY) * actualScale;
      if (orig.kind === "area") {
        patch.width = Math.max(1, orig.width * actualScale);
        patch.height = Math.max(1, orig.height * actualScale);
      }
      const textFrames = work.textFrames.map((tf) => (tf.id === drag.id ? { ...tf, ...patch } : tf));
      setWork({ ...work, textFrames });
      return;
    }

    if (penDraft?.dragging) {
      const ci = penDraft.contourIdx;
      const c = work.contours[ci];
      if (!c) return;
      const pts = [...c.points];
      const activeIdx = penDraft.continueEnd === "start" ? 0 : pts.length - 1;
      const active = pts[activeIdx];

      // Spacebar while dragging = reposition the anchor origin (Illustrator).
      if (spaceDown) {
        const ix = active.in ? active.in.x - active.x : 0, iy = active.in ? active.in.y - active.y : 0;
        const ox = active.out ? active.out.x - active.x : 0, oy = active.out ? active.out.y - active.y : 0;
        pts[activeIdx] = { ...active, x: fp.x, y: fp.y, in: active.in ? { x: fp.x + ix, y: fp.y + iy } : null, out: active.out ? { x: fp.x + ox, y: fp.y + oy } : null };
        const contours = [...work.contours]; contours[ci] = { ...c, points: pts };
        setWork({ ...work, contours });
        return;
      }

      let ox = fp.x, oy = fp.y;
      // Shift = constrain handle angle to 45° increments.
      if (e.shiftKey) {
        const ang = Math.atan2(oy - active.y, ox - active.x);
        const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(ox - active.x, oy - active.y);
        ox = active.x + Math.cos(snap) * len;
        oy = active.y + Math.sin(snap) * len;
      }
      const dx = ox - active.x, dy = oy - active.y;
      if (e.altKey) penAltUsed.current = true;
      if (penAltUsed.current) {
        // Alt breaks handle continuity (cusp): out follows the cursor, in freezes.
        pts[activeIdx] = { ...active, out: { x: ox, y: oy }, type: "corner" };
      } else {
        pts[activeIdx] = { ...active, out: { x: ox, y: oy }, in: { x: active.x - dx, y: active.y - dy }, type: "smooth" };
      }
      const contours = [...work.contours]; contours[ci] = { ...c, points: pts };
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "pencil") {
      const minDist = 6 / zoom;
      if (dist(fp, drag.last) < minDist) return;
      const ci = drag.contourIdx;
      const c = work.contours[ci];
      if (!c) return;
      const pts = [...c.points, { x: fp.x, y: fp.y, in: null, out: null, type: "corner" }];
      const contours = [...work.contours]; contours[ci] = { ...c, points: pts };
      setWork({ ...work, contours });
      setDrag({ ...drag, last: fp });
      return;
    }
    if (drag?.type === "brush" || drag?.type === "wetbrush") {
      const minDist = 4 / zoom;
      if (dist(fp, drag.last) < minDist) return;
      brushPtsRef.current.push({ x: fp.x, y: fp.y, p: pressureOf(e) });
      if (previewRef.current) {
        previewRef.current.setAttribute("d", brushFootprintPath(brushPtsRef.current, brushSize, zoom, toScreen));
      }
      // Update drag ref directly — no setDrag, no re-render. Fluid 60fps.
      dragRef.current = { ...drag, last: fp };
      return;
    }
    if (drag?.type === "corner") {
      const { set, bisector, P, offsetFont } = drag;
      const d = (fp.x - P.x) * bisector.x + (fp.y - P.y) * bisector.y;
      const r = Math.max(0, d - offsetFont);
      const contours = work.contours.map((c, ci) => {
        const items = set.filter((s) => s.ci === ci);
        if (!items.length) return c;
        const pts = [...c.points];
        items.forEach((s) => { pts[s.pi] = { ...pts[s.pi], r }; });
        return { ...c, points: pts };
      });
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "penConvert") {
      const c = work.contours[drag.contour];
      const pts = [...c.points];
      if (drag.sharp) {
        // Ctrl+Alt = sharpen to a corner (strip handles)
        pts[drag.point] = { ...pts[drag.point], type: "corner", in: null, out: null };
      } else {
        // Alt = pull smooth symmetric handles toward the cursor
        const p = { ...pts[drag.point], type: "smooth" };
        p.out = { x: fp.x, y: fp.y };
        p.in = { x: 2 * p.x - fp.x, y: 2 * p.y - fp.y };
        pts[drag.point] = p;
      }
      const contours = [...work.contours]; contours[drag.contour] = { ...c, points: pts };
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "points") {
      let dx = fp.x - drag.start.x, dy = fp.y - drag.start.y;
      // Shift = constrain to dominant axis (Illustrator)
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      // Snap the primary point's absolute new position to typographic + smart guides
      let snapDx = dx, snapDy = dy;
      const tol = 5 / zoom;
      const pmap = buildPointMap(work.contours);
      const exKeys = drag.origPts.map((o) => `${o.ci}:${o.pi}`);
      const primary = drag.origPts.find((o) => o.ci === drag.primary?.contour && o.pi === drag.primary?.point) || drag.origPts[0];
      const raw = { x: primary.x + dx, y: primary.y + dy };
      const snapped = snapPoint(raw, metrics, pmap, exKeys, tol);
      snapDx = snapped.x - primary.x; snapDy = snapped.y - primary.y;
      setSnapGuides(snapped.guides);
      const contours = work.contours.map((c, ci) => {
        const opts = drag.origPts.filter((o) => o.ci === ci);
        if (!opts.length) return c;
        const pts = [...c.points];
        opts.forEach((o) => {
          pts[o.pi] = {
            ...pts[o.pi], x: o.x + snapDx, y: o.y + snapDy,
            in: o.in ? { x: o.in.x + snapDx, y: o.in.y + snapDy } : null,
            out: o.out ? { x: o.out.x + snapDx, y: o.out.y + snapDy } : null,
          };
        });
        return convertToPath({ ...c, points: pts });
      });
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "handle") {
      const c = work.contours[drag.contour];
      const pts = [...c.points];
      const p = { ...pts[drag.point] };
      p[drag.handle] = { x: fp.x, y: fp.y };
      if (drag.single) {
        // Curve Handle mode: only the dragged lever moves; the opposite handle
        // stays put and the point becomes a corner (independent handles).
        p.type = "corner";
        const other = drag.handle === "out" ? "in" : "out";
        p[other] = pts[drag.point][other];
      } else if (p.type === "smooth") {
        const other = drag.handle === "out" ? "in" : "out";
        if (e.altKey) {
          // Alt = temporarily break handle symmetry (opposite handle stays put)
          p[other] = pts[drag.point][other];
        } else {
          p[other] = { x: 2 * p.x - fp.x, y: 2 * p.y - fp.y };
        }
      }
      pts[drag.point] = p;
      const contours = [...work.contours]; contours[drag.contour] = { ...c, points: pts };
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "segment") {
      const dx = fp.x - drag.last.x, dy = fp.y - drag.last.y;
      const contours = work.contours.map((c, ci) => {
        const segs = drag.segments.filter((s) => s.contour === ci);
        if (!segs.length) return c;
        const pts = [...c.points];
        const moved = new Set();
        segs.forEach((s) => {
          const n = c.points.length;
          [s.seg, (s.seg + 1) % n].forEach((pi) => {
            if (moved.has(pi)) return;
            moved.add(pi);
            const p = pts[pi];
            pts[pi] = {
              ...p, x: p.x + dx, y: p.y + dy,
              in: p.in ? { x: p.in.x + dx, y: p.in.y + dy } : null,
              out: p.out ? { x: p.out.x + dx, y: p.out.y + dy } : null,
            };
          });
        });
        return { ...c, points: pts };
      });
      setWork({ ...work, contours });
      setDrag({ ...drag, last: fp });
      return;
    }
    if (drag?.type === "move") {
      const dx = fp.x - drag.last.x, dy = fp.y - drag.last.y;
      const contours = work.contours.map((c, i) => {
        if (!drag.contours.includes(i)) return c;
        if (c.liveShape) return moveLiveShape(c, dx, dy);
        return transformContour(c, (x, y) => ({ x: x + dx, y: y + dy }));
      });
      setWork({ ...work, contours });
      setDrag({ ...drag, last: fp });
      return;
    }
    if (drag?.type === "scale") {
      if (drag.live) {
        const origC = drag.orig[0];
        const patch = liveShapeScalePatch(origC.liveShape, drag.handle, fp, e.shiftKey);
        const contours = work.contours.map((c, i) => (i === selContours[0] ? withLiveShape(origC, patch) : c));
        setWork({ ...work, contours });
        return;
      }
      const bb = drag.bb;
      const midX = (bb.minX + bb.maxX) / 2, midY = (bb.minY + bb.maxY) / 2;
      const pts = {
        nw: [bb.minX, bb.maxY], n: [midX, bb.maxY], ne: [bb.maxX, bb.maxY],
        e: [bb.maxX, midY], se: [bb.maxX, bb.minY], s: [midX, bb.minY],
        sw: [bb.minX, bb.minY], w: [bb.minX, midY],
      };
      const opp = { nw: "se", ne: "sw", se: "nw", sw: "ne", n: "s", s: "n", e: "w", w: "e" };
      const axis = { nw: "both", ne: "both", se: "both", sw: "both", n: "y", s: "y", e: "x", w: "x" };
      let [anchorX, anchorY] = pts[opp[drag.handle]];
      if (e.altKey) { anchorX = midX; anchorY = midY; } // Alt/Option = scale from center
      const [ohx, ohy] = pts[drag.handle];
      const denomX = (ohx - anchorX) || 1e-6, denomY = (ohy - anchorY) || 1e-6;
      let sx = 1, sy = 1;
      if (axis[drag.handle] === "both" || axis[drag.handle] === "x") sx = (fp.x - anchorX) / denomX;
      if (axis[drag.handle] === "both" || axis[drag.handle] === "y") sy = (fp.y - anchorY) / denomY;
      if (e.shiftKey && axis[drag.handle] === "both") { // Shift = proportional (preserve aspect)
        if (Math.abs(sx) > Math.abs(sy)) sy = sx; else sx = sy;
      }
      const contours = work.contours.map((c, i) => {
        const idx = selContours.indexOf(i);
        if (idx < 0) return c;
        return transformContour(drag.orig[idx], (x, y) => ({ x: anchorX + (x - anchorX) * sx, y: anchorY + (y - anchorY) * sy }));
      });
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "scalePoints") {
      const contours = scalePointsTransform(work.contours, drag.origPts, drag.handle, drag.bb, drag.center, fp, e.altKey, e.shiftKey);
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "rotate") {
      let ang = Math.atan2(fp.y - drag.center.y, fp.x - drag.center.x) - drag.startAngle;
      if (e.shiftKey) { const step = Math.PI / 12; ang = Math.round(ang / step) * step; } // Shift = constrain to 15°
      if (drag.live) {
        const origC = drag.orig[0];
        const newRot = (origC.liveShape.rotation || 0) + (ang * 180) / Math.PI;
        const contours = work.contours.map((c, i) => (i === selContours[0] ? withLiveShape(origC, { rotation: newRot }) : c));
        setWork({ ...work, contours });
        return;
      }
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const cx = drag.center.x, cy = drag.center.y;
      const contours = work.contours.map((c, i) => {
        const idx = selContours.indexOf(i);
        if (idx < 0) return c;
        return transformContour(drag.orig[idx], (x, y) => {
          const dx = x - cx, dy = y - cy;
          return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        });
      });
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "rotatePoints") {
      const contours = rotatePointsTransform(work.contours, drag.origPts, drag.center, drag.startAngle, fp, e.shiftKey);
      setWork({ ...work, contours });
      return;
    }
    if (drag?.type === "shape") {
      if (dist(fp, drag.start) > 2 / zoom) drag.moved = true;
      const t = shapeDraft.type;
      let end = { ...fp };
      const square = e.shiftKey || t === "circle";
      if (square && (t === "rectangle" || t === "roundedRect" || t === "circle" || t === "ellipse")) {
        const dx = fp.x - drag.start.x, dy = fp.y - drag.start.y;
        const s = Math.max(Math.abs(dx), Math.abs(dy));
        end = { x: drag.start.x + Math.sign(dx || 1) * s, y: drag.start.y + Math.sign(dy || 1) * s };
      }
      let start = drag.start;
      if (e.altKey && t !== "star") {
        const dx = end.x - drag.start.x, dy = end.y - drag.start.y;
        start = { x: drag.start.x - dx, y: drag.start.y - dy };
      }
      const params = { ...shapeDraft.params };
      if (t === "star") {
        const rOut = Math.max(1, Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2);
        if (e.ctrlKey) {
          if (ctrlInnerRef.current == null) ctrlInnerRef.current = (params.innerRadius ?? 0.5) * rOut;
          params.innerRadius = Math.max(0.05, Math.min(0.95, ctrlInnerRef.current / rOut));
        } else {
          ctrlInnerRef.current = null;
        }
        params._altRotate = !!e.altKey;
      }
      setShapeDraft({ ...shapeDraft, start, end, params });
      return;
    }

    // Selection Tool hover feedback (contextual cursor: handle / object / text frame)
    if (tool === "select" || tool === "transform") {
      let hh = null;
      if (selContours.length) { const bb = selBBox(); if (bb && showBBox) hh = hitTestBBoxHandle(fp, bb); }
      if (!hh && selTextFrameId) {
        const sf = (work.textFrames || []).find((tf) => tf.id === selTextFrameId);
        if (sf) { const tbb = textFrameBounds(sf, metrics, loadedFonts, glyphs); if (tbb) hh = hitTestBBoxHandle(fp, tbb); }
      }
      setHoverHandle(hh);
      setHoverObj(!hh && hitTestContourStack(fp).length > 0);
    } else {
      if (hoverHandle) setHoverHandle(null);
      if (hoverObj) setHoverObj(false);
    }

    // Direct Selection Tool hover feedback (contextual cursor)
    if (tool === "node" && !drag) {
      let hh = null, hc = null;
      if (selPoints.length > 1) {
        const bb = pointsBBox(work.contours, selPoints); if (bb) { const bh = hitTestBBoxHandle(fp, bb); if (bh) hh = bh === "rotate" ? "rotate" : bh; }
      }
      if (!hh && hitTestHandle(fp)) hh = "handle";
      else if (!hh && hitTestPoint(fp)) hh = "point";
      else if (!hh) {
        const seg = hitTestSegment(fp);
        if (seg) { hh = "segment"; hc = seg.contour; }
        else { const ci = hitTestContour(fp); if (ci >= 0) { hh = "fill"; hc = ci; } }
      }
      setNodeHover(hh);
      setNodeHoverContour(hc);
    } else if (nodeHover) {
      setNodeHover(null);
      setNodeHoverContour(null);
    }

    // Pen tool hover feedback (close / join / add / remove / convert)
    if (tool === "pen" && !drag && !penDraft?.dragging) {
      let h = null;
      if (subMode === "direct" || subMode === "curveHandle") { const hg = hitTestHandle(fp); if (hg) h = { type: "handle", ...hg }; }
      if (penDraft) {
        const c = work.contours[penDraft.contourIdx];
        if (c && c.points.length > 1) {
          const closeEnd = penDraft.continueEnd === "end" ? "start" : "end";
          const closePt = closeEnd === "start" ? c.points[0] : c.points[c.points.length - 1];
          if (dist(fp, closePt) < NODE_HIT / zoom) h = { type: "close", contour: penDraft.contourIdx, end: closeEnd };
        }
      }
      if (!h) { const ap = hitTestPoint(fp); if (ap) h = { type: "anchor", ...ap }; }
      if (!h) { const ep = hitTestEndpoint(fp); if (ep) h = { type: "endpoint", ...ep }; }
      if (!h) { const seg = hitTestSegment(fp); if (seg) h = { type: "segment", ...seg }; }
      setPenHover(h);
      penTargetRef.current = h?.type === "anchor" ? { contour: h.contour, point: h.point } : (selPoints.length ? selPoints[selPoints.length - 1] : null);
    } else if (penHover) {
      setPenHover(null);
    }

    // Add Anchor Point Tool hover feedback: "+" cursor + path marker, no selection needed
    if (tool === "penAdd" && !drag) {
      setPenAddHit(penAddTarget(fp));
    } else if (penAddHit) {
      setPenAddHit(null);
    }
  };

  const onUp = (e) => {
    const drag = dragRef.current;
    const work = workRef.current;
    if (e?.pointerId != null && svgRef.current) {
      try { if (svgRef.current.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId); } catch {}
    }
    if (drag?.type === "pan") { setDrag(null); return; }
    if (drag?.type === "gradientDraw") {
      const { ci, start, end, existing } = drag;
      const existingGrad = isGradientFill(existing) ? existing : null;
      const moved = dist(end, start) >= 3 / zoom;
      let grad;
      if (!moved) {
        // Click (no drag): apply a default gradient spanning the contour's bbox.
        // A zero-length drag would render as a broken solid, so span the shape instead.
        if (existingGrad) {
          grad = existingGrad; // already a gradient — just select, don't reset
        } else {
          let bb = null;
          for (const sub of resolvedSubContours(ci)) {
            const b = contourBounds(sub);
            if (!b) continue;
            bb = bb ? { minX: Math.min(bb.minX, b.minX), minY: Math.min(bb.minY, b.minY), maxX: Math.max(bb.maxX, b.maxX), maxY: Math.max(bb.maxY, b.maxY) } : b;
          }
          grad = bb
            ? buildGradientForBBox(bb, "linear", DEFAULT_GRADIENT_STOPS)
            : { type: "gradient", gradientType: "linear", x1: start.x, y1: start.y, x2: start.x + 100, y2: start.y, stops: DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s })) };
        }
      } else if (existingGrad) {
        if (existingGrad.gradientType === "radial") {
          const r = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
          grad = { ...existingGrad, cx: start.x, cy: start.y, r, fx: start.x, fy: start.y };
        } else {
          grad = { ...existingGrad, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
        }
      } else {
        grad = { type: "gradient", gradientType: "linear", x1: start.x, y1: start.y, x2: end.x, y2: end.y, stops: DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s })) };
      }
      const contours = work.contours.map((c, i) => (i === ci ? setAppearance(c, { fill: grad }) : c));
      commitWork({ ...work, contours });
      setSelContours([ci]);
      setDrag(null);
      return;
    }
    if (drag?.type === "compoundMember") { onCommit(work); setDrag(null); return; }
    if (drag?.type === "textMove" || drag?.type === "textScale") { onCommit(work); setDrag(null); return; }
    if (drag?.type === "textCreate") {
      const fp2 = e ? getMouse(e) : drag.start;
      const moved = drag.moved && dist(fp2, drag.start) > 5 / zoom;
      let frame;
      if (moved) {
        const x = Math.min(drag.start.x, fp2.x);
        const y = Math.max(drag.start.y, fp2.y); // font coords y-up: top is max y
        const w = Math.abs(fp2.x - drag.start.x);
        const h = Math.abs(fp2.y - drag.start.y);
        frame = { ...makeTextFrame({ kind: "area", x, y, width: w, height: h }), ...textDefaults };
      } else {
        frame = { ...makeTextFrame({ kind: "point", x: drag.start.x, y: drag.start.y }), ...textDefaults };
      }
      const textFrames = [...(work.textFrames || []), frame];
      commitWork({ ...work, textFrames });
      setSelTextFrameId(frame.id);
      setEditingTextFrameId(frame.id);
      setTextDraft(null);
      setDrag(null);
      return;
    }
    if (drag?.type === "corner") { onCommit(work); setDrag(null); return; }
    if (drag?.type === "penConvert") {
      const fp = e ? getMouse(e) : drag.start;
      const moved = dist(fp, drag.start) >= 3 / zoom;
      const c = work.contours[drag.contour];
      const pts = [...c.points];
      // Ctrl+Alt (sharp) or Alt+click (no drag) => corner; Alt+drag => smooth (commit preview)
      if (drag.sharp || !moved) {
        pts[drag.point] = { ...pts[drag.point], type: "corner", in: null, out: null };
        commitWork({ ...work, contours: work.contours.map((cc, i) => (i === drag.contour ? { ...cc, points: pts } : cc)) });
      } else { onCommit(work); }
      setDrag(null);
      return;
    }
    if (penDraft) { setPenDraft({ ...penDraft, dragging: false }); setDrag(null); return; }
    if (drag?.type === "brush") {
      const pts = brushPtsRef.current;
      if (pts.length >= 1) {
        const newC = brushStroke(pts, brushSize);
        if (newC) {
          const contours = [...work.contours, { ...newC, isBrush: true }];
          commitWork({ ...work, contours });
          setSelContours([work.contours.length]);
        }
      }
      brushPtsRef.current = [];
      setBrushing(false);
      setDrag(null);
      return;
    }
    if (drag?.type === "wetbrush") {
      const pts = brushPtsRef.current;
      if (pts.length >= 1) {
        const newContours = wetBrushOutline(pts, brushSize);
        if (newContours && newContours.length) {
          const contours = [...work.contours, ...newContours];
          commitWork({ ...work, contours });
          setSelContours(newContours.map((_, i) => work.contours.length + i));
        }
      }
      brushPtsRef.current = [];
      setBrushing(false);
      setDrag(null);
      return;
    }
    if (drag?.type === "marquee" && marquee) {
      const r = marqueeRect(marquee);
      const tiny = r.maxX - r.minX < 2 && r.maxY - r.minY < 2;
      if (!tiny) {
        if (drag.mode === "select") {
          const hit = work.contours.map((c, ci) => (boundsIntersect(contourBounds(c), r) ? ci : -1)).filter((i) => i >= 0);
          setSelContours(drag.shift ? [...new Set([...selContours, ...hit])] : hit);
        } else {
          const pts = [];
          work.contours.forEach((c, ci) => c.points.forEach((p, pi) => { if (pointInRect(p, r)) pts.push({ contour: ci, point: pi }); }));
          const merged = drag.shift ? [...selPoints, ...pts] : pts;
          const dedup = merged.filter((s, idx) => !merged.slice(0, idx).some((t) => t.contour === s.contour && t.point === s.point));
          setSelPoints(dedup);
          setSelContours([...new Set(dedup.map((s) => s.contour))]);
          if (!drag.shift) setSelSegments([]);
        }
      }
      setMarquee(null);
      setDrag(null);
      return;
    }
    if (drag?.type === "points" || drag?.type === "handle" || drag?.type === "segment" || drag?.type === "move" || drag?.type === "scale" || drag?.type === "rotate" || drag?.type === "pencil" || drag?.type === "arcAngle" || drag?.type === "scalePoints" || drag?.type === "rotatePoints") {
      onCommit(work);
      setSnapGuides([]);
      setDrag(null);
      return;
    }
    if (drag?.type === "shape" && shapeDraft) {
      const { start, end, type, liveType, params } = shapeDraft;
      const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
      if (w > 2 && h > 2) {
        let contour;
        if (liveType) {
          const p = { ...params };
          if (liveType === "rectangle" && p.cornerRadius == null) p.cornerRadius = Math.min(w, h) * 0.2;
          if (liveType === "star" && p._altRotate) p.rotation = 180 / (p.points || 5);
          delete p._altRotate;
          contour = makeLiveShape(liveType, x, y, w, h, p);
        } else {
          contour = shapeContour(type, x, y, w, h);
        }
        commitWork({ ...work, contours: [...work.contours, contour] });
        setSelContours([work.contours.length]);
      } else if (!drag.moved) {
        setShapeDialog({ tool: type, x: drag.start.x, y: drag.start.y });
      }
      setShapeDraft(null);
      setDrag(null);
      return;
    }
    setDrag(null);
  };
  onUpRef.current = onUp;

  // Safety net: if pointer capture fails (or the pointer leaves the window
  // mid-drag), the SVG's onPointerUp might never fire. Listen on the window
  // so the drag always ends and the work is committed.
  useEffect(() => {
    const onWinUp = (e) => { if (dragRef.current) onUpRef.current(e); };
    window.addEventListener("pointerup", onWinUp);
    return () => window.removeEventListener("pointerup", onWinUp);
  }, []);

  const onDouble = (e) => {
    if ((tool === "select" || tool === "transform") && !penDraft) {
      const fp = getMouse(e);
      const hit = hitTestTextFrame(fp);
      if (hit && !hit.locked) { setSelTextFrameId(hit.id); setEditingTextFrameId(hit.id); return; }
    }
    if (tool === "pen" && penDraft) { finishPen(true); return; }
    if ((tool === "node" && (selPoints.length || selContours.length)) || ((tool === "select" || tool === "transform") && selContours.length)) {
      const fp = getMouse(e);
      const w = hitTestCornerWidget(fp);
      if (w) {
        const pt = work.contours[w.ci].points[w.pi];
        const s = toScreen(pt);
        setCornerDialog({ x: s.x, y: s.y, ci: w.ci, pi: w.pi, radius: pt.r || 0, type: pt.ct || "round", individual: true });
        return;
      }
    }
    if (tool === "node") {
      const fp = getMouse(e);
      const h = hitTestPoint(fp);
      if (h) {
        const c = work.contours[h.contour];
        const pts = [...c.points];
        const p = { ...pts[h.point] };
        if (p.type === "smooth") { p.type = "corner"; p.in = null; p.out = null; }
        else {
          p.type = "smooth";
          const next = c.points[(h.point + 1) % c.points.length];
          const dx = (next.x - p.x) * 0.3, dy = (next.y - p.y) * 0.3;
          p.out = { x: p.x + dx, y: p.y + dy };
          p.in = { x: p.x - dx, y: p.y - dy };
        }
        pts[h.point] = p;
        commitWork({ ...work, contours: work.contours.map((cc, i) => (i === h.contour ? { ...cc, points: pts } : cc)) });
        return;
      }
      // Double-click a path segment → insert an anchor point (contextual Add Point)
      const seg = hitTestSegment(fp);
      if (seg) { insertNode(seg); setSelContours([seg.contour]); }
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const r = svgRef.current.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  // --- Render ---
  const guides = [
    { y: metrics.ascender, label: "Ascender", color: "#f59e0b" },
    { y: metrics.capHeight, label: "Cap", color: "#ef4444" },
    { y: metrics.xHeight, label: "x", color: "#3b82f6" },
    { y: 0, label: "Baseline", color: "#10b981" },
    { y: metrics.descender, label: "Descender", color: "#f59e0b" },
  ];
  // Color-matched draggable handles for every font margin. Dragging is only
  // possible via these handles (rendered in the rulers); the canvas guide
  // lines are non-interactive.
  const marginHandles = workspaceMode === "font" ? [
    { axis: "y", key: "ascender", fontY: metrics.ascender, color: "#f59e0b" },
    { axis: "y", key: "capHeight", fontY: metrics.capHeight, color: "#ef4444" },
    { axis: "y", key: "xHeight", fontY: metrics.xHeight, color: "#3b82f6" },
    { axis: "y", key: "baseline", fontY: metrics.baseline || 0, color: "#10b981" },
    { axis: "y", key: "descender", fontY: metrics.descender, color: "#f59e0b" },
    { axis: "x", key: "leftSideBearing", fontX: work.leftSideBearing, color: "#3B82F6" },
    { axis: "x", key: "advanceWidth", fontX: work.advanceWidth, color: "#3B82F6" },
  ] : [];
  const renderContours = resolveContours(work, glyphs);
  const editorFill = EDITOR_FILL;
  const gridColor = canvasTheme === "light" ? "#000000" : "#ffffff";
  const gridOpacity = canvasTheme === "light" ? 0.05 : 0.04;

  const gridStep = 50;
  const gridLines = [];
  if (showGrid && svgRef.current) {
    const r = svgRef.current.getBoundingClientRect();
    const W = r.width, H = r.height;
    const fLeft = toFont(0, 0).x, fRight = toFont(W, 0).x;
    const fBottom = toFont(0, H).y, fTop = toFont(0, 0).y;
    for (let gx = Math.floor(fLeft / gridStep) * gridStep; gx < fRight; gx += gridStep) {
      const s = toScreen({ x: gx, y: 0 });
      gridLines.push(<line key={"gx" + gx} x1={s.x} y1={0} x2={s.x} y2={H} stroke={gridColor} strokeWidth={1} opacity={gridOpacity} />);
    }
    for (let gy = Math.floor(fBottom / gridStep) * gridStep; gy < fTop; gy += gridStep) {
      const s = toScreen({ x: 0, y: gy });
      gridLines.push(<line key={"gy" + gy} x1={0} y1={s.y} x2={W} y2={s.y} stroke={gridColor} strokeWidth={1} opacity={gridOpacity} />);
    }
  }

  let cursor = "default";
  if (tool === "hand" || spaceDown) cursor = "grab";
  else if (tool === "type") cursor = "text";
  else if (tool === "pen") {
    const ad = autoAddDelete && !shiftHeld;
    if (subMode === "sharp") cursor = penHover?.type === "anchor" ? penCursorSVG("◇") : "crosshair";
    else if (subMode === "smooth") cursor = penHover?.type === "anchor" ? penCursorSVG("^") : "crosshair";
    else if (subMode === "delete") cursor = penHover?.type === "anchor" ? penCursorSVG("-") : "crosshair";
    else if (subMode === "direct" || subMode === "curveHandle") cursor = (penHover?.type === "anchor" || penHover?.type === "handle" || ctrlHeld) ? "pointer" : "default";
    else if (altHeld && penHover?.type === "anchor") cursor = penCursorSVG(ctrlHeld ? "◇" : "^");
    else if (ctrlHeld && penHover?.type === "anchor") cursor = penCursorSVG("⇄");
    else if (ad && penHover?.type === "anchor") cursor = penCursorSVG("-");
    else if (ad && penHover?.type === "segment") cursor = penCursorSVG("+");
    else if (penHover?.type === "close") cursor = penCursorSVG("o");
    else if (penHover?.type === "endpoint") cursor = penCursorSVG("¬");
    else cursor = penCursorSVG("*");
  }
  else if (tool === "penAdd") cursor = penAddHit ? penCursorSVG("+") : "crosshair";
  else if (tool === "pencil" || tool === "brush" || tool === "wetbrush" || tool === "penDelete" || tool === "penConvert" || tool === "eyedropper" || tool === "gradient") cursor = "crosshair";
  else if ((tool === "select" || tool === "transform") && !drag) {
    if (hoverHandle === "rotate") cursor = rotateCursorSVG();
    else if (hoverHandle === "nw" || hoverHandle === "se") cursor = "nwse-resize";
    else if (hoverHandle === "ne" || hoverHandle === "sw") cursor = "nesw-resize";
    else if (hoverHandle === "n" || hoverHandle === "s") cursor = "ns-resize";
    else if (hoverHandle === "e" || hoverHandle === "w") cursor = "ew-resize";
    else if (hoverObj) cursor = "move";
  } else if (tool === "node" && !drag) {
    const rMap = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
    if (nodeHover === "rotate") cursor = rotateCursorSVG();
    else if (rMap[nodeHover]) cursor = rMap[nodeHover];
    else if (nodeHover === "handle") cursor = "crosshair";
    else if (nodeHover === "point" || nodeHover === "segment" || nodeHover === "fill") cursor = "pointer";
  }

  // Selection / Transform bounding box with 8 handles + rotate handle
  const liveSelRender = selContours.length === 1 && work.contours[selContours[0]]?.liveShape;
  let bboxG = null;
  if ((tool === "select" || tool === "transform") && selContours.length && showBBox && !drag && !liveSelRender) {
    const bb = selBBox();
    if (bb) {
      const midX = (bb.minX + bb.maxX) / 2, midY = (bb.minY + bb.maxY) / 2;
      const handles = [
        ["nw", bb.minX, bb.maxY], ["n", midX, bb.maxY], ["ne", bb.maxX, bb.maxY],
        ["e", bb.maxX, midY], ["se", bb.maxX, bb.minY], ["s", midX, bb.minY],
        ["sw", bb.minX, bb.minY], ["w", bb.minX, midY],
      ];
      const tl = toScreen({ x: bb.minX, y: bb.maxY }), br = toScreen({ x: bb.maxX, y: bb.minY });
      bboxG = (
        <g>
          <rect x={Math.min(tl.x, br.x)} y={Math.min(tl.y, br.y)} width={Math.abs(br.x - tl.x)} height={Math.abs(br.y - tl.y)} fill="none" stroke="#a855f7" strokeWidth={1} />
          {handles.map(([id, x, y]) => { const s = toScreen({ x, y }); return <rect key={id} x={s.x - 4} y={s.y - 4} width={8} height={8} fill="#fff" stroke="#a855f7" strokeWidth={1} />; })}
        </g>
      );
    }
  }

  // Live-shape parametric bounding box (oriented to the shape's rotation) + pie/arc handles.
  let liveBBoxG = null;
  if ((tool === "select" || tool === "transform") && liveSelRender && showBBox && !drag) {
    const lc = work.contours[selContours[0]];
    const hs = liveShapeHandles(lc.liveShape);
    const corners = ["nw", "ne", "se", "sw"].map((id) => toScreen(hs[id]));
    const outlineD = `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;
    const rot = toScreen(hs.rotate);
    const cs = toScreen(hs.center);
    const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((id) => {
      const s = toScreen(hs[id]); return <rect key={id} x={s.x - 4} y={s.y - 4} width={8} height={8} fill="#fff" stroke="#a855f7" strokeWidth={1} />;
    });
    let inner = (
      <g>
        <path d={outlineD} fill="none" stroke="#a855f7" strokeWidth={1} />
        {handles}
        <line x1={cs.x} y1={cs.y} x2={rot.x} y2={rot.y} stroke="#a855f7" strokeWidth={1} />
        <circle cx={rot.x} cy={rot.y} r={5} fill="#0ea5e9" stroke="#000" strokeWidth={1} />
      </g>
    );
    if (lc.liveShape.type === "ellipse" && lc.liveShape.arcMode !== "full") {
      const ah = arcAngleHandles(lc.liveShape);
      const ss = toScreen(ah.start), es = toScreen(ah.end);
      inner = (
        <g>
          {inner}
          <circle cx={ss.x} cy={ss.y} r={5} fill="#f59e0b" stroke="#000" strokeWidth={1} />
          <circle cx={es.x} cy={es.y} r={5} fill="#22c55e" stroke="#000" strokeWidth={1} />
        </g>
      );
    }
    liveBBoxG = inner;
  }

  const subBBox = (tool === "node" && selPoints.length > 1 && !drag) ? pointsBBox(work.contours, selPoints) : null;

  return (
    <div className={`flex-1 relative overflow-hidden flex flex-col ${canvasTheme === "light" ? "bg-neutral-100" : "bg-neutral-950"}`}>
      <CanvasRulers show={showRulers} zoom={zoom} pan={pan} unit={rulerUnit} onUnitChange={setRulerUnit} workspaceMode={workspaceMode} marginHandles={marginHandles} onMarginChange={onMarginChange} lockMargins={lockMargins}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor, touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={(e) => {
          // Never end an active drag on pointerleave — pointer capture ensures
          // we still receive pointermove/pointerup, and some browsers fire
          // pointerleave mid-drag even with capture, which would abort the drag.
          if (dragRef.current) return;
          onUp(e);
        }}
        onDoubleClick={onDouble}
        onWheel={onWheel}
      >
        {gridLines}

        {showGuides && workspaceMode === "font" && guides.map((g, i) => {
          const s = toScreen({ x: 0, y: g.y });
          return (
            <g key={i} style={{ pointerEvents: "none" }}>
              <line x1={0} y1={s.y} x2={8000} y2={s.y} stroke={g.color} strokeWidth={1} opacity={0.5} strokeDasharray="4 4" />
              <text x={8} y={s.y - 4} fill={g.color} fontSize={10} opacity={0.7}>{g.label}</text>
            </g>
          );
        })}
        {/* LSB / Advance margin lines — visual only. Dragging lives in the
            top ruler handles; these lines are non-interactive so canvas clicks
            never grab the margins. */}
        {showGuides && workspaceMode === "font" && (() => {
          const l = toScreen({ x: work.leftSideBearing, y: 0 });
          const r2 = toScreen({ x: work.advanceWidth, y: 0 });
          const top = toScreen({ x: 0, y: metrics.ascender }).y;
          const bot = toScreen({ x: 0, y: metrics.descender }).y;
          return (
            <g style={{ pointerEvents: "none" }}>
              <line x1={l.x} y1={top} x2={l.x} y2={bot} stroke="#3B82F6" strokeWidth={1} opacity={0.55} strokeDasharray="3 3" />
              <line x1={r2.x} y1={top} x2={r2.x} y2={bot} stroke="#3B82F6" strokeWidth={1} opacity={0.55} strokeDasharray="3 3" />
              <text x={l.x + 3} y={top + 11} fill="#3B82F6" fontSize={9} opacity={0.8}>LSB</text>
              <text x={r2.x + 3} y={top + 11} fill="#3B82F6" fontSize={9} opacity={0.8}>Adv</text>
            </g>
          );
        })()}

        {/* Artboard (Illustration mode) — outline strokes + edge dimension ticks (no fill) */}
        {workspaceMode === "illustration" && artboard && (() => {
          const ab = artboard;
          const tl = toScreen({ x: 0, y: ab.height });
          const br = toScreen({ x: ab.width, y: 0 });
          const x = Math.min(tl.x, br.x), y = Math.min(tl.y, br.y);
          const w = Math.abs(br.x - tl.x), h = Math.abs(br.y - tl.y);
          const wLabel = `${toDisplay(ab.width, rulerUnit)} ${UNIT_LABELS[rulerUnit]}`;
          const hLabel = `${toDisplay(ab.height, rulerUnit)} ${UNIT_LABELS[rulerUnit]}`;
          const tickLen = 8;
          const ticks = [];
          const nW = 10;
          for (let i = 0; i <= nW; i++) { const tx = x + (w * i) / nW; ticks.push(<line key={"tw" + i} x1={tx} y1={y} x2={tx} y2={y - tickLen} stroke="#a855f7" strokeWidth={1.5} opacity={0.8} />); }
          const nH = 10;
          for (let i = 0; i <= nH; i++) { const ty = y + (h * i) / nH; ticks.push(<line key={"th" + i} x1={x} y1={ty} x2={x - tickLen} y2={ty} stroke="#a855f7" strokeWidth={1.5} opacity={0.8} />); }
          return (
            <g>
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="#a855f7" strokeWidth={2} />
              {ticks}
              <text x={x + w / 2} y={y - 12} fill="#a855f7" fontSize={11} textAnchor="middle">{wLabel}</text>
              <text x={x - 12} y={y + h / 2} fill="#a855f7" fontSize={11} textAnchor="middle" transform={`rotate(-90 ${x - 12} ${y + h / 2})`}>{hLabel}</text>
            </g>
          );
        })()}

        {/* Text frames (rendered behind glyph contours as a tracing/template base) */}
        {(work.textFrames || []).map((f) => (
          <g key={f.id}>
            {f.kind === "area" && (() => {
              const tl = toScreen({ x: f.x, y: f.y });
              const br = toScreen({ x: f.x + f.width, y: f.y - f.height });
              const sel = selTextFrameId === f.id;
              return <rect x={Math.min(tl.x, br.x)} y={Math.min(tl.y, br.y)} width={Math.abs(br.x - tl.x)} height={Math.abs(br.y - tl.y)} fill="none" stroke={sel ? "#a855f7" : "#64748b"} strokeWidth={1} strokeDasharray={sel ? "" : "3 3"} opacity={0.6} />;
            })()}
            <TextFrameLayer frame={f} toScreen={toScreen} zoom={zoom} metrics={metrics} loadedFonts={loadedFonts} projectGlyphs={glyphs} />
          </g>
        ))}

        {/* Glyph fill (own + components) — grouped by appearance for correct counterforms */}
        {groupByAppearance(renderContours, editorFill).map((g, gi) => {
          const fillAttr = isGradientFill(g.fill) ? `url(#grf${gi})` : (g.fill == null ? "none" : g.fill);
          const rule = g.fillRule || "evenodd";
          const clusters = rule === "nonzero" ? [g.contours] : clusterByContainment(g.contours);
          return (
            <g key={"f" + gi}>
              {isGradientFill(g.fill) && (<defs>{buildGrad(g.fill, `grf${gi}`, toScreen)}</defs>)}
              {clusters.map((cluster, ci) => (
                <path key={ci} d={cluster.map((c) => pathD(c, toScreen)).join(" ")} fill={fillAttr} fillOpacity={g.fillOpacity} fillRule={rule} opacity={g.opacity} />
              ))}
            </g>
          );
        })}
        {/* Strokes per contour — full stroke properties (caps, joins, align, dash, arrows, width profiles) */}
        {renderContours.map((c, ci) => (
          <StrokeLayer key={"sl" + ci} contour={c} ap={getAppearance(c)} toScreen={toScreen} zoom={zoom} id={`${ci}`} />
        ))}

        {/* Shape draft */}
        {shapeDraft && (() => {
          const { start, end, type, liveType, params } = shapeDraft;
          const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
          const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
          if (w < 1 && h < 1) return null;
          let c;
          if (liveType) {
            const p = { ...params };
            if (liveType === "rectangle" && p.cornerRadius == null) p.cornerRadius = Math.min(w, h) * 0.2;
            if (liveType === "star" && p._altRotate) p.rotation = 180 / (p.points || 5);
            delete p._altRotate;
            c = makeLiveShape(liveType, x, y, w, h, p);
          } else {
            c = shapeContour(type, x, y, w, h);
          }
          return <path d={pathD(c, toScreen)} fill={editorFill} fillOpacity={0.4} stroke="#a855f7" strokeWidth={1} />;
        })()}

        {/* Brush preview — filled circles per sample, radius scales with pressure (ref-based, no re-render) */}
        <path
          ref={previewRef}
          fill={editorFill} stroke="none" opacity={0.7}
          style={{ display: brushing ? "" : "none" }}
        />

        {/* Text frame selection bounds + scale handles */}
        {selTextFrameId && (tool === "select" || tool === "transform") && (() => {
          const f = (work.textFrames || []).find((tf) => tf.id === selTextFrameId);
          if (!f) return null;
          const b = textFrameBounds(f, metrics, loadedFonts, glyphs);
          if (!b) return null;
          const midX = (b.minX + b.maxX) / 2, midY = (b.minY + b.maxY) / 2;
          const handles = [
            ["nw", b.minX, b.maxY], ["n", midX, b.maxY], ["ne", b.maxX, b.maxY],
            ["e", b.maxX, midY], ["se", b.maxX, b.minY], ["s", midX, b.minY],
            ["sw", b.minX, b.minY], ["w", b.minX, midY],
          ];
          const tl = toScreen({ x: b.minX, y: b.maxY });
          const br = toScreen({ x: b.maxX, y: b.minY });
          return (
            <g>
              <rect x={Math.min(tl.x, br.x)} y={Math.min(tl.y, br.y)} width={Math.abs(br.x - tl.x)} height={Math.abs(br.y - tl.y)} fill="none" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" />
              {handles.map(([id, x, y]) => { const s = toScreen({ x, y }); return <rect key={id} x={s.x - 4} y={s.y - 4} width={8} height={8} fill="#fff" stroke="#a855f7" strokeWidth={1} />; })}
            </g>
          );
        })()}
        {/* Area-text creation draft */}
        {textDraft && (() => {
          const x = Math.min(textDraft.start.x, textDraft.end.x);
          const y = Math.max(textDraft.start.y, textDraft.end.y);
          const w = Math.abs(textDraft.end.x - textDraft.start.x);
          const h = Math.abs(textDraft.end.y - textDraft.start.y);
          const tl = toScreen({ x, y });
          const br = toScreen({ x: x + w, y: y - h });
          return <rect x={Math.min(tl.x, br.x)} y={Math.min(tl.y, br.y)} width={Math.abs(br.x - tl.x)} height={Math.abs(br.y - tl.y)} fill="#a855f7" fillOpacity={0.06} stroke="#a855f7" strokeWidth={1} strokeDasharray="4 4" />;
        })()}

        {/* Nodes & handles (own contours only) */}
        <NodesLayer contours={work.contours} tool={tool} selPoints={selPoints} selContours={selContours} toScreen={toScreen} />

        {(tool === "select" || tool === "transform" || tool === "node" || tool === "pen") && selContours.map((ci) => (
          work.contours[ci] && !work.contours[ci].compound ? <path key={"sel" + ci} d={pathD(work.contours[ci], toScreen)} fill="none" stroke="#a855f7" strokeWidth={1.5} /> : null
        ))}
        {/* Wireframe guía de la figura mientras se dibuja con la Pluma:
            muestra el contorno del path en construcción a medida que se añaden
            puntos, para servir de guía de dibujo. */}
        {tool === "pen" && penDraft && work.contours[penDraft.contourIdx] && !work.contours[penDraft.contourIdx].compound && !selContours.includes(penDraft.contourIdx) && (
          <path key="pen-draft-wire" d={pathD(work.contours[penDraft.contourIdx], toScreen)} fill="none" stroke="#a855f7" strokeWidth={1.5} />
        )}
        {tool === "node" && nodeHoverContour != null && !selContours.includes(nodeHoverContour) && work.contours[nodeHoverContour] && !work.contours[nodeHoverContour].compound && (
          <path key={"hov" + nodeHoverContour} d={pathD(work.contours[nodeHoverContour], toScreen)} fill="none" stroke="#a855f7" strokeWidth={1} opacity={0.45} />
        )}
        {tool === "node" && selContours.length === 1 && work.contours[selContours[0]]?.compound && (() => {
          const ci = selContours[0];
          return work.contours[ci].compound.members.map((m, mi) => (
            <g key={"cm" + mi}>
              <path d={pathD(m, toScreen)} fill="none" stroke={mi === selCompoundMember ? "#f59e0b" : "#0ea5e9"} strokeWidth={1.5} strokeDasharray="3 2" />
              {m.points.map((p, pi) => { const s = toScreen(p); return <circle key={pi} cx={s.x} cy={s.y} r={2.5} fill={mi === selCompoundMember ? "#f59e0b" : "#0ea5e9"} />; })}
            </g>
          ));
        })()}
        {(tool === "penAdd" || tool === "penDelete" || tool === "penConvert") && work.contours.map((c, ci) => (
          <path key={"po" + ci} d={pathD(c, toScreen)} fill="none" stroke="#a855f7" strokeWidth={1} opacity={0.5} />
        ))}
        {tool === "penAdd" && penAddHit && (() => {
          const p = pointOnSeg(penAddHit);
          if (!p) return null;
          const s = toScreen(p);
          return (
            <g style={{ pointerEvents: "none" }}>
              <circle cx={s.x} cy={s.y} r={6} fill="#22c55e" stroke="#000" strokeWidth={1} opacity={0.9} />
              <text x={s.x} y={s.y + 4} fill="#fff" fontSize={11} fontWeight="bold" textAnchor="middle">+</text>
            </g>
          );
        })()}
        <PenPreviewLayer
          tool={tool}
          work={work}
          toScreen={toScreen}
          penHover={penHover}
          penDraft={penDraft}
          penCursor={penCursor}
          rubberBand={rubberBand}
          autoAddDelete={autoAddDelete}
          shiftHeld={shiftHeld}
          pointOnSeg={pointOnSeg}
          selContours={selContours}
        />
        {marquee && (() => {
          const a = toScreen({ x: Math.min(marquee.start.x, marquee.end.x), y: Math.max(marquee.start.y, marquee.end.y) });
          const b = toScreen({ x: Math.max(marquee.start.x, marquee.end.x), y: Math.min(marquee.start.y, marquee.end.y) });
          return <rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} fill="#a855f7" fillOpacity={0.08} stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" />;
        })()}
        {drag?.type === "gradientDraw" && (() => {
          const s = toScreen(drag.start), e2 = toScreen(drag.end);
          return (
            <g>
              <line x1={s.x} y1={s.y} x2={e2.x} y2={e2.y} stroke="#a855f7" strokeWidth={2} />
              <circle cx={s.x} cy={s.y} r={4} fill="#fff" stroke="#a855f7" strokeWidth={1.5} />
              <circle cx={e2.x} cy={e2.y} r={4} fill="#fff" stroke="#a855f7" strokeWidth={1.5} />
            </g>
          );
        })()}
        {tool === "node" && selSegments.map((s, si) => {
          const c = work.contours[s.contour];
          if (!c) return null;
          const a = c.points[s.seg], b = c.points[(s.seg + 1) % c.points.length];
          const as = toScreen(a), bs = toScreen(b);
          const c1s = toScreen(a.out || a), c2s = toScreen(b.in || b);
          const d = a.out || b.in ? `M ${as.x} ${as.y} C ${c1s.x} ${c1s.y} ${c2s.x} ${c2s.y} ${bs.x} ${bs.y}` : `M ${as.x} ${as.y} L ${bs.x} ${bs.y}`;
          return <path key={"seg" + si} d={d} fill="none" stroke="#f59e0b" strokeWidth={2.5} />;
        })}
        {snapGuides.map((g, i) => {
          if (g.axis === "h") { const s = toScreen({ x: 0, y: g.pos }); return <line key={"sg" + i} x1={0} y1={s.y} x2={8000} y2={s.y} stroke={g.typo ? "#10b981" : "#e879f9"} strokeWidth={1} opacity={0.9} />; }
          const s = toScreen({ x: g.pos, y: 0 }); return <line key={"sg" + i} x1={s.x} y1={0} x2={s.x} y2={8000} stroke="#e879f9" strokeWidth={1} opacity={0.9} />;
        })}
        {renderCornerWidgets()}
        {bboxG}
        {liveBBoxG}
        {subBBox && <SubSelectionBBox bb={subBBox} toScreen={toScreen} />}
      </svg>
      {editingTextFrameId && (() => {
        const f = (work.textFrames || []).find((tf) => tf.id === editingTextFrameId);
        if (!f) return null;
        return (
          <TextFrameEditor
            frame={f}
            toScreen={toScreen}
            zoom={zoom}
            metrics={metrics}
            loadedFonts={loadedFonts}
            onChange={(text) => {
              const textFrames = work.textFrames.map((tf) => (tf.id === f.id ? { ...tf, text } : tf));
              setWork({ ...work, textFrames });
            }}
            onCommit={() => { onCommit(work); setEditingTextFrameId(null); }}
          />
        );
      })()}
      {tool === "gradient" && selContours.length === 1 && isGradientFill(work.contours[selContours[0]]?.appearance?.fill) && !drag && (() => {
        const ci = selContours[0];
        const b = selBBox();
        if (!b) return null;
        return (
          <GradientAnnotator
            gradient={work.contours[ci].appearance.fill}
            bbox={b}
            pan={pan}
            zoom={zoom}
            onLive={applyGradientLive}
            onCommit={applyGradientCommit}
            onStyleChange={onGradientStyleChange}
            project={project}
            onProject={onProject}
          />
        );
      })()}
      </CanvasRulers>

      {tool === "pen" && (
        <DraggableFloatingBar storageKey="drfontstudio.bar.pen" zIndex={35}>
          <VectorToolBar
            subMode={subMode}
            onSetSubMode={setSubMode}
          />
        </DraggableFloatingBar>
      )}
      {tool === "node" && (selPoints.length || selSegments.length) && (
        <DraggableFloatingBar storageKey="drfontstudio.bar.node" zIndex={30}>
          <ContextualControlBar
            selPoints={selPoints}
            selSegments={selSegments}
            cornerRadius={currentCornerRadius()}
            hasHandlesVisible={hasHandlesVisible()}
            onConvertCorner={() => convertSelected(false)}
            onConvertSmooth={() => convertSelected(true)}
            onShowHandles={() => toggleHandles(true)}
            onHideHandles={() => toggleHandles(false)}
            onAddAnchor={addAnchorOnSegment}
            onRemoveAnchor={removeSelectedPoints}
            onCutPath={breakPath}
            onSetCorners={setCornersRadius}
          />
        </DraggableFloatingBar>
      )}
      {cornerDialog && (
        <CornerTypeDialog
          x={cornerDialog.x}
          y={cornerDialog.y}
          radius={cornerDialog.radius}
          type={cornerDialog.type}
          onApply={(ct, r) => {
            const set = cornerDialog.individual
              ? [{ contour: cornerDialog.ci, point: cornerDialog.pi }]
              : selContours.flatMap((ci) => (work.contours[ci]?.points || []).map((_, pi) => ({ contour: ci, point: pi })));
            const contours = work.contours.map((c, ci) => {
              const hole = computeIsHole(ci);
              const items = set.filter((s) => s.contour === ci && cornerInfo(c, s.point, hole));
              if (!items.length) return c;
              const pts = [...c.points];
              items.forEach((s) => { pts[s.point] = { ...pts[s.point], r: Math.max(0, r), ct }; });
              return { ...c, points: pts };
            });
            commitWork({ ...work, contours });
          }}
          onClose={() => setCornerDialog(null)}
        />
      )}

      {shapeDialog && (() => {
        const sp = toScreen({ x: shapeDialog.x, y: shapeDialog.y });
        return (
          <NumericShapeDialog
            tool={shapeDialog.tool}
            screenX={sp.x}
            screenY={sp.y}
            onSubmit={(vals) => {
              const lt = toolLiveType(shapeDialog.tool);
              const cx = shapeDialog.x, cy = shapeDialog.y;
              const x = cx - vals.width / 2, y = cy - vals.height / 2;
              let contour;
              if (lt) contour = makeLiveShape(lt, x, y, vals.width, vals.height, vals.params);
              else contour = shapeContour(shapeDialog.tool, x, y, vals.width, vals.height);
              commitWork({ ...work, contours: [...work.contours, contour] });
              setSelContours([work.contours.length]);
              setShapeDialog(null);
            }}
            onClose={() => setShapeDialog(null)}
          />
        );
      })()}

      <CanvasStatusBar workspaceMode={workspaceMode} glyph={glyph} work={work} zoom={zoom} artboard={artboard} onArtboardChange={onArtboardChange} rulerUnit={rulerUnit} setRulerUnit={setRulerUnit} />
    </div>
  );
}