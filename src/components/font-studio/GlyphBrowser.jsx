import React, { useMemo, useState } from "react";
import { FilePlus } from "lucide-react";
import { CHAR_SETS } from "@/font/glyphModel";
import { pathD, contourBounds, resolveContours } from "@/font/geometry";

function GlyphThumb({ glyph, glyphs, metrics }) {
  const contours = useMemo(() => resolveContours(glyph, glyphs), [glyph, glyphs]);
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let has = false;
    for (const c of contours) {
      const b = contourBounds(c);
      if (!b) continue;
      has = true;
      minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
    }
    return has ? { minX, minY, maxX, maxY } : null;
  }, [contours]);

  if (!bounds) return <div className="w-full h-full" />;

  const pad = 80;
  const minX = -glyph.leftSideBearing, maxX = glyph.advanceWidth - glyph.rightSideBearing;
  const minY = metrics.descender, maxY = metrics.ascender;
  const w = (maxX - minX) || 1, h = (maxY - minY) || 1;
  const toScreen = (p) => ({
    x: ((p.x - minX) / w) * (64 - pad / 4) + pad / 8,
    y: 64 - ((p.y - minY) / h) * (64 - pad / 4) - pad / 8,
  });
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      {contours.map((c, i) => (
        <path key={i} d={pathD(c, toScreen)} fill="currentColor" fillRule="evenodd" />
      ))}
    </svg>
  );
}

function GlyphCell({ glyph, glyphs, metrics, selected, onClick }) {
  const empty = (glyph.contours || []).length === 0 && (glyph.components || []).length === 0;
  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-md border flex flex-col items-center justify-center overflow-hidden transition-all ${
        selected ? "border-violet-500 bg-violet-500/15" : "border-white/10 hover:border-white/30 bg-white/[0.02]"
      }`}
    >
      <div className={`flex-1 w-full grid place-items-center ${empty ? "text-white/15" : "text-white/80"}`}>
        {empty ? (
          <span className="text-base font-medium">{glyph.char === " " ? "␣" : glyph.char}</span>
        ) : (
          <GlyphThumb glyph={glyph} glyphs={glyphs} metrics={metrics} />
        )}
      </div>
      <div className="text-[10px] text-white/40 leading-none pb-1">{glyph.char === " " ? "SP" : glyph.char}</div>
      {!empty && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
    </button>
  );
}

export default function GlyphBrowser({ glyphs, metrics, currentChar, onSelect, onNewProject }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="w-60 flex flex-col bg-neutral-900 border-r border-white/10 relative">
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/10 text-[13px] font-medium">
        <span>Glyphs</span>
        {onNewProject && (
          <button
            title="Start a new font (clears all glyphs)"
            onClick={() => setConfirm(true)}
            className="flex items-center gap-1 h-6 px-2 rounded text-[11px] text-white/60 hover:text-white hover:bg-white/10"
          >
            <FilePlus size={12} /> New
          </button>
        )}
      </div>
      {confirm && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(false)}>
          <div className="w-64 bg-neutral-900 border border-white/10 rounded-lg p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[13px] text-white font-medium mb-1">Start a new font?</div>
            <div className="text-[11px] text-white/50 mb-4 leading-relaxed">This clears all glyphs and starts fresh. Save your current project first if you want to keep it.</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(false)} className="px-3 h-7 text-[12px] text-white/60 hover:text-white rounded">Cancel</button>
              <button onClick={() => { setConfirm(false); onNewProject(); }} className="px-3 h-7 text-[12px] bg-violet-600 hover:bg-violet-500 text-white rounded">New Font</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {CHAR_SETS.map((section) => (
          <div key={section.name}>
            <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5 font-medium">{section.name}</div>
            {section.glyphs.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="text-[10px] text-white/30 mb-1">{group.label}</div>
                <div className="grid grid-cols-6 gap-1">
                  {group.chars.map((ch) => (
                    <GlyphCell
                      key={ch}
                      glyph={glyphs[ch]}
                      glyphs={glyphs}
                      metrics={metrics}
                      selected={currentChar === ch}
                      onClick={() => onSelect(ch)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}