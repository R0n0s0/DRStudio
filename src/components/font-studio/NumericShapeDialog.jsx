import React, { useState, useEffect } from "react";
import { toolLiveType } from "@/font/liveShapes";

// Modal numeric input dialog for creating a precise shape at a clicked point.
// screenX/screenY position the dialog near the cursor (container-relative px).
export default function NumericShapeDialog({ tool, screenX, screenY, onSubmit, onClose }) {
  const lt = toolLiveType(tool);
  const isStar = lt === "star";
  const isPoly = lt === "polygon";
  const isRect = lt === "rectangle";
  const isEllipse = lt === "ellipse";

  const [w, setW] = useState(isStar ? "" : "200");
  const [h, setH] = useState(isStar ? "" : "200");
  const [radius, setRadius] = useState("20");
  const [sides, setSides] = useState("6");
  const [points, setPoints] = useState("5");
  const [r1, setR1] = useState("60"); // inner
  const [r2, setR2] = useState("120"); // outer

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    let width, height, params = {};
    if (isStar) {
      const outer = Math.max(1, parseFloat(r2) || 120);
      const inner = Math.max(0, parseFloat(r1) || 0);
      width = outer * 2;
      height = outer * 2;
      params = { points: Math.max(3, Math.min(64, parseInt(points) || 5)), innerRadius: Math.max(0.05, Math.min(0.95, inner / outer)) };
    } else {
      width = Math.max(1, parseFloat(w) || 100);
      height = Math.max(1, parseFloat(h) || 100);
      if (isRect) params = { cornerRadius: Math.max(0, parseFloat(radius) || 0) };
      if (isPoly) params = { sides: Math.max(3, Math.min(64, parseInt(sides) || 6)) };
    }
    onSubmit({ width, height, params });
  };

  const onKey = (e) => { if (e.key === "Enter") submit(); };

  const left = Math.min(screenX, window.innerWidth - 260);
  const top = Math.min(screenY, window.innerHeight - 320);

  return (
    <div className="absolute z-50" style={{ left, top }}>
      <div className="w-60 bg-neutral-900 border border-white/15 rounded-md shadow-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-white capitalize">{tool} Options</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xs">✕</button>
        </div>
        {isStar ? (
          <>
            <Row label="Outer R"><Num value={r2} onChange={setR2} onKey={onKey} /></Row>
            <Row label="Inner R"><Num value={r1} onChange={setR1} onKey={onKey} /></Row>
            <Row label="Points"><Num value={points} onChange={setPoints} onKey={onKey} /></Row>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Width"><Num value={w} onChange={setW} onKey={onKey} /></Row>
              <Row label="Height"><Num value={h} onChange={setH} onKey={onKey} /></Row>
            </div>
            {isRect && <Row label="Corner Radius"><Num value={radius} onChange={setRadius} onKey={onKey} /></Row>}
            {isPoly && <Row label="Sides"><Num value={sides} onChange={setSides} onKey={onKey} /></Row>}
          </>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} className="flex-1 h-8 bg-violet-600 hover:bg-violet-500 text-white text-[12px] rounded">Create</button>
          <button onClick={onClose} className="flex-1 h-8 bg-neutral-800 hover:bg-neutral-700 text-white/70 text-[12px] rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] text-white/40 w-20 shrink-0">{label}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange, onKey }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <input
      type="text" value={text} autoFocus
      onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
      onKeyDown={onKey}
      className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500"
    />
  );
}