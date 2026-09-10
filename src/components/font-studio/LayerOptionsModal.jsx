import React, { useState } from "react";
import { ACCENT_PALETTE } from "@/font/layerModel";

export default function LayerOptionsModal({ mode, initial, onConfirm, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [accentColor, setAccentColor] = useState(initial?.accentColor || ACCENT_PALETTE[0]);
  const [locked, setLocked] = useState(initial?.locked || false);
  const [hidden, setHidden] = useState(initial?.hidden || false);
  const [isTemplate, setIsTemplate] = useState(initial?.isTemplate || false);
  const [opacity, setOpacity] = useState(initial?.opacity ?? 1);

  const title = mode === "new" ? "New Layer" : mode === "newSublayer" ? "New Sublayer" : "Layer Properties";
  const confirmLabel = mode === "properties" ? "Apply" : "OK";

  const handleConfirm = () => onConfirm({ name, accentColor, locked, hidden, isTemplate, opacity });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-neutral-800 border border-white/15 rounded-lg p-4 w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-[13px] text-white/90 font-medium">{title}</div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-violet-500"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1">Accent Color</label>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setAccentColor(c)}
                className={`w-6 h-6 rounded border-2 transition-transform ${accentColor === c ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {mode === "properties" && (
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Opacity: {Math.round(opacity * 100)}%</label>
            <input type="range" min={0} max={1} step={0.05} value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="accent-violet-500" />
            Lock
          </label>
          <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="accent-violet-500" />
            Hide
          </label>
          <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
            <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="accent-violet-500" />
            Template (50% opacity, non-exporting)
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-1 text-[11px] text-white/60 hover:text-white rounded">Cancel</button>
          <button onClick={handleConfirm} className="px-3 py-1 text-[11px] bg-violet-600 text-white rounded hover:bg-violet-500">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}