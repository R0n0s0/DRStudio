import React, { useState } from "react";

const ROW_SIZES = [
  { id: "small", label: "Small Row", size: 20 },
  { id: "medium", label: "Medium Row", size: 32 },
  { id: "large", label: "Large Row", size: 48 },
];

export default function PanelOptionsModal({ rowSize, showLayersOnly, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(rowSize || "medium");
  const [layersOnly, setLayersOnly] = useState(showLayersOnly || false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-neutral-800 border border-white/15 rounded-lg p-4 w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-[13px] text-white/90 font-medium">Panel Options</div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1.5">Row Size</label>
          <div className="space-y-1">
            {ROW_SIZES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] border ${
                  selected === r.id ? "bg-violet-600/20 text-violet-300 border-violet-500/40" : "text-white/70 hover:bg-white/5 border-transparent"
                }`}
              >
                <div className="flex-1 text-left">
                  <div>{r.label}</div>
                  <div className="text-[9px] text-white/30">{r.size}px thumbnail</div>
                </div>
                {selected === r.id && <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-white/40 block mb-1.5">Display</label>
          <div className="space-y-1">
            <button
              onClick={() => setLayersOnly(false)}
              className={`w-full text-left px-2 py-1.5 rounded text-[11px] border ${
                !layersOnly ? "bg-violet-600/20 text-violet-300 border-violet-500/40" : "text-white/70 hover:bg-white/5 border-transparent"
              }`}
            >
              Show Sub-items and Paths
            </button>
            <button
              onClick={() => setLayersOnly(true)}
              className={`w-full text-left px-2 py-1.5 rounded text-[11px] border ${
                layersOnly ? "bg-violet-600/20 text-violet-300 border-violet-500/40" : "text-white/70 hover:bg-white/5 border-transparent"
              }`}
            >
              Show Layers Only
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-1 text-[11px] text-white/60 hover:text-white rounded">Cancel</button>
          <button
            onClick={() => onConfirm({ rowSize: selected, showLayersOnly: layersOnly })}
            className="px-3 py-1 text-[11px] bg-violet-600 text-white rounded hover:bg-violet-500"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}