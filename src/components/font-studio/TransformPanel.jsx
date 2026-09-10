import React, { useState, useEffect } from "react";
import {
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from "lucide-react";
import LiveShapeInspector from "./LiveShapeInspector";

// Numeric transform panel for the Direct Selection Tool.
// Single point  → editable X / Y.
// Multiple pts  → editable bbox X / Y / W / H + 6 align buttons.
// A selected live (parametric) shape → LiveShapeInspector instead.
function getPt(glyph, s) {
  return glyph.contours[s.contour]?.points[s.point];
}

export default function TransformPanel({ glyph, onGlyph, selContours, selPoints, selSegments }) {
  // Live shape takes priority: parametric controls + Convert to Path.
  if (selContours?.length === 1 && glyph.contours[selContours[0]]?.liveShape) {
    return <LiveShapeInspector glyph={glyph} contour={glyph.contours[selContours[0]]} contourIndex={selContours[0]} onGlyph={onGlyph} />;
  }

  const n = selPoints.length;

  const bbox = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of selPoints) {
      const p = getPt(glyph, s);
      if (!p) continue;
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    return isFinite(minX) ? { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY } : null;
  };

  // Apply a position transform to all selected points; handles move by the per-point delta.
  const updatePoints = (fn) => {
    const contours = glyph.contours.map((c, ci) => {
      let changed = false;
      const pts = c.points.map((p, pi) => {
        if (!selPoints.some((s) => s.contour === ci && s.point === pi)) return p;
        changed = true;
        const np = fn(p);
        const dx = np.x - p.x, dy = np.y - p.y;
        return {
          ...p, x: np.x, y: np.y,
          in: p.in ? { x: p.in.x + dx, y: p.in.y + dy } : null,
          out: p.out ? { x: p.out.x + dx, y: p.out.y + dy } : null,
        };
      });
      return changed ? { ...c, points: pts } : c;
    });
    onGlyph({ ...glyph, contours });
  };

  if (n === 0) {
    return (
      <div className="p-3 text-[12px] text-white/40 leading-relaxed">
        No anchor points selected. Use the Direct Selection Tool (A) to select points or path segments, then edit their coordinates here.
      </div>
    );
  }

  const bb = bbox();

  if (n === 1) {
    const p = getPt(glyph, selPoints[0]);
    if (!p) return null;
    return (
      <div className="p-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-white/40">Anchor Point</div>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="X" value={p.x} onChange={(v) => updatePoints((pp) => ({ x: v, y: pp.y }))} />
          <NumField label="Y" value={p.y} onChange={(v) => updatePoints((pp) => ({ x: pp.x, y: v }))} />
        </div>
        <div className="text-[11px] text-white/40">Type: {p.type}</div>
      </div>
    );
  }

  const setBBox = (key, val) => {
    updatePoints((p) => {
      let nx = p.x, ny = p.y;
      if (key === "x") nx = p.x + (val - bb.minX);
      else if (key === "y") ny = p.y + (val - bb.minY);
      else if (key === "w") nx = bb.minX + (p.x - bb.minX) * (bb.w > 0 ? val / bb.w : 1);
      else if (key === "h") ny = bb.minY + (p.y - bb.minY) * (bb.h > 0 ? val / bb.h : 1);
      return { x: nx, y: ny };
    });
  };

  const align = (type) => {
    updatePoints((p) => {
      if (type === "left") return { x: bb.minX, y: p.y };
      if (type === "right") return { x: bb.maxX, y: p.y };
      if (type === "top") return { x: p.x, y: bb.maxY };
      if (type === "bottom") return { x: p.x, y: bb.minY };
      if (type === "hcenter") return { x: (bb.minX + bb.maxX) / 2, y: p.y };
      if (type === "vcenter") return { x: p.x, y: (bb.minY + bb.maxY) / 2 };
      return p;
    });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{n} Anchor Points</div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={bb.minX} onChange={(v) => setBBox("x", v)} />
        <NumField label="Y" value={bb.minY} onChange={(v) => setBBox("y", v)} />
        <NumField label="W" value={bb.w} onChange={(v) => setBBox("w", Math.max(0, v))} />
        <NumField label="H" value={bb.h} onChange={(v) => setBBox("h", Math.max(0, v))} />
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-white/30">Align</div>
        <div className="grid grid-cols-6 gap-1">
          <AlignBtn icon={AlignStartVertical} title="Align Left" onClick={() => align("left")} />
          <AlignBtn icon={AlignCenterVertical} title="Align H Center" onClick={() => align("hcenter")} />
          <AlignBtn icon={AlignEndVertical} title="Align Right" onClick={() => align("right")} />
          <AlignBtn icon={AlignStartHorizontal} title="Align Top" onClick={() => align("top")} />
          <AlignBtn icon={AlignCenterHorizontal} title="Align V Center" onClick={() => align("vcenter")} />
          <AlignBtn icon={AlignEndHorizontal} title="Align Bottom" onClick={() => align("bottom")} />
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }) {
  const [text, setText] = useState("");
  useEffect(() => { setText((Math.round(value * 100) / 100).toFixed(2)); }, [value]);
  const commit = () => {
    const v = parseFloat(text);
    if (!isNaN(v)) onChange(v);
    else setText((Math.round(value * 100) / 100).toFixed(2));
  };
  return (
    <label className="flex items-center gap-1.5 bg-neutral-800 border border-white/10 rounded px-2 h-8 focus-within:border-violet-500">
      <span className="text-[11px] text-white/40 w-4">{label}</span>
      <input
        type="text" value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        className="w-full bg-transparent text-[12px] text-white focus:outline-none"
      />
    </label>
  );
}

function AlignBtn({ icon: Icon, title, onClick }) {
  return (
    <button title={title} onClick={onClick} className="h-8 grid place-items-center rounded bg-neutral-800 text-white/60 hover:bg-neutral-700 hover:text-white">
      <Icon size={14} strokeWidth={1.75} />
    </button>
  );
}