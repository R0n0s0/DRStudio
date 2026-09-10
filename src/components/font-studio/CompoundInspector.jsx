import React from "react";
import { Combine, Ungroup, Layers } from "lucide-react";

// Inspector shown when a non-destructive Compound Shape is selected.
// Expand bakes the live boolean result into a static Bézier path; Release
// breaks the compound back into its individual member objects.
export default function CompoundInspector({ op, onExpand, onRelease }) {
  if (!op) return null;
  return (
    <div className="px-3 py-2 border-b border-white/10 bg-violet-600/5">
      <div className="flex items-center gap-2 mb-2">
        <Layers size={14} className="text-violet-300" />
        <span className="text-[11px] uppercase tracking-wider text-violet-300 font-medium">Compound Shape</span>
        <span className="ml-auto text-[10px] text-white/40 capitalize">{op}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={onExpand} className="flex items-center justify-center gap-1.5 h-8 rounded bg-violet-600 hover:bg-violet-500 text-white text-[12px]">
          <Combine size={14} /> Expand
        </button>
        <button onClick={onRelease} className="flex items-center justify-center gap-1.5 h-8 rounded bg-neutral-800 hover:bg-white/10 text-white/70 text-[12px] border border-white/5">
          <Ungroup size={14} /> Release
        </button>
      </div>
      <div className="text-[10px] text-white/30 mt-1.5">Direct Selection Tool (A): drag sub-shapes — the result updates live.</div>
    </div>
  );
}