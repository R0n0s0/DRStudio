import React from "react";
import ArtboardSizeBar from "./ArtboardSizeBar";

// Bottom status bar: artboard size controls (Illustration) or glyph info (Font),
// plus zoom and contour/node counts.
export default function CanvasStatusBar({ workspaceMode, glyph, work, zoom, artboard, onArtboardChange, rulerUnit, setRulerUnit }) {
  return (
    <div className="h-7 flex-shrink-0 bg-neutral-900/90 border-t border-white/10 flex items-center px-3 text-[11px] text-white/50 gap-4">
      {workspaceMode === "illustration" ? (
        <ArtboardSizeBar artboard={artboard} onChange={onArtboardChange} rulerUnit={rulerUnit} onUnitChange={setRulerUnit} />
      ) : (
        <span>{glyph.char === " " ? "Space" : glyph.char} · U+{glyph.unicode.toString(16).toUpperCase().padStart(4, "0")}</span>
      )}
      <span>Zoom {Math.round(zoom * 100)}%</span>
      <span className="ml-auto">{work.contours.length} contour(s) · {work.contours.reduce((a, c) => a + (c.compound ? c.compound.members.reduce((b, m) => b + m.points.length, 0) : c.points.length), 0)} nodes{work.components.length ? ` · ${work.components.length} component(s)` : ""}</span>
    </div>
  );
}