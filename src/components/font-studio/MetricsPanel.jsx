import React, { useState } from "react";
import { Plus, Trash2, Layers, RotateCcw } from "lucide-react";
import { toDisplay, fromDisplay, UNIT_LABELS } from "@/font/units";

function Field({ label, value, onChange, step, unit = "fu" }) {
  const effStep = step ?? (unit === "fu" || unit === "px" ? 1 : 0.1);
  return (
    <label className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-white/60">{label}</span>
      <input
        type="number"
        value={toDisplay(value, unit)}
        step={effStep}
        onChange={(e) => onChange(fromDisplay(parseFloat(e.target.value) || 0, unit))}
        className="w-20 bg-neutral-800 border border-white/10 rounded px-2 h-7 text-right text-white focus:outline-none focus:border-violet-500"
      />
    </label>
  );
}

function Mini({ label, value, onChange, w = "w-14" }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-white/40">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`${w} bg-neutral-800 border border-white/10 rounded px-1.5 h-7 text-right text-white text-[12px] focus:outline-none focus:border-violet-500`}
      />
    </label>
  );
}

export default function MetricsPanel({ metrics, glyph, onMetrics, onGlyph, project, onProject, rulerUnit = "fu", workspaceMode = "font" }) {
  const [baseChar, setBaseChar] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);

  // Apply a metrics patch to every glyph in the project (used when "Apply to all" is on).
  const setAllGlyphs = (patch) => {
    const glyphs = {};
    Object.keys(project.glyphs).forEach((ch) => { glyphs[ch] = { ...project.glyphs[ch], ...patch }; });
    onProject({ ...project, glyphs });
  };
  const setGlyphMetric = (patch) => applyToAll ? setAllGlyphs(patch) : onGlyph({ ...glyph, ...patch });

  const updateComp = (i, patch) => {
    const components = glyph.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onGlyph({ ...glyph, components });
  };
  const addComp = () => {
    if (!baseChar) return;
    onGlyph({ ...glyph, components: [...(glyph.components || []), { baseChar, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }] });
    setBaseChar("");
  };
  const removeComp = (i) => onGlyph({ ...glyph, components: glyph.components.filter((_, idx) => idx !== i) });

  if (workspaceMode === "illustration") {
    const artboard = project.artboard || { width: 1080, height: 1080 };
    const setArtboard = (patch) => onProject({ ...project, artboard: { ...artboard, ...patch } });
    const PRESETS = [
      { label: "Square 1080", w: 1080, h: 1080 },
      { label: "HD 1920×1080", w: 1920, h: 1080 },
      { label: "A4 @96dpi", w: 794, h: 1123 },
      { label: "Story 1080×1920", w: 1080, h: 1920 },
    ];
    return (
      <div className="p-3 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Artboard</div>
            <span className="text-[10px] text-white/30">{UNIT_LABELS[rulerUnit]}</span>
          </div>
          <div className="space-y-1.5">
            <Field label="Width" value={artboard.width} onChange={(v) => setArtboard({ width: v })} unit={rulerUnit} />
            <Field label="Height" value={artboard.height} onChange={(v) => setArtboard({ height: v })} unit={rulerUnit} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => setArtboard({ width: p.w, height: p.h })} className="text-[11px] px-2 h-7 rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white/70 hover:text-white">
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
            The framed area on the canvas shows your working size. Switch ruler units to view dimensions in cm, in, mm, or px.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Font Metrics</div>
          <span className="text-[10px] text-white/30">{UNIT_LABELS[rulerUnit]}</span>
        </div>
        <div className="space-y-1.5">
          <Field label="Units / em" value={metrics.unitsPerEm} onChange={(v) => onMetrics({ ...metrics, unitsPerEm: v })} unit={rulerUnit} />
          <Field label="Ascender" value={metrics.ascender} onChange={(v) => onMetrics({ ...metrics, ascender: v })} unit={rulerUnit} />
          <Field label="Cap height" value={metrics.capHeight} onChange={(v) => onMetrics({ ...metrics, capHeight: v })} unit={rulerUnit} />
          <Field label="x-height" value={metrics.xHeight} onChange={(v) => onMetrics({ ...metrics, xHeight: v })} unit={rulerUnit} />
          <Field label="Descender" value={metrics.descender} onChange={(v) => onMetrics({ ...metrics, descender: v })} unit={rulerUnit} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Glyph Metrics</div>
            <span className="text-[10px] text-white/30">{UNIT_LABELS[rulerUnit]}</span>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer select-none">
            <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="accent-violet-500 w-3 h-3" />
            Apply to all
          </label>
        </div>
        <div className="space-y-1.5">
          <Field label="Advance width" value={glyph.advanceWidth} onChange={(v) => setGlyphMetric({ advanceWidth: v })} unit={rulerUnit} />
          <Field label="Left bearing" value={glyph.leftSideBearing} onChange={(v) => setGlyphMetric({ leftSideBearing: v })} unit={rulerUnit} />
          <Field label="Right bearing" value={glyph.rightSideBearing} onChange={(v) => setGlyphMetric({ rightSideBearing: v })} unit={rulerUnit} />
        </div>
        <button
          onClick={() => setGlyphMetric({ advanceWidth: metrics.defaultAdvanceWidth, leftSideBearing: metrics.defaultLSB })}
          className="mt-2 flex items-center gap-1.5 h-7 px-2.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-[12px] text-white/80 hover:text-white"
        >
          <RotateCcw size={12} /> Reset LSB &amp; advance to template
        </button>
        <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
          Drag the vertical guides on the canvas to adjust side bearings and advance width visually.
        </p>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">
          <Layers size={12} /> Components
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <input
            value={baseChar}
            onChange={(e) => setBaseChar(e.target.value.slice(-1))}
            placeholder="base"
            className="w-16 text-center bg-neutral-800 border border-white/10 rounded h-8 text-white text-[12px]"
          />
          <button onClick={addComp} className="flex-1 h-8 grid place-items-center bg-violet-600 hover:bg-violet-500 rounded text-white text-[12px] gap-1 flex">
            <Plus size={13} /> Add component
          </button>
        </div>
        <div className="space-y-2">
          {(glyph.components || []).map((c, i) => (
            <div key={i} className="bg-white/[0.03] rounded p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-white/70">← {c.baseChar}</span>
                <button onClick={() => removeComp(i)} className="text-white/40 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Mini label="X" value={c.x} onChange={(v) => updateComp(i, { x: v })} />
                <Mini label="Y" value={c.y} onChange={(v) => updateComp(i, { y: v })} />
                <Mini label="ScaleX" value={c.scaleX * 100} onChange={(v) => updateComp(i, { scaleX: v / 100 })} />
                <Mini label="ScaleY" value={c.scaleY * 100} onChange={(v) => updateComp(i, { scaleY: v / 100 })} />
                <Mini label="Rot°" value={c.rotation} onChange={(v) => updateComp(i, { rotation: v })} />
              </div>
            </div>
          ))}
          {(glyph.components || []).length === 0 && (
            <p className="text-[11px] text-white/30 leading-relaxed">
              Reuse a base glyph (e.g. add "A" into "Á" with an accent). Components support position, scale and rotation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}