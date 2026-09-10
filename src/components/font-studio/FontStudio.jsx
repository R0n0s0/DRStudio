import React, { useEffect, useRef, useState, useCallback } from "react";
import TopMenuBar from "./TopMenuBar";
import Toolbar from "./Toolbar";
import GlyphBrowser from "./GlyphBrowser";
import VectorCanvas from "./VectorCanvas";
import RightPanel from "./RightPanel";
import { MetadataDialog, AboutDialog } from "./Dialogs";

const ExportDialog = React.lazy(() => import("./ExportDialog"));
import { createNewProject, makeEmptyGlyph } from "@/font/glyphModel";
import { serializeProject, deserializeProject, downloadFile, readFileAsText, slugify, PROJECT_EXT } from "@/font/projectSerializer";
import { importSvgFile } from "@/font/svgImport";
import { transformContour, contourBounds } from "@/font/geometry";
import { runShapeShifter, validateContours, createCompound, expandCompounds, releaseCompound } from "@/font/booleanEngine";
import { getAppearance, setAppearance, buildGradientForBBox, DEFAULT_GRADIENT_STOPS } from "@/font/appearance";
import TypeControlBar from "./TypeControlBar";
import DraggableFloatingBar from "./DraggableFloatingBar";
import { createOutlines as createOutlinesFn } from "@/font/textOutlines";
import { defaultTextSettings, loadFontFile } from "@/font/textModel";
import toast, { Toaster } from "react-hot-toast";

const STORAGE_KEY = "drfontstudio.project";
const TOOL_KEYS = { v: "select", a: "node", p: "pen", n: "pencil", b: "brush", m: "rectangle", r: "roundedRect", c: "circle", l: "ellipse", t: "type", g: "gradient", s: "star", e: "transform", h: "hand", z: "zoom", i: "eyedropper" };

export default function FontStudio() {
  const [project, setProject] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return deserializeProject(saved);
    } catch {}
    return createNewProject();
  });
  const [currentChar, setCurrentChar] = useState("A");
  const [workspaceMode, setWorkspaceMode] = useState(() => {
    try { return localStorage.getItem("drfontstudio.mode") || "font"; } catch {}
    return "font";
  });
  useEffect(() => { try { localStorage.setItem("drfontstudio.mode", workspaceMode); } catch {} }, [workspaceMode]);
  const [tool, setTool] = useState("pen");
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 200, y: 500 });
  const [undo, setUndo] = useState([]);
  const [redo, setRedo] = useState([]);
  const [metaOpen, setMetaOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [previewState, setPreviewState] = useState({ text: "Hamburgefontsiv\nHello World\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789", size: 36, align: "left" });
  const [selContours, setSelContours] = useState([]);
  const [selPoints, setSelPoints] = useState([]);
  const [selSegments, setSelSegments] = useState([]);
  const [selCompoundMember, setSelCompoundMember] = useState(null);
  const [brushSize, setBrushSize] = useState(40);
  const [pressureEnabled, setPressureEnabled] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [rulerUnit, setRulerUnit] = useState(() => workspaceMode === "font" ? "fu" : "px");
  const [showBBox, setShowBBox] = useState(true);
  const [lockMargins, setLockMargins] = useState(() => {
    try { return localStorage.getItem("drfontstudio.lockMargins") === "1"; } catch {}
    return false;
  });
  useEffect(() => { try { localStorage.setItem("drfontstudio.lockMargins", lockMargins ? "1" : "0"); } catch {} }, [lockMargins]);
  const [canvasTheme, setCanvasTheme] = useState(() => {
    try { return localStorage.getItem("drfontstudio.canvasTheme") || "dark"; } catch {}
    return "dark";
  });
  useEffect(() => { try { localStorage.setItem("drfontstudio.canvasTheme", canvasTheme); } catch {} }, [canvasTheme]);
  const toggleCanvasTheme = () => setCanvasTheme((t) => (t === "dark" ? "light" : "dark"));
  const [autoAddDelete, setAutoAddDelete] = useState(() => { try { return localStorage.getItem("drfontstudio.autoAddDelete") !== "0"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("drfontstudio.autoAddDelete", autoAddDelete ? "1" : "0"); } catch {} }, [autoAddDelete]);
  const [rubberBand, setRubberBand] = useState(() => { try { return localStorage.getItem("drfontstudio.rubberBand") !== "0"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("drfontstudio.rubberBand", rubberBand ? "1" : "0"); } catch {} }, [rubberBand]);
  const [textDefaults, setTextDefaults] = useState(() => defaultTextSettings());
  const [loadedFonts, setLoadedFonts] = useState([]);
  const [selTextFrameId, setSelTextFrameId] = useState(null);
  const [editingTextFrameId, setEditingTextFrameId] = useState(null);
  const [panels, setPanels] = useState(() => {
    let loaded = null;
    try { const s = localStorage.getItem("drfontstudio.panels"); if (s) loaded = JSON.parse(s); } catch {}
    const defaults = [
      { id: "transform", label: "Transform", visible: true },
      { id: "appearance", label: "Appearance", visible: true },
      { id: "stroke", label: "Stroke", visible: true },
      { id: "shapeshifter", label: "Shape Shifter", visible: true },
      { id: "preview", label: "Preview", visible: true },
      { id: "layers", label: "Layers", visible: true },
      { id: "metrics", label: "Metrics", visible: true },
      { id: "kerning", label: "Kerning", visible: true },
    ];
    if (loaded) {
      loaded = loaded.filter((p) => p.id !== "pathfinder" && p.id !== "transparency"); // drop legacy panels
      const have = new Set(loaded.map((p) => p.id));
      defaults.forEach((d) => { if (!have.has(d.id)) loaded.push(d); });
      return loaded;
    }
    return defaults;
  });
  const [shapeShifterOptions, setShapeShifterOptions] = useState(() => {
    try { const s = localStorage.getItem("drfontstudio.shapeshifter"); if (s) return JSON.parse(s); } catch {}
    return { precision: 1, removeRedundant: true, removeUnpainted: false };
  });
  const [lastShapeShifterOp, setLastShapeShifterOp] = useState(null);
  useEffect(() => { try { localStorage.setItem("drfontstudio.shapeshifter", JSON.stringify(shapeShifterOptions)); } catch {} }, [shapeShifterOptions]);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  useEffect(() => { try { localStorage.setItem("drfontstudio.panels", JSON.stringify(panels)); } catch {} }, [panels]);
  const togglePanel = (id) => setPanels((ps) => ps.map((p) => p.id === id ? { ...p, visible: !p.visible } : p));
  const handleModeChange = (mode) => {
    setWorkspaceMode(mode);
    if (mode === "font") setRulerUnit("fu");
    else setRulerUnit("px");
  };
  const movePanel = (id, dir) => setPanels((ps) => {
    const i = ps.findIndex((p) => p.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ps.length) return ps;
    const n = [...ps]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const clipboard = useRef(null);
  const fileInput = useRef(null);
  const svgInput = useRef(null);

  // Autosave
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, serializeProject(project)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [project]);

  const glyph = project.glyphs[currentChar] || Object.values(project.glyphs)[0];

  // History: commit a new project state (called after edits)
  const commit = useCallback((nextProject) => {
    setUndo((u) => [...u.slice(-49), project]);
    setRedo([]);
    setProject(nextProject);
  }, [project]);

  // Update current glyph
  const updateGlyph = useCallback((newGlyph) => {
    const glyphs = { ...project.glyphs, [currentChar]: newGlyph };
    commit({ ...project, glyphs });
  }, [project, currentChar, commit]);

  const onCommitFromCanvas = useCallback((newGlyph) => {
    setProject((p) => {
      setUndo((u) => [...u.slice(-49), p]);
      setRedo([]);
      return { ...p, glyphs: { ...p.glyphs, [currentChar]: newGlyph } };
    });
  }, [currentChar]);

  // ---------- Fill & Stroke toolbar widget ----------
  const [fsFocus, setFsFocus] = useState("fill");
  const [lastSolid, setLastSolid] = useState(() => { try { return localStorage.getItem("drfontstudio.lastSolid") || "#000000"; } catch { return "#000000"; } });
  const [lastGradientStyle, setLastGradientStyle] = useState(() => {
    try { const s = localStorage.getItem("drfontstudio.lastGradientStyle"); if (s) return JSON.parse(s); } catch {}
    return { gradientType: "linear", stops: DEFAULT_GRADIENT_STOPS };
  });
  const fsOnGradientStyleChange = useCallback((style) => {
    setLastGradientStyle(style);
    try { localStorage.setItem("drfontstudio.lastGradientStyle", JSON.stringify(style)); } catch {}
  }, []);

  const fsApply = useCallback((patch) => {
    if (!selContours.length) return;
    const contours = glyph.contours.map((c, i) => (selContours.includes(i) ? setAppearance(c, patch) : c));
    updateGlyph({ ...glyph, contours });
  }, [glyph, selContours, updateGlyph]);

  const fsSwap = useCallback(() => {
    if (!selContours.length) return;
    const contours = glyph.contours.map((c, i) => {
      if (!selContours.includes(i)) return c;
      const a = getAppearance(c);
      return setAppearance(c, { fill: a.stroke, fillOpacity: a.strokeOpacity, stroke: a.fill, strokeOpacity: a.fillOpacity, strokeWidth: a.fill ? Math.max(a.strokeWidth, 1) : 0 });
    });
    updateGlyph({ ...glyph, contours });
  }, [glyph, selContours, updateGlyph]);

  const fsDefault = useCallback(() => {
    fsApply({ fill: "#FFFFFF", fillOpacity: 1, stroke: "#000000", strokeOpacity: 1, strokeWidth: 1 });
  }, [fsApply]);

  const fsColor = useCallback(() => {
    if (!selContours.length) return;
    if (fsFocus === "fill") { fsApply({ fill: lastSolid }); return; }
    const a0 = getAppearance(glyph.contours[selContours[0]]);
    fsApply({ stroke: lastSolid, strokeWidth: a0.strokeWidth > 0 ? a0.strokeWidth : 1 });
  }, [fsApply, fsFocus, lastSolid, glyph, selContours]);

  const fsGradient = useCallback(() => {
    if (!selContours.length) return;
    let b = null;
    selContours.forEach((i) => {
      const bb = contourBounds(glyph.contours[i]);
      if (!bb) return;
      b = b ? { minX: Math.min(b.minX, bb.minX), minY: Math.min(b.minY, bb.minY), maxX: Math.max(b.maxX, bb.maxX), maxY: Math.max(b.maxY, bb.maxY) } : bb;
    });
    if (!b) return;
    const grad = buildGradientForBBox(b, lastGradientStyle.gradientType, lastGradientStyle.stops);
    if (fsFocus === "fill") { fsApply({ fill: grad }); return; }
    const a0 = getAppearance(glyph.contours[selContours[0]]);
    fsApply({ stroke: grad, strokeWidth: a0.strokeWidth > 0 ? a0.strokeWidth : 1 });
  }, [fsApply, fsFocus, lastGradientStyle, glyph, selContours]);

  const fsNone = useCallback(() => {
    if (!selContours.length) return;
    if (fsFocus === "fill") fsApply({ fill: null });
    else fsApply({ stroke: null, strokeWidth: 0 });
  }, [fsApply, fsFocus]);

  const fsOnSolidPicked = useCallback((hex) => {
    setLastSolid(hex);
    try { localStorage.setItem("drfontstudio.lastSolid", hex); } catch {}
  }, []);

  const fillStroke = {
    focus: fsFocus, setFocus: setFsFocus, glyph, selContours, apply: fsApply,
    project, onProject: commit, swap: fsSwap, resetDefault: fsDefault,
    color: fsColor, gradient: fsGradient, none: fsNone, onSolidPicked: fsOnSolidPicked,
  };

  const updateMetrics = (metrics) => commit({ ...project, metrics });
  const resetMargins = useCallback(() => {
    const g = project.glyphs[currentChar];
    if (!g) return;
    commit({ ...project, glyphs: { ...project.glyphs, [currentChar]: { ...g, leftSideBearing: project.metrics.defaultLSB, advanceWidth: project.metrics.defaultAdvanceWidth, rightSideBearing: project.metrics.defaultRSB } } });
    toast("Margins reset");
  }, [project, currentChar, commit]);
  const setArtboard = (patch) => commit({ ...project, artboard: { ...(project.artboard || { width: 1080, height: 1080 }), ...patch } });

  // Margin handle drag: live update without pushing undo history on every
  // pointer move; push a single undo entry on release (isFinal).
  const onMarginChange = useCallback((key, value, isFinal) => {
    setProject((p) => {
      if (isFinal) { setUndo((u) => [...u.slice(-49), p]); setRedo([]); }
      if (key === "leftSideBearing" || key === "advanceWidth") {
        const g = p.glyphs[currentChar];
        if (!g) return p;
        return { ...p, glyphs: { ...p.glyphs, [currentChar]: { ...g, [key]: value } } };
      }
      return { ...p, metrics: { ...p.metrics, [key]: value } };
    });
  }, [currentChar]);

  const undoAction = () => {
    if (!undo.length) return;
    setRedo((r) => [project, ...r]);
    setProject(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
  };
  const redoAction = () => {
    if (!redo.length) return;
    setUndo((u) => [...u, project]);
    setProject(redo[0]);
    setRedo(redo.slice(1));
  };

  const fit = () => {
    setZoom(0.6); setPan({ x: 200, y: 500 });
  };
  const zoomIn = () => setZoom((z) => Math.min(8, z * 1.3));
  const zoomOut = () => setZoom((z) => Math.max(0.1, z / 1.3));

  const newProject = () => {
    if (!confirm("Start a new font project? Unsaved changes will be lost.")) return;
    setUndo([]); setRedo([]);
    setProject(createNewProject());
    setCurrentChar("A");
    toast("New project created");
  };

  const saveProject = () => {
    downloadFile(`${slugify(project.metadata.fontName)}${PROJECT_EXT}`, serializeProject(project), "application/json");
    toast("Project saved");
  };
  const saveProjectAs = () => {
    const name = prompt("Save project as:", project.metadata.fontName);
    if (!name) return;
    const meta = { ...project.metadata, fontName: name };
    downloadFile(`${slugify(name)}${PROJECT_EXT}`, serializeProject({ ...project, metadata: meta }), "application/json");
    toast(`Project saved as "${name}"`);
  };

  const openProject = () => fileInput.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const p = deserializeProject(text);
      setUndo([]); setRedo([]);
      setProject(p);
      setCurrentChar("A");
      toast("Project opened");
    } catch (err) {
      toast.error("Could not open project file");
    }
    e.target.value = "";
  };

  const onSvgFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = importSvgFile(text, project.metrics);
      if (res.error) { toast.error(res.error); return; }
      if (!res.contours.length) { toast.error("No vector paths found."); return; }
      updateGlyph({ ...glyph, contours: res.contours, leftSideBearing: res.leftSideBearing, advanceWidth: res.advanceWidth });
      setSelContours([]); setSelPoints([]); setSelSegments([]);
      toast.success(`Imported ${res.contours.length} contour(s) into "${currentChar}"`);
    } catch (err) {
      toast.error("Could not import SVG file.");
    }
    e.target.value = "";
  };

  const deleteSelection = () => {
    if (!selContours.length) return;
    const contours = glyph.contours.filter((_, i) => !selContours.includes(i));
    updateGlyph({ ...glyph, contours });
    setSelContours([]);
  };

  const flip = (axis) => {
    if (!glyph) return;
    const m = project.metrics;
    const axisY = m.capHeight / 2;
    const axisX = (glyph.leftSideBearing + glyph.advanceWidth - glyph.rightSideBearing) / 2;
    const contours = glyph.contours.map((c) =>
      axis === "h"
        ? transformContour(c, (x, y) => ({ x: 2 * axisX - x, y }))
        : transformContour(c, (x, y) => ({ x, y: 2 * axisY - y }))
    );
    updateGlyph({ ...glyph, contours });
  };

  const newGlyph = () => {
    const ch = prompt("Enter a character for the new glyph:");
    if (!ch) return;
    if (project.glyphs[ch]) { setCurrentChar(ch); return; }
    const g = makeEmptyGlyph(ch, ch.codePointAt(0), project.metrics);
    commit({ ...project, glyphs: { ...project.glyphs, [ch]: g } });
    setCurrentChar(ch);
  };
  const duplicateGlyph = () => {
    const ch = prompt("Duplicate current glyph into which character?");
    if (!ch) return;
    commit({ ...project, glyphs: { ...project.glyphs, [ch]: { ...JSON.parse(JSON.stringify(glyph)), char: ch, unicode: ch.codePointAt(0) } } });
    setCurrentChar(ch);
  };
  const clearGlyph = () => {
    if (!confirm(`Clear glyph "${currentChar}"?`)) return;
    updateGlyph({ ...glyph, contours: [], components: [] });
  };

  const copyAction = () => {
    if (selPoints.length) {
      // Copy selected points grouped by contour as open path fragments (preserving handles)
      const byContour = {};
      selPoints.forEach((s) => { (byContour[s.contour] ||= []).push(s.point); });
      const frags = [];
      Object.keys(byContour).forEach((ci) => {
        const c = glyph.contours[ci];
        const idxs = byContour[ci].sort((a, b) => a - b);
        frags.push({ closed: false, points: idxs.map((pi) => JSON.parse(JSON.stringify(c.points[pi]))) });
      });
      clipboard.current = { fragments: frags };
    } else if (selContours.length) {
      clipboard.current = { contours: selContours.map((i) => JSON.parse(JSON.stringify(glyph.contours[i]))) };
    } else {
      clipboard.current = JSON.parse(JSON.stringify(glyph));
    }
    toast("Copied");
  };
  const cutAction = () => {
    if (selContours.length) {
      clipboard.current = { contours: selContours.map((i) => JSON.parse(JSON.stringify(glyph.contours[i]))) };
      const contours = glyph.contours.filter((_, i) => !selContours.includes(i));
      updateGlyph({ ...glyph, contours });
      setSelContours([]);
    } else {
      clipboard.current = JSON.parse(JSON.stringify(glyph));
      clearGlyph();
    }
    toast("Cut");
  };
  const pasteAction = () => {
    if (!clipboard.current) return;
    if (clipboard.current.fragments) {
      const start = glyph.contours.length;
      const contours = [...glyph.contours, ...clipboard.current.fragments.map((c) => JSON.parse(JSON.stringify(c)))];
      updateGlyph({ ...glyph, contours });
      setSelContours(contours.map((_, i) => i).filter((i) => i >= start));
    } else if (clipboard.current.contours) {
      const start = glyph.contours.length;
      const contours = [...glyph.contours, ...clipboard.current.contours.map((c) => JSON.parse(JSON.stringify(c)))];
      updateGlyph({ ...glyph, contours });
      setSelContours(contours.map((_, i) => i).filter((i) => i >= start));
    } else {
      updateGlyph({ ...JSON.parse(JSON.stringify(clipboard.current)), char: currentChar, unicode: glyph.unicode });
    }
    toast("Pasted");
  };
  const deleteAction = () => {
    if (selContours.length) {
      const contours = glyph.contours.filter((_, i) => !selContours.includes(i));
      updateGlyph({ ...glyph, contours });
      setSelContours([]);
    } else {
      clearGlyph();
    }
  };
  const duplicateSelection = () => {
    if (!selContours.length) return;
    const contours = [...glyph.contours];
    const newIdxs = [];
    selContours.forEach((i) => {
      const copy = transformContour(JSON.parse(JSON.stringify(glyph.contours[i])), (x, y) => ({ x: x + 10, y: y + 10 }));
      contours.push(copy);
      newIdxs.push(contours.length - 1);
    });
    updateGlyph({ ...glyph, contours });
    setSelContours(newIdxs);
  };

  const PRECISION_STEPS = [10, 20, 40, 80];
  const shapeShifterOpLabels = { unite: "Unite", minusFront: "Minus Front", intersect: "Intersect", exclude: "Exclude", divide: "Divide", trim: "Trim", merge: "Merge", crop: "Crop", outline: "Outline", minusBack: "Minus Back" };

  const runShapeShifterOp = (op) => {
    if (selContours.length < 2) { toast.error("Select two or more objects."); return; }
    const ordered = [...selContours].sort((a, b) => a - b);
    const selected = ordered.map((i) => glyph.contours[i]).filter(Boolean);
    const steps = PRECISION_STEPS[shapeShifterOptions.precision] || 20;
    let result;
    try {
      result = runShapeShifter(selected, op, { steps, removeRedundant: true, removeUnpainted: shapeShifterOptions.removeUnpainted });
    } catch (err) {
      toast.error("These objects cannot be combined with this operation.");
      return;
    }
    if (!result.contours.length) {
      (result.warnings || []).forEach((w) => toast(w, { icon: "⚠️" }));
      toast.error("No result — the operation produced no geometry.");
      return;
    }
    const selSet = new Set(ordered);
    const base = glyph.contours.filter((_, i) => !selSet.has(i));
    const startIdx = base.length;
    const contours = [...base, ...result.contours];
    updateGlyph({ ...glyph, contours });
    setSelContours(result.contours.map((_, k) => startIdx + k));
    setSelPoints([]); setSelSegments([]); setSelCompoundMember(null);
    setLastShapeShifterOp(op);
    const issues = validateContours(result.contours);
    if (issues.length) toast(`Shape Shifter: ${issues.length} geometry notice(s)`, { icon: "⚠️" });
    else toast(`${shapeShifterOpLabels[op] || op} applied`);
    (result.warnings || []).slice(0, 1).forEach((w) => toast(w, { icon: "⚠️" }));
  };

  const repeatShapeShifter = () => { if (lastShapeShifterOp) runShapeShifterOp(lastShapeShifterOp); };

  // Alt-click a Shape Mode: create a non-destructive Compound Shape.
  const makeCompound = (op) => {
    if (selContours.length < 2) { toast.error("Select two or more objects."); return; }
    const ordered = [...selContours].sort((a, b) => a - b);
    const selected = ordered.map((i) => glyph.contours[i]).filter(Boolean);
    const frontAp = selected[selected.length - 1]?.appearance;
    const compound = createCompound(selected, op, frontAp);
    const selSet = new Set(ordered);
    const base = glyph.contours.filter((_, i) => !selSet.has(i));
    const startIdx = base.length;
    const contours = [...base, compound];
    updateGlyph({ ...glyph, contours });
    setSelContours([startIdx]);
    setSelPoints([]); setSelSegments([]); setSelCompoundMember(null);
    toast.success(`Compound Shape (${shapeShifterOpLabels[op] || op}) created`);
  };

  // Bake the selected compound into a static boolean result.
  const expandCompound = () => {
    const ci = selContours[0];
    const c = ci != null ? glyph.contours[ci] : null;
    if (!c || !c.compound) { toast.error("Select a compound shape to expand."); return; }
    const baked = expandCompounds([c]);
    if (!baked.length) { toast.error("Compound produced no geometry."); return; }
    const contours = glyph.contours.map((cc, i) => (i === ci ? null : cc)).filter(Boolean);
    const startIdx = contours.length;
    contours.push(...baked);
    updateGlyph({ ...glyph, contours });
    setSelContours(baked.map((_, k) => startIdx + k));
    setSelCompoundMember(null);
    toast.success(`Expanded to ${baked.length} path(s)`);
  };

  // Release the selected compound back into its member objects.
  const releaseCompoundShape = () => {
    const ci = selContours[0];
    const c = ci != null ? glyph.contours[ci] : null;
    if (!c || !c.compound) { toast.error("Select a compound shape to release."); return; }
    const members = releaseCompound(c);
    const contours = glyph.contours.map((cc, i) => (i === ci ? null : cc)).filter(Boolean);
    const startIdx = contours.length;
    contours.push(...members);
    updateGlyph({ ...glyph, contours });
    setSelContours(members.map((_, k) => startIdx + k));
    setSelCompoundMember(null);
    toast(`Released into ${members.length} object(s)`);
  };

  const createOutlines = async () => {
    const f = (glyph.textFrames || []).find((tf) => tf.id === selTextFrameId);
    if (!f) { toast.error("Select a text frame to outline."); return; }
    const res = await createOutlinesFn(f, project, loadedFonts);
    if (res.error) { toast.error(res.error); return; }
    if (!res.contours.length) { toast.error("No outlines generated."); return; }
    const textFrames = (glyph.textFrames || []).filter((tf) => tf.id !== selTextFrameId);
    const startIdx = glyph.contours.length;
    const contours = [...glyph.contours, ...res.contours];
    updateGlyph({ ...glyph, contours, textFrames });
    setSelTextFrameId(null);
    setEditingTextFrameId(null);
    setSelContours(res.contours.map((_, i) => startIdx + i));
    toast.success(`Created ${res.contours.length} outline paths`);
  };

  const ungroupOutlines = () => {
    if (!selContours.length) { toast.error("Select outlined objects first."); return; }
    const contours = glyph.contours.map((c, i) => (selContours.includes(i) ? { ...c, group: undefined } : c));
    updateGlyph({ ...glyph, contours });
    toast("Ungrouped");
  };

  const onLoadFont = async (file) => {
    try {
      const lf = await loadFontFile(file);
      setLoadedFonts((prev) => [...prev, lf]);
      toast.success(`Loaded ${lf.name}`);
    } catch (err) { toast.error("Could not load font file."); }
  };

  const onAction = (action) => {
    switch (action) {
      case "new": newProject(); break;
      case "open": openProject(); break;
      case "save": saveProject(); break;
      case "saveAs": saveProjectAs(); break;
      case "export": setExportOpen(true); break;
      case "exit": window.close(); break;
      case "undo": undoAction(); break;
      case "redo": redoAction(); break;
      case "cut": cutAction(); break;
      case "copy": copyAction(); break;
      case "paste": pasteAction(); break;
      case "delete": deleteAction(); break;
      case "duplicate": duplicateSelection(); break;
      case "zoomIn": zoomIn(); break;
      case "zoomOut": zoomOut(); break;
      case "fit": fit(); break;
      case "toggleGrid": commit({ ...project, guides: { ...project.guides, showGrid: !project.guides.showGrid } }); break;
      case "toggleGuides": commit({ ...project, guides: { ...project.guides, showGuides: !project.guides.showGuides } }); break;
      case "newGlyph": newGlyph(); break;
      case "duplicateGlyph": duplicateGlyph(); break;
      case "clearGlyph": clearGlyph(); break;
      case "importSvg": svgInput.current?.click(); break;
      case "about": setAboutOpen(true); break;
      case "metadata": setMetaOpen(true); break;
      case "createOutlines": createOutlines(); break;
      case "ungroupOutlines": ungroupOutlines(); break;
      default:
        if (action.startsWith("shapeshifter:")) runShapeShifterOp(action.split(":")[1]);
        else if (action === "shapeshifterRepeat") repeatShapeShifter();
        else if (action === "compoundExpand") expandCompound();
        else if (action === "compoundRelease") releaseCompoundShape();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); e.shiftKey ? redoAction() : undoAction(); return; }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "S" || e.key === "s")) { e.preventDefault(); saveProjectAs(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveProject(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "c") { e.preventDefault(); copyAction(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "v") { e.preventDefault(); pasteAction(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") { e.preventDefault(); setShowRulers((v) => !v); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") { e.preventDefault(); duplicateSelection(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "x") { e.preventDefault(); cutAction(); return; }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "B" || e.key === "b")) { e.preventDefault(); setShowBBox((v) => !v); return; }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "O" || e.key === "o")) { e.preventDefault(); createOutlines(); return; }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F9") { e.preventDefault(); togglePanel("shapeshifter"); return; }
      // Fill & Stroke toolbar accelerators (no modifiers, not while editing text)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.target.isContentEditable) {
        const lk = e.key.toLowerCase();
        if (lk === "x") { e.preventDefault(); if (e.shiftKey) fsSwap(); else setFsFocus((f) => (f === "fill" ? "stroke" : "fill")); return; }
        if (lk === "d" && !e.shiftKey) { e.preventDefault(); fsDefault(); return; }
        if (e.key === ",") { e.preventDefault(); fsColor(); return; }
        if (e.key === ".") { e.preventDefault(); fsGradient(); return; }
        if (e.key === "/") { e.preventDefault(); fsNone(); return; }
      }
      // Vector Tool (P) handles add/delete/convert contextually — no separate tools.
      if (e.key in TOOL_KEYS && !e.metaKey && !e.ctrlKey) setTool(TOOL_KEYS[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Paste vectors from clipboard (SVG). Illustrator's native copy places PDF/AICB
  // on the clipboard, which browsers cannot read as vector paths — copy as SVG
  // (Illustrator "Copy as SVG" / SVG markup, or from Figma/Affinity) to paste here.
  useEffect(() => {
    const readSvg = async (cd) => {
      if (!cd) return null;
      for (const item of cd.items || []) {
        const t = item.type || "";
        if (t === "image/svg+xml" || t === "text/svg" || t === "application/svg+xml") {
          if (item.kind === "file") return await item.getAsFile()?.text();
          return await new Promise((r) => item.getAsString(r));
        }
      }
      const text = cd.getData("text/plain") || "";
      return text.includes("<svg") ? text : null;
    };
    const onPaste = async (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const svg = await readSvg(e.clipboardData);
      if (!svg) return;
      const res = importSvgFile(svg, project.metrics);
      if (res.error) { toast.error(res.error); return; }
      if (!res.contours.length) { toast.error("No vector paths on clipboard."); return; }
      const startIdx = glyph.contours.length;
      const contours = [...glyph.contours, ...res.contours];
      updateGlyph({ ...glyph, contours });
      setSelContours(res.contours.map((_, i) => startIdx + i));
      setSelPoints([]); setSelSegments([]);
      toast.success(`Pasted ${res.contours.length} contour(s)`);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [glyph, project.metrics, updateGlyph]);

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-white overflow-hidden font-sans">
      <TopMenuBar
        onAction={onAction}
        fillStroke={fillStroke}
        canUndo={undo.length > 0}
        canRedo={redo.length > 0}
        showGrid={project.guides.showGrid}
        showGuides={project.guides.showGuides}
        panels={panels}
        onTogglePanel={togglePanel}
        toolbarVisible={toolbarVisible}
        onToggleToolbar={() => setToolbarVisible((v) => !v)}
        showBBox={showBBox}
        onToggleBBox={() => setShowBBox((v) => !v)}
        workspaceMode={workspaceMode}
        onModeChange={handleModeChange}
        canvasTheme={canvasTheme}
        onToggleCanvasTheme={toggleCanvasTheme}
        artboard={project.artboard}
        onArtboardChange={setArtboard}
        rulerUnit={rulerUnit}
        onRulerUnitChange={setRulerUnit}
        onExport={() => setExportOpen(true)}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers((v) => !v)}
        lockMargins={lockMargins}
        onToggleLockMargins={() => setLockMargins((v) => !v)}
        onResetMargins={resetMargins}
        autoAddDelete={autoAddDelete}
        onToggleAutoAddDelete={() => setAutoAddDelete((v) => !v)}
        rubberBand={rubberBand}
        onToggleRubberBand={() => setRubberBand((v) => !v)}
      />
      <div className="flex-1 flex overflow-hidden">
        {workspaceMode === "font" && <GlyphBrowser glyphs={project.glyphs} metrics={project.metrics} currentChar={currentChar} onSelect={setCurrentChar} onNewProject={() => onAction("new")} />}
        {toolbarVisible && <Toolbar tool={tool} setTool={setTool} onFlip={flip} onDelete={deleteSelection} brushSize={brushSize} setBrushSize={setBrushSize} pressureEnabled={pressureEnabled} setPressureEnabled={setPressureEnabled} fillStroke={fillStroke} />}
        <div className="relative flex-1 flex min-w-0">
        <VectorCanvas
          glyph={glyph}
          glyphs={project.glyphs}
          metrics={project.metrics}
          tool={tool}
          showGrid={project.guides.showGrid}
          showGuides={project.guides.showGuides}
          zoom={zoom}
          pan={pan}
          setZoom={setZoom}
          setPan={setPan}
          onCommit={onCommitFromCanvas}
          onGlyphChange={updateGlyph}
          selContours={selContours}
          setSelContours={setSelContours}
          selPoints={selPoints}
          setSelPoints={setSelPoints}
          selSegments={selSegments}
          setSelSegments={setSelSegments}
          selCompoundMember={selCompoundMember}
          setSelCompoundMember={setSelCompoundMember}
          brushSize={brushSize}
          pressureEnabled={pressureEnabled}
          showBBox={showBBox}
          showRulers={showRulers}
          rulerUnit={rulerUnit}
          setRulerUnit={setRulerUnit}
          selTextFrameId={selTextFrameId}
          setSelTextFrameId={setSelTextFrameId}
          editingTextFrameId={editingTextFrameId}
          setEditingTextFrameId={setEditingTextFrameId}
          textDefaults={textDefaults}
          loadedFonts={loadedFonts}
          artboard={project.artboard}
          onArtboardChange={setArtboard}
          workspaceMode={workspaceMode}
          canvasTheme={canvasTheme}
          onGradientStyleChange={fsOnGradientStyleChange}
          project={project}
          onProject={commit}
          lockMargins={lockMargins}
          onMarginChange={onMarginChange}
          autoAddDelete={autoAddDelete}
          onToggleAutoAddDelete={() => setAutoAddDelete((v) => !v)}
          rubberBand={rubberBand}
          onToggleRubberBand={() => setRubberBand((v) => !v)}
        />
        {(tool === "type" || selTextFrameId) && (
          <DraggableFloatingBar storageKey="drfontstudio.bar.type" zIndex={40}>
            <TypeControlBar
              frame={(glyph.textFrames || []).find((tf) => tf.id === selTextFrameId)}
              defaults={textDefaults}
              loadedFonts={loadedFonts}
              onUpdate={(patch) => {
                const textFrames = (glyph.textFrames || []).map((tf) => (tf.id === selTextFrameId ? { ...tf, ...patch } : tf));
                updateGlyph({ ...glyph, textFrames });
              }}
              onUpdateDefaults={(patch) => setTextDefaults((d) => ({ ...d, ...patch }))}
              onLoadFont={onLoadFont}
              onCreateOutlines={createOutlines}
              onUngroup={ungroupOutlines}
              canCreateOutlines={!!selTextFrameId}
              canUngroup={selContours.some((i) => glyph.contours[i]?.group)}
              hasTextSelection={!!selTextFrameId}
            />
          </DraggableFloatingBar>
        )}
        </div>
        <RightPanel
          project={project}
          glyph={glyph}
          onMetrics={updateMetrics}
          onGlyph={updateGlyph}
          onProject={commit}
          onKerning={(k) => commit({ ...project, kerning: k })}
          previewState={previewState}
          setPreviewState={setPreviewState}
          selContours={selContours}
          onSelectContours={setSelContours}
          selPoints={selPoints}
          selSegments={selSegments}
          panels={panels}
          onTogglePanel={togglePanel}
          onMovePanel={movePanel}
          shapeshifter={{
            onRun: (op, alt) => alt ? makeCompound(op) : runShapeShifterOp(op),
            lastOp: lastShapeShifterOp ? shapeShifterOpLabels[lastShapeShifterOp] : null,
            onRepeat: repeatShapeShifter,
            options: shapeShifterOptions,
            setOptions: setShapeShifterOptions,
            selectionCount: selContours.length,
            frontmostLabel: selContours.length ? `#${Math.max(...selContours) + 1}` : "—",
            backmostLabel: selContours.length ? `#${Math.min(...selContours) + 1}` : "—",
            hasCompound: selContours.length === 1 && !!glyph.contours[selContours[0]]?.compound,
            compoundOp: selContours.length === 1 && glyph.contours[selContours[0]]?.compound ? shapeShifterOpLabels[glyph.contours[selContours[0]].compound.op] : null,
            onExpand: expandCompound,
            onRelease: releaseCompoundShape,
          }}
          rulerUnit={rulerUnit}
          workspaceMode={workspaceMode}
        />
      </div>
      <input ref={fileInput} type="file" accept=".dr,.drfontproj,application/json" className="hidden" onChange={onFile} />
      <input ref={svgInput} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={onSvgFile} />
      {metaOpen && <MetadataDialog metadata={project.metadata} onChange={(m) => { commit({ ...project, metadata: m }); }} onClose={() => setMetaOpen(false)} />}
      {exportOpen && <React.Suspense fallback={null}><ExportDialog project={project} currentChar={currentChar} selContours={selContours} loadedFonts={loadedFonts} onMetadata={(m) => commit({ ...project, metadata: m })} onClose={() => setExportOpen(false)} onToast={(m) => toast(m)} workspaceMode={workspaceMode} /></React.Suspense>}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      <Toaster position="bottom-center" toastOptions={{ style: { background: "#262626", color: "#fff", border: "1px solid #404040", fontSize: "13px" } }} />
    </div>
  );
}