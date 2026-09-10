import React, { useState, useEffect } from "react";
import { Circle, Aperture, Square } from "lucide-react";

export default function CornerTypeDialog({ x, y, radius, type, onApply, onClose }) {
  const [r, setR] = useState(radius);
  const [t, setT] = useState(type || "round");
  useEffect(() => { setR(radius); setT(type || "round"); }, [radius, type]);
  const left = Math.min(Math.max(x, 120), window.innerWidth - 200);
  const top = Math.min(Math.max(y, 60), window.innerHeight - 180);
  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute bg-neutral-900 border border-white/15 rounded-lg shadow-2xl p-3 w-52" style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] text-white/60 mb-2">Corner Type</div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          <button onClick={() => setT("round")} className={`flex flex-col items-center gap-1 py-2 rounded text-[10px] ${t === "round" ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/60"}`}><Circle size={16} />Round</button>
          <button onClick={() => setT("inverted")} className={`flex flex-col items-center gap-1 py-2 rounded text-[10px] ${t === "inverted" ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/60"}`}><Aperture size={16} />Inverted</button>
          <button onClick={() => setT("chamfer")} className={`flex flex-col items-center gap-1 py-2 rounded text-[10px] ${t === "chamfer" ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/60"}`}><Square size={16} />Chamfer</button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-white/60 mb-3">
          Radius:
          <input type="number" min={0} value={r} onChange={(e) => setR(e.target.value)} className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500" />
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-7 text-[11px] rounded bg-neutral-800 text-white/70 hover:bg-white/10">Cancel</button>
          <button onClick={() => { onApply(t, Math.max(0, +r || 0)); onClose(); }} className="flex-1 h-7 text-[11px] rounded bg-violet-600 text-white hover:bg-violet-500">Apply</button>
        </div>
      </div>
    </div>
  );
}