import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { pathD } from "@/font/geometry";

function PairPreview({ project, a, b, value }) {
  const upem = project.metrics.unitsPerEm || 1000;
  const scale = 28 / upem;
  const lineH = project.metrics.ascender * scale;
  const toScreen = (p, ox) => ({ x: (p.x + ox) * scale, y: -p.y * scale + lineH });
  let x = 0;
  const render = (ch) => {
    const g = project.glyphs[ch];
    if (!g) return null;
    const el = (
      <g key={ch + x} transform={`translate(${x * scale},0)`}>
        {(g.contours || []).map((c, i) => (
          <path key={i} d={pathD(c, (p) => toScreen(p, 0))} fill="currentColor" fillRule="evenodd" />
        ))}
      </g>
    );
    x += (g.advanceWidth || 0) + (ch === a ? value : 0);
    return el;
  };
  const width = ((project.glyphs[a]?.advanceWidth || 0) + value + (project.glyphs[b]?.advanceWidth || 0)) * scale + 8;
  return (
    <svg width={Math.max(width, 40)} height={36} className="text-white/80">
      {render(a)}{render(b)}
    </svg>
  );
}

export default function KerningPanel({ project, onAdd, onUpdate, onDelete }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const pairs = Object.entries(project.kerning || {});

  const add = () => {
    if (a && b) { onAdd(a, b, 0); setA(""); setB(""); }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1">
        <input value={a} onChange={(e) => setA(e.target.value[0] || "")} placeholder="A" className="w-12 text-center bg-neutral-800 border border-white/10 rounded h-8 text-white" />
        <span className="text-white/40">+</span>
        <input value={b} onChange={(e) => setB(e.target.value[0] || "")} placeholder="V" className="w-12 text-center bg-neutral-800 border border-white/10 rounded h-8 text-white" />
        <button onClick={add} className="ml-auto w-8 h-8 grid place-items-center bg-violet-600 hover:bg-violet-500 rounded text-white">
          <Plus size={15} />
        </button>
      </div>
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
        {pairs.length === 0 && <p className="text-[12px] text-white/30 text-center py-4">No kerning pairs yet.</p>}
        {pairs.map(([key, val]) => {
          const [ca, cb] = key.split(",");
          return (
            <div key={key} className="flex items-center gap-2 bg-white/[0.03] rounded p-1.5">
              <div className="w-16 shrink-0"><PairPreview project={project} a={ca} b={cb} value={val} /></div>
              <div className="text-[13px] text-white/70 w-10">{ca}{cb}</div>
              <input
                type="number"
                value={val}
                onChange={(e) => onUpdate(key, parseFloat(e.target.value) || 0)}
                className="w-16 bg-neutral-800 border border-white/10 rounded h-7 text-right text-white text-[12px] px-1"
              />
              <button onClick={() => onDelete(key)} className="w-7 h-7 grid place-items-center text-white/40 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-white/30 leading-relaxed">
        Negative values tighten spacing. Try AV, VA, To, Ta, Yo, LT, LY.
      </p>
    </div>
  );
}