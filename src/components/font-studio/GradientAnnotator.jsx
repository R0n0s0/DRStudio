import React, { useCallback, useEffect, useRef, useState } from "react";
import ColorPicker from "./ColorPicker";
import { expandStopsForRender } from "@/font/appearance";

let _idc = 0;
const ensureIds = (g) => {
  if (!g || !g.stops) return g;
  let changed = false;
  const stops = g.stops.map((s) => {
    if (s._id != null) return s;
    changed = true;
    return { ...s, _id: "gs" + (_idc++) };
  });
  return changed ? { ...g, stops } : g;
};

function pointsFromBBox(g, b) {
  if (!b) return g;
  const midX = (b.minX + b.maxX) / 2, midY = (b.minY + b.maxY) / 2;
  const r = Math.max((b.maxX - b.minX), (b.maxY - b.minY)) / 2 || 100;
  if (g.gradientType === "radial") return { ...g, cx: midX, cy: midY, r, fx: midX, fy: midY, aspectRatio: g.aspectRatio ?? 1 };
  return { ...g, x1: b.minX, y1: midY, x2: b.maxX, y2: midY };
}

const hasPoints = (g) => g && (g.x1 != null || g.cx != null);

export default function GradientAnnotator({ gradient, bbox, pan, zoom, onLive, onCommit, onStyleChange, project, onProject }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [activeStopId, setActiveStopId] = useState(null);
  const [picker, setPicker] = useState(null);

  const stateRef = useRef({});
  stateRef.current = { pan, zoom, grad: gradient, onLive, onCommit, onStyleChange };

  // Convert legacy angle-based gradients to points-based once.
  useEffect(() => {
    if (gradient && !hasPoints(gradient) && bbox) {
      const converted = pointsFromBBox(gradient, bbox);
      stateRef.current.onLive(converted);
      stateRef.current.onCommit(converted);
    }
  }, [gradient, bbox]);

  const grad = ensureIds(hasPoints(gradient) ? gradient : (bbox ? pointsFromBBox(gradient, bbox) : gradient));
  stateRef.current.grad = grad;

  const toScreen = (p) => ({ x: p.x * zoom + pan.x, y: -p.y * zoom + pan.y });

  const isLinear = grad.gradientType !== "radial";
  const start = isLinear ? { x: grad.x1, y: grad.y1 } : { x: grad.cx, y: grad.cy };
  const end = isLinear ? { x: grad.x2, y: grad.y2 } : { x: grad.cx + grad.r, y: grad.cy };
  const ss = toScreen(start), se = toScreen(end);

  const stopPos = (s) => ({ x: start.x + (end.x - start.x) * (s.offset || 0), y: start.y + (end.y - start.y) * (s.offset || 0) });

  const sortedStops = [...grad.stops].sort((a, b) => (a.offset || 0) - (b.offset || 0));
  const activeStop = sortedStops.find((s) => s._id === activeStopId) || null;

  const commit = useCallback((next) => {
    stateRef.current.onLive(next);
    stateRef.current.onCommit(next);
    stateRef.current.onStyleChange({ gradientType: next.gradientType, stops: next.stops });
  }, []);

  const moveFor = useCallback((d, p) => {
    const g = stateRef.current.grad;
    const update = (next) => { stateRef.current.onLive(next); dragRef.current = { ...dragRef.current, lastGrad: next }; };
    if (d.kind === "start") return update({ ...g, x1: p.x, y1: p.y });
    if (d.kind === "end") return update({ ...g, x2: p.x, y2: p.y });
    if (d.kind === "center") {
      const dx = p.x - g.cx, dy = p.y - g.cy;
      return update({ ...g, cx: p.x, cy: p.y, fx: (g.fx ?? g.cx) + dx, fy: (g.fy ?? g.cy) + dy });
    }
    if (d.kind === "radius") return update({ ...g, r: Math.max(1, Math.hypot(p.x - g.cx, p.y - g.cy)) });
    if (d.kind === "focal") return update({ ...g, fx: p.x, fy: p.y });
    if (d.kind === "aspect") return update({ ...g, aspectRatio: Math.max(0.1, Math.min(10, (p.y - g.cy) / (g.r || 1))) });
    if (d.kind === "stop") {
      let t;
      if (g.gradientType === "radial") t = (p.x - g.cx) / (g.r || 1);
      else {
        const dx = (g.x2 || 0) - (g.x1 || 0), dy = (g.y2 || 0) - (g.y1 || 0);
        t = ((p.x - (g.x1 || 0)) * dx + (p.y - (g.y1 || 0)) * dy) / (dx * dx + dy * dy || 1e-6);
      }
      t = Math.max(0, Math.min(1, t));
      return update({ ...g, stops: g.stops.map((s) => (s._id === d.stopId ? { ...s, offset: t } : s)) });
    }
    if (d.kind === "midpoint") {
      let t;
      if (g.gradientType === "radial") t = (p.x - g.cx) / (g.r || 1);
      else {
        const dx = (g.x2 || 0) - (g.x1 || 0), dy = (g.y2 || 0) - (g.y1 || 0);
        t = ((p.x - (g.x1 || 0)) * dx + (p.y - (g.y1 || 0)) * dy) / (dx * dx + dy * dy || 1e-6);
      }
      const a = g.stops[d.i], b = g.stops[d.i + 1];
      if (!a || !b) return;
      const span = (b.offset || 0) - (a.offset || 0) || 1e-6;
      const m = Math.max(0.05, Math.min(0.95, (t - (a.offset || 0)) / span));
      return update({ ...g, stops: g.stops.map((s, idx) => (idx === d.i ? { ...s, midpoint: m } : s)) });
    }
  }, []);

  // Pointer + key listeners
  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const st = stateRef.current;
      const r = svgRef.current.getBoundingClientRect();
      const p = { x: (e.clientX - r.left - st.pan.x) / st.zoom, y: -((e.clientY - r.top - st.pan.y) / st.zoom) };
      moveFor(d, p);
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.lastGrad) {
        stateRef.current.onCommit(d.lastGrad);
        stateRef.current.onStyleChange({ gradientType: d.lastGrad.gradientType, stops: d.lastGrad.stops });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [moveFor]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      if ((e.key === "Delete" || e.key === "Backspace") && activeStopId != null) {
        const g = stateRef.current.grad;
        if (!g || g.stops.length <= 2) return;
        e.preventDefault();
        const stops = g.stops.filter((s) => s._id !== activeStopId);
        commit({ ...g, stops });
        setActiveStopId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStopId, commit]);

  const startDrag = (kind, extra) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { kind, ...extra };
  };

  const onStopDown = (s, idx) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.altKey) {
      const g = stateRef.current.grad;
      const newStop = { ...s, _id: "gs" + (_idc++), offset: Math.max(0, Math.min(1, (s.offset || 0) + 0.001)) };
      const stops = [...g.stops];
      stops.splice(idx + 1, 0, newStop);
      stateRef.current.onLive({ ...g, stops });
      setActiveStopId(newStop._id);
      dragRef.current = { kind: "stop", stopId: newStop._id };
      return;
    }
    setActiveStopId(s._id);
    dragRef.current = { kind: "stop", stopId: s._id };
  };

  const onStopDouble = (s) => (e) => {
    e.stopPropagation();
    setActiveStopId(s._id);
    setPicker({ stopId: s._id, value: { hex: s.color, alpha: s.opacity ?? 1 }, original: { hex: s.color, alpha: s.opacity ?? 1 }, nonce: Date.now() });
  };

  const updateStopColor = (stopId, hex, alpha, doCommit) => {
    const g = stateRef.current.grad;
    const stops = g.stops.map((s) => (s._id === stopId ? { ...s, color: hex, opacity: alpha } : s));
    const next = { ...g, stops };
    stateRef.current.onLive(next);
    if (doCommit) commit(next);
  };

  const setType = (kind) => {
    const g = stateRef.current.grad;
    let next;
    if (kind === "radial" && g.gradientType !== "radial") {
      const midX = (bbox.minX + bbox.maxX) / 2, midY = (bbox.minY + bbox.maxY) / 2;
      const r = Math.max((bbox.maxX - bbox.minX), (bbox.maxY - bbox.minY)) / 2 || 100;
      next = { ...g, gradientType: "radial", cx: midX, cy: midY, r, fx: midX, fy: midY, aspectRatio: 1 };
    } else if (kind === "linear" && g.gradientType === "radial") {
      next = { ...g, gradientType: "linear", x1: bbox.minX, y1: (bbox.minY + bbox.maxY) / 2, x2: bbox.maxX, y2: (bbox.minY + bbox.maxY) / 2 };
    } else return;
    commit(next);
  };

  const reverse = () => {
    const g = stateRef.current.grad;
    const stops = [...g.stops].reverse().map((s) => ({ ...s, offset: 1 - (s.offset || 0) }));
    commit({ ...g, stops });
  };

  const deleteActive = () => {
    const g = stateRef.current.grad;
    if (!g || g.stops.length <= 2 || !activeStopId) return;
    commit({ ...g, stops: g.stops.filter((s) => s._id !== activeStopId) });
    setActiveStopId(null);
  };

  const setActiveLoc = (val) => {
    if (!activeStop) return;
    const g = stateRef.current.grad;
    const t = Math.max(0, Math.min(1, (val || 0) / 100));
    const stops = g.stops.map((s) => (s._id === activeStop._id ? { ...s, offset: t } : s));
    stateRef.current.onLive({ ...g, stops });
  };

  const barStops = expandStopsForRender(grad.stops).map((s, i) => (
    <stop key={i} offset={`${Math.round((s.offset || 0) * 100)}%`} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
  ));

  const pe = { pointerEvents: "auto" };
  const handleColor = "#a855f7";
  const stopR = 6;

  return (
    <>
    <div className="absolute inset-0 z-40" style={{ pointerEvents: "none" }}>
      <svg ref={svgRef} className="w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <linearGradient id="gaBar" gradientUnits="userSpaceOnUse" x1={ss.x} y1={ss.y} x2={se.x} y2={se.y}>{barStops}</linearGradient>
        </defs>

        {/* Radial boundary ellipse */}
        {!isLinear && (() => {
          const sc = toScreen({ x: grad.cx, y: grad.cy });
          const rx = (grad.r || 1) * zoom;
          const ry = rx * (grad.aspectRatio ?? 1);
          const aspectPt = toScreen({ x: grad.cx, y: grad.cy + (grad.r || 1) * (grad.aspectRatio ?? 1) });
          const focal = toScreen({ x: grad.fx ?? grad.cx, y: grad.fy ?? grad.cy });
          return (
            <g>
              <ellipse cx={sc.x} cy={sc.y} rx={rx} ry={ry} fill="none" stroke={handleColor} strokeWidth={1} opacity={0.7} />
              <circle cx={focal.x} cy={focal.y} r={4} fill="#f59e0b" stroke="#000" strokeWidth={1} style={pe} onPointerDown={startDrag("focal")} />
              <rect x={aspectPt.x - 4} y={aspectPt.y - 4} width={8} height={8} fill="#22c55e" stroke="#000" strokeWidth={1} style={pe} onPointerDown={startDrag("aspect")} />
              <rect x={sc.x - 4} y={sc.y - 4} width={8} height={8} fill="#fff" stroke={handleColor} strokeWidth={1.5} style={pe} onPointerDown={startDrag("center")} />
            </g>
          );
        })()}

        {/* Gradient bar */}
        <line x1={ss.x} y1={ss.y} x2={se.x} y2={se.y} stroke="url(#gaBar)" strokeWidth={9} strokeLinecap="round" />
        <line x1={ss.x} y1={ss.y} x2={se.x} y2={se.y} stroke="#ffffff" strokeWidth={1} opacity={0.4} />

        {/* Start / End (or radius) handles */}
        <rect x={ss.x - 5} y={ss.y - 5} width={10} height={10} fill="#fff" stroke={handleColor} strokeWidth={1.5} style={pe} onPointerDown={startDrag(isLinear ? "start" : "center")} />
        <rect x={se.x - 5} y={se.y - 5} width={10} height={10} fill="#fff" stroke={handleColor} strokeWidth={1.5} style={pe} onPointerDown={startDrag(isLinear ? "end" : "radius")} />

        {/* Midpoint diamonds */}
        {sortedStops.slice(0, -1).map((s, i) => {
          const next = sortedStops[i + 1];
          const m = s.midpoint ?? 0.5;
          const mp = toScreen({ x: stopPos(s).x + (stopPos(next).x - stopPos(s).x) * m, y: stopPos(s).y + (stopPos(next).y - stopPos(s).y) * m });
          return (
            <rect key={"m" + i} x={mp.x - 4} y={mp.y - 4} width={8} height={8} fill="#000" stroke={handleColor} strokeWidth={1.2} transform={`rotate(45 ${mp.x} ${mp.y})`} style={pe} onPointerDown={startDrag("midpoint", { i })} />
          );
        })}

        {/* Color stops */}
        {sortedStops.map((s, i) => {
          const sp = toScreen(stopPos(s));
          const active = s._id === activeStopId;
          return (
            <g key={s._id}>
              <circle cx={sp.x} cy={sp.y} r={stopR + 2} fill="#fff" stroke={active ? "#f59e0b" : "#000"} strokeWidth={active ? 2 : 1} style={pe} onPointerDown={onStopDown(s, i)} onDoubleClick={onStopDouble(s)} />
              <circle cx={sp.x} cy={sp.y} r={stopR - 1} fill={s.color} style={{ pointerEvents: "none" }} />
            </g>
          );
        })}
      </svg>

      {/* Control bar */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-neutral-900/95 border border-white/15 rounded-md px-1.5 h-7 text-[11px] text-white/80" style={{ pointerEvents: "auto" }}>
        <button onClick={() => setType("linear")} className={`px-2 h-5 rounded ${isLinear ? "bg-violet-600 text-white" : "text-white/60 hover:bg-white/10"}`}>Linear</button>
        <button onClick={() => setType("radial")} className={`px-2 h-5 rounded ${!isLinear ? "bg-violet-600 text-white" : "text-white/60 hover:bg-white/10"}`}>Radial</button>
        <div className="w-px h-4 bg-white/15" />
        <button onClick={reverse} className="px-2 h-5 rounded text-white/70 hover:bg-white/10">Reverse</button>
        {activeStop && (
          <>
            <div className="w-px h-4 bg-white/15" />
            <span className="text-white/40">Loc</span>
            <input
              type="number" min={0} max={100} value={Math.round((activeStop.offset || 0) * 100)}
              onChange={(e) => setActiveLoc(+e.target.value)}
              onBlur={() => commit(stateRef.current.grad)}
              className="w-11 bg-neutral-800 border border-white/10 rounded px-1 h-5 text-white text-center"
            />
            <span className="text-white/40">%</span>
            <button onClick={deleteActive} disabled={grad.stops.length <= 2} className="px-2 h-5 rounded text-white/70 hover:bg-white/10 disabled:opacity-30">Delete</button>
          </>
        )}
      </div>

    </div>
    {picker && (
      <ColorPicker
        key={picker.nonce}
        target="fill"
        value={picker.value}
        original={picker.original}
        onChange={(hex, alpha) => updateStopColor(picker.stopId, hex, alpha, false)}
        onConfirm={(hex, alpha) => { updateStopColor(picker.stopId, hex, alpha, true); setPicker(null); }}
        onCancel={() => { updateStopColor(picker.stopId, picker.original.hex, picker.original.alpha, true); setPicker(null); }}
        swatches={project?.swatches || []}
        onSwatchesChange={(sw) => onProject?.({ ...project, swatches: sw })}
        recent={project?.recentColors || []}
        onRecentChange={(rc) => onProject?.({ ...project, recentColors: rc })}
      />
    )}
    </>
  );
}