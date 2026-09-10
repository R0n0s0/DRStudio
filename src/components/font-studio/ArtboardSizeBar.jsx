import React, { useState } from "react";
import { Link2, Unlink, ChevronDown } from "lucide-react";
import { toDisplay, fromDisplay, UNIT_LABELS } from "@/font/units";

// Compact W / aspect-lock / H bar for the artboard, with a unit dropdown.
export default function ArtboardSizeBar({ artboard, onChange, rulerUnit = "fu", onUnitChange }) {
  const [lock, setLock] = useState(false);
  const ab = artboard || { width: 1080, height: 1080 };
  const isInt = rulerUnit === "fu" || rulerUnit === "px";
  const step = isInt ? 1 : 0.1;
  const unit = UNIT_LABELS[rulerUnit];

  const setW = (w) => {
    const width = fromDisplay(w, rulerUnit);
    const height = lock && ab.width ? Math.round((width / ab.width) * ab.height) : ab.height;
    onChange({ width, height });
  };
  const setH = (h) => {
    const height = fromDisplay(h, rulerUnit);
    const width = lock && ab.height ? Math.round((height / ab.height) * ab.width) : ab.width;
    onChange({ width, height });
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] text-white/60">W:</span>
      <input
        type="number"
        value={toDisplay(ab.width, rulerUnit)}
        step={step}
        onChange={(e) => setW(parseFloat(e.target.value) || 0)}
        className="w-[72px] bg-neutral-800 border border-white/10 rounded h-6 px-2 text-right text-[12px] text-white focus:outline-none focus:border-violet-500"
      />
      <span className="text-[11px] text-white/40 w-10">{unit}</span>
      <button
        title={lock ? "Unlock aspect ratio" : "Lock aspect ratio"}
        onClick={() => setLock((l) => !l)}
        className={`w-6 h-6 grid place-items-center rounded ${lock ? "bg-violet-600 text-white" : "text-white/50 hover:bg-white/10 hover:text-white"}`}
      >
        {lock ? <Link2 size={13} /> : <Unlink size={13} />}
      </button>
      <span className="text-[12px] text-white/60">H:</span>
      <input
        type="number"
        value={toDisplay(ab.height, rulerUnit)}
        step={step}
        onChange={(e) => setH(parseFloat(e.target.value) || 0)}
        className="w-[72px] bg-neutral-800 border border-white/10 rounded h-6 px-2 text-right text-[12px] text-white focus:outline-none focus:border-violet-500"
      />
      {onUnitChange ? (
        <div className="relative">
          <select
            value={rulerUnit}
            onChange={(e) => onUnitChange(e.target.value)}
            className="appearance-none bg-neutral-800 border border-white/10 rounded h-6 pl-2 pr-5 text-[11px] text-white/70 focus:outline-none focus:border-violet-500"
          >
            {Object.keys(UNIT_LABELS).map((u) => (
              <option key={u} value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-1 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>
      ) : (
        <span className="text-[11px] text-white/40 w-10">{unit}</span>
      )}
    </div>
  );
}