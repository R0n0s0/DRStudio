import React, { useState, useEffect } from "react";
import { Spline, Eye, EyeOff, Plus, Minus, Scissors } from "lucide-react";

// Sharp vertex icon: a node with two segments forming a sharp, non-rounded corner.
const SharpVertexIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="6" height="6" fill="currentColor" stroke="none" />
    <line x1="8" y1="10" x2="8" y2="21" />
    <line x1="8" y1="10" x2="20" y2="21" />
  </svg>
);

export default function ContextualControlBar({ selPoints, selSegments, cornerRadius, hasHandlesVisible, onConvertCorner, onConvertSmooth, onShowHandles, onHideHandles, onAddAnchor, onRemoveAnchor, onCutPath, onSetCorners }) {
  const [r, setR] = useState(cornerRadius);
  useEffect(() => { setR(cornerRadius); }, [cornerRadius]);
  const hasPoints = selPoints.length > 0;
  const hasSegs = selSegments.length > 0;
  const apply = () => onSetCorners(Math.max(0, +r || 0));
  return (
    <div className="flex items-center gap-1 bg-neutral-900/95 border border-white/15 border-l-0 rounded-r-lg shadow-xl px-2 py-1.5">
      <button title="Convert to Sharp (strip handles & radius)" disabled={!hasPoints} onClick={onConvertCorner} className="w-7 h-7 grid place-items-center rounded text-white/70 hover:bg-white/10 disabled:opacity-30"><SharpVertexIcon size={15} /></button>
      <button title="Convert to smooth" disabled={!hasPoints} onClick={onConvertSmooth} className="w-7 h-7 grid place-items-center rounded text-white/70 hover:bg-white/10 disabled:opacity-30"><Spline size={15} /></button>
      <div className="w-px h-5 bg-white/10 mx-0.5" />
      <button title={hasHandlesVisible ? "Hide handles" : "Show handles"} disabled={!hasPoints} onClick={hasHandlesVisible ? onHideHandles : onShowHandles} className="w-7 h-7 grid place-items-center rounded text-white/70 hover:bg-white/10 disabled:opacity-30">{hasHandlesVisible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
      <div className="w-px h-5 bg-white/10 mx-0.5" />
      <button title="Add anchor point" disabled={!hasSegs} onClick={onAddAnchor} className="w-7 h-7 grid place-items-center rounded text-white/70 hover:bg-white/10 disabled:opacity-30"><Plus size={15} /></button>
      <button title="Remove anchor points" disabled={!hasPoints} onClick={onRemoveAnchor} className="w-7 h-7 grid place-items-center rounded text-white/70 hover:bg-white/10 disabled:opacity-30"><Minus size={15} /></button>
      <button title="Cut path at anchor" disabled={!hasPoints} onClick={onCutPath} className="w-7 h-7 grid place-items-center rounded text-white/70 hover:bg-white/10 disabled:opacity-30"><Scissors size={15} /></button>
      <div className="w-px h-5 bg-white/10 mx-0.5" />
      <label className="flex items-center gap-1.5 text-[11px] text-white/60">
        Corners:
        <input type="number" min={0} value={r} onChange={(e) => setR(e.target.value)} onBlur={apply} onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }} className="w-16 bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500" />
        px
      </label>
    </div>
  );
}