import React, { useState, useLayoutEffect, useRef, useEffect } from "react";
import { PX_PER_UNIT, UNIT_LABELS } from "@/font/units";
import MarginHandle from "./MarginHandle";

const RULER = 18;

function niceStep(target) {
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const n = target / pow;
  let s;
  if (n < 1.5) s = 1;
  else if (n < 3) s = 2;
  else if (n < 7) s = 5;
  else s = 10;
  return s * pow;
}

function fmt(v, unit) {
  if (unit === "px" || unit === "fu") return String(Math.round(v));
  return String(Math.round(v * 100) / 100);
}

export default function CanvasRulers({ show, zoom, pan, unit, onUnitChange, children, workspaceMode = "font", marginHandles, onMarginChange, lockMargins = false }) {
  const topRef = useRef(null);
  const leftRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState(null);
  const [dragMargin, setDragMargin] = useState(null);
  const dragMarginRef = useRef(null);

  useLayoutEffect(() => {
    if (!show) return;
    const update = () => setSize({ w: topRef.current?.clientWidth || 0, h: leftRef.current?.clientHeight || 0 });
    update();
    const ro = new ResizeObserver(update);
    if (topRef.current) ro.observe(topRef.current);
    if (leftRef.current) ro.observe(leftRef.current);
    return () => ro.disconnect();
  }, [show]);

  // Margin handle dragging — uses window listeners so the drag continues even
  // when the pointer leaves the ruler. onMarginChange(key, fontVal, isFinal)
  // drives a live update during the move and a commit on release. X-axis
  // margins (LSB/Advance) read from the top ruler; Y-axis margins
  // (ascender/cap/x/baseline/descender) read from the left ruler.
  useEffect(() => {
    if (!dragMargin) return;
    const onMove = (e) => {
      const d = dragMarginRef.current;
      if (!d) return;
      if (d.axis === "y") {
        if (!leftRef.current) return;
        const rect = leftRef.current.getBoundingClientRect();
        const sy = e.clientY - rect.top;
        const fontY = Math.round(-(sy - pan.y) / zoom);
        onMarginChange?.(d.key, fontY, false);
      } else {
        if (!topRef.current) return;
        const rect = topRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const fontX = Math.round((sx - pan.x) / zoom);
        onMarginChange?.(d.key, fontX, false);
      }
    };
    const onUp = (e) => {
      const d = dragMarginRef.current;
      if (d) {
        if (d.axis === "y" && leftRef.current) {
          const rect = leftRef.current.getBoundingClientRect();
          const sy = e.clientY - rect.top;
          const fontY = Math.round(-(sy - pan.y) / zoom);
          onMarginChange?.(d.key, fontY, true);
        } else if (d.axis === "x" && topRef.current) {
          const rect = topRef.current.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const fontX = Math.round((sx - pan.x) / zoom);
          onMarginChange?.(d.key, fontX, true);
        }
      }
      dragMarginRef.current = null;
      setDragMargin(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragMargin, pan, zoom, onMarginChange]);

  if (!show) return <div className="flex-1 min-w-0 min-h-0">{children}</div>;

  const pxPerUnit = PX_PER_UNIT[unit] || 1;
  const screenPerUnit = pxPerUnit * zoom;
  const unitStep = niceStep(80 / screenPerUnit);
  const stepScreen = unitStep * screenPerUnit;

  const topTicks = [];
  if (size.w && stepScreen > 0) {
    const startV = Math.floor(-pan.x / stepScreen) * unitStep;
    for (let v = startV; ; v += unitStep) {
      const sx = v * screenPerUnit + pan.x;
      if (sx > size.w + 20) break;
      if (sx < -20) continue;
      topTicks.push({ x: sx, label: fmt(v, unit) });
    }
  }
  const leftTicks = [];
  if (size.h && stepScreen > 0) {
    const startV = Math.floor(-pan.y / stepScreen) * unitStep;
    for (let v = startV; ; v += unitStep) {
      const sy = v * screenPerUnit + pan.y;
      if (sy > size.h + 20) break;
      if (sy < -20) continue;
      leftTicks.push({ y: sy, label: fmt(v, unit) });
    }
  }

  const onCtx = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const startMarginDrag = (m) => (e) => {
    if (lockMargins) return;
    e.preventDefault();
    e.stopPropagation();
    dragMarginRef.current = { key: m.key, axis: m.axis };
    setDragMargin({ key: m.key, axis: m.axis });
  };

  const showMarginHandles = workspaceMode === "font" && Array.isArray(marginHandles) && marginHandles.length > 0;
  const xHandles = showMarginHandles ? marginHandles.filter((m) => m.axis !== "y") : [];
  const yHandles = showMarginHandles ? marginHandles.filter((m) => m.axis === "y") : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex h-[18px] flex-shrink-0">
        <div className="w-[18px] h-[18px] bg-neutral-800 border-r border-b border-white/10 flex-shrink-0" />
        <div ref={topRef} onContextMenu={onCtx} className="flex-1 bg-neutral-800 border-b border-white/10 relative overflow-hidden cursor-context-menu">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {topTicks.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={0} x2={t.x} y2={18} stroke="#9ca3af" strokeWidth={1} opacity={0.5} />
                <text x={t.x + 2} y={9} fill="#9ca3af" fontSize={9} opacity={0.85} dominantBaseline="middle">{t.label}</text>
              </g>
            ))}
            {xHandles.map((m) => (
              <MarginHandle
                key={m.key}
                orientation="down"
                pos={m.fontX * zoom + pan.x}
                rulerH={RULER}
                color={m.color}
                disabled={lockMargins}
                onPointerDown={startMarginDrag(m)}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div ref={leftRef} onContextMenu={onCtx} className="w-[18px] bg-neutral-800 border-r border-white/10 relative overflow-hidden flex-shrink-0 cursor-context-menu">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {leftTicks.map((t, i) => (
              <g key={i}>
                <line x1={0} y1={t.y} x2={18} y2={t.y} stroke="#9ca3af" strokeWidth={1} opacity={0.5} />
                <text x={3} y={t.y} fill="#9ca3af" fontSize={9} opacity={0.85} dominantBaseline="middle" transform={`rotate(-90 3 ${t.y})`}>{t.label}</text>
              </g>
            ))}
            {yHandles.map((m) => (
              <MarginHandle
                key={m.key}
                orientation="right"
                pos={-m.fontY * zoom + pan.y}
                rulerH={RULER}
                color={m.color}
                disabled={lockMargins}
                onPointerDown={startMarginDrag(m)}
              />
            ))}
          </svg>
        </div>
        <div className="flex-1 min-w-0 min-h-0 relative">{children}</div>
      </div>
      {menu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="fixed z-50 bg-neutral-800 border border-white/10 rounded shadow-lg py-1 text-[12px] text-white/80 min-w-[150px]" style={{ left: menu.x, top: menu.y }}>
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Ruler Units</div>
            {["fu", "px", "cm", "in", "mm"].map((u) => (
              <button key={u} onClick={() => { onUnitChange(u); setMenu(null); }} className={`w-full text-left px-2 py-1 hover:bg-white/10 flex items-center gap-2 ${unit === u ? "text-violet-300" : ""}`}>
                <span className="w-3 inline-block">{unit === u ? "✓" : ""}</span>{UNIT_LABELS[u]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}