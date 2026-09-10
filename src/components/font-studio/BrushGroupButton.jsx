import React, { useEffect, useRef } from "react";
import useToolFlyout from "./useToolFlyout";

// Custom paintbrush icon (exact lucide Paintbrush paths).
function BrushIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
  );
}

// Wet Brush — paintbrush + a water droplet (the droplet signals "wet"/liquid merge).
function WetBrushIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
      <path d="M19 17.5c-1.2 1.8-2 2.8-2 3.8a2 2 0 1 0 4 0c0-1-.8-2-2-3.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const BRUSHES = [
  { id: "brush", icon: BrushIcon, label: "Brush Tool", key: "B", desc: "Variable-width brush stroke — one smooth path per stroke." },
  { id: "wetbrush", icon: WetBrushIcon, label: "Wet Brush Tool", key: "W", desc: "Merges overlapping strokes into a single filled shape with minimal anchor points." },
];
const BRUSH_IDS = BRUSHES.map((b) => b.id);

export default function BrushGroupButton({ tool, setTool, brushSize, setBrushSize, pressureEnabled, setPressureEnabled }) {
  const lastBrush = useRef("brush");
  useEffect(() => { if (BRUSH_IDS.includes(tool)) lastBrush.current = tool; }, [tool]);
  const currentBrush = BRUSH_IDS.includes(tool) ? tool : lastBrush.current;
  const currentDef = BRUSHES.find((b) => b.id === currentBrush) || BRUSHES[0];
  const CurrentIcon = currentDef.icon;
  const isActive = BRUSH_IDS.includes(tool);

  const { open, pos, hoveredId, wrapRef, registerItem, startPress, pickByClick } = useToolFlyout({
    holdMs: 250,
    onPick: setTool,
    onShortPress: () => setTool(currentBrush),
  });

  const activeDesc = (BRUSHES.find((b) => b.id === tool) || currentDef).desc;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        title={`${currentDef.label} (${currentDef.key}) — hold for all brushes`}
        onPointerDown={startPress}
        style={{ touchAction: "none" }}
        className={`relative w-9 h-9 grid place-items-center rounded-sm transition-colors ${
          isActive ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <CurrentIcon size={17} strokeWidth={1.75} />
        <span className="absolute bottom-0.5 right-0.5 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[4px] border-l-neutral-400" />
      </button>

      {open && pos && (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 w-52 bg-neutral-900 border border-white/10 rounded-md shadow-xl p-2 space-y-2"
        >
          <div className="flex gap-1">
            {BRUSHES.map((b) => {
              const Icon = b.icon;
              const sel = tool === b.id;
              const hov = hoveredId === b.id;
              return (
                <button
                  key={b.id}
                  ref={registerItem(b.id)}
                  title={`${b.label} (${b.key})`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickByClick(b.id)}
                  className={`flex-1 h-9 grid place-items-center rounded-sm ${
                    hov ? "bg-violet-600 text-white" : sel ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.75} />
                </button>
              );
            })}
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-white/60 uppercase tracking-wide">Size</span>
              <span className="text-[11px] text-white/80 tabular-nums">{brushSize}</span>
            </div>
            <input
              type="range" min={1} max={120} value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>

          <label className="flex items-center justify-between text-[12px] text-white/70 cursor-pointer">
            <span>Pressure sensitivity</span>
            <input
              type="checkbox" checked={pressureEnabled}
              onChange={(e) => setPressureEnabled(e.target.checked)}
              className="accent-violet-500 w-4 h-4"
            />
          </label>

          <p className="text-[10px] text-white/40 leading-snug">{activeDesc}</p>
        </div>
      )}
    </div>
  );
}