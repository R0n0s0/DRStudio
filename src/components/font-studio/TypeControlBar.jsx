import React, { useRef } from "react";
import { Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, Lock, Unlock, Wand2, Ungroup, Upload } from "lucide-react";
import { SYSTEM_FONTS, FONT_WEIGHTS, FONT_SIZES, PROJECT_FONT_ID } from "@/font/textModel";

const ALIGNS = [
  { value: "left", icon: AlignLeft },
  { value: "center", icon: AlignCenter },
  { value: "right", icon: AlignRight },
  { value: "justify", icon: AlignJustify },
];

function Field({ label, children, w }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, step = 1, min, w = 52 }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="bg-neutral-800 border border-white/10 rounded px-1.5 h-7 text-[12px] text-white w-full focus:outline-none focus:border-violet-500"
      style={{ width: w }}
    />
  );
}

export default function TypeControlBar({ frame, defaults, loadedFonts, onUpdate, onUpdateDefaults, onLoadFont, onCreateOutlines, onUngroup, canCreateOutlines, canUngroup, hasTextSelection }) {
  const fileRef = useRef(null);
  // Edit the selected frame, otherwise the defaults.
  const src = frame || defaults;
  const set = (patch) => (frame ? onUpdate(patch) : onUpdateDefaults(patch));

  const fontFamilies = [PROJECT_FONT_ID, ...loadedFonts.map((l) => l.family), ...SYSTEM_FONTS];
  const uniqueFamilies = [...new Set(fontFamilies)];

  return (
    <div className="flex flex-col gap-1 px-2.5 py-1.5 bg-neutral-900/95 border border-white/10 border-l-0 rounded-r-lg shadow-2xl backdrop-blur">
      {/* Row 1: Typography */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
          <Type size={14} className="text-violet-400" />
        </div>
        <select
          value={src.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value })}
          className="bg-neutral-800 border border-white/10 rounded px-1.5 h-6 text-[11px] text-white max-w-[130px] focus:outline-none focus:border-violet-500"
        >
          <option value={PROJECT_FONT_ID}>DR Project Font</option>
          {loadedFonts.length > 0 && <optgroup label="Loaded Fonts">{loadedFonts.map((l) => <option key={l.name} value={l.family}>{l.name}</option>)}</optgroup>}
          <optgroup label="System Fonts">{SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
        </select>
        <select
          value={src.fontWeight}
          onChange={(e) => set({ fontWeight: e.target.value })}
          className="bg-neutral-800 border border-white/10 rounded px-1 h-6 text-[11px] text-white focus:outline-none focus:border-violet-500"
        >
          {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <Field label="Size">
          <div className="flex items-center gap-1">
            <NumInput value={src.fontSize} onChange={(v) => set({ fontSize: v })} min={1} w={42} />
            <select
              value=""
              onChange={(e) => e.target.value && set({ fontSize: parseInt(e.target.value) })}
              className="bg-neutral-800 border border-white/10 rounded px-1 h-6 text-[10px] text-white/60 focus:outline-none"
            >
              <option value="">pt</option>
              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Track"><NumInput value={src.tracking} onChange={(v) => set({ tracking: v })} w={38} /></Field>
        <Field label="Lead"><NumInput value={src.leading} onChange={(v) => set({ leading: v })} min={50} w={38} /></Field>
        <div className="flex items-center gap-0.5">
          {ALIGNS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.value}
                title={a.value}
                onClick={() => set({ align: a.value })}
                className={`w-6 h-6 grid place-items-center rounded ${src.align === a.value ? "bg-violet-600 text-white" : "text-white/60 hover:bg-white/10"}`}
              >
                <Icon size={12} />
              </button>
            );
          })}
        </div>
      </div>
      {/* Row 2: Actions */}
      <div className="flex items-center gap-2">
        {hasTextSelection && frame && (
          <>
            <button
              title="Lock (use as template)"
              onClick={() => onUpdate({ locked: !frame.locked })}
              className={`w-6 h-6 grid place-items-center rounded ${frame.locked ? "bg-amber-600 text-white" : "text-white/60 hover:bg-white/10"}`}
            >
              {frame.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <Field label="Op">
              <input type="range" min={0} max={100} value={Math.round((frame.opacity ?? 1) * 100)} onChange={(e) => onUpdate({ opacity: parseInt(e.target.value) / 100 })} className="w-14 accent-violet-500" />
            </Field>
            <div className="w-px h-5 bg-white/10" />
          </>
        )}
        <button
          title="Load Font File (.otf/.ttf/.woff2)"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-white/70 hover:bg-white/10"
        >
          <Upload size={11} /> Load Font
        </button>
        <input ref={fileRef} type="file" accept=".otf,.ttf,.woff2,.woff" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await onLoadFont(f); e.target.value = ""; }} />
        <button
          disabled={!canCreateOutlines}
          onClick={onCreateOutlines}
          title="Convert selected text to editable Bézier outlines (⌘⇧O)"
          className="flex items-center gap-1 h-6 px-2 rounded bg-violet-600 text-white text-[10px] font-medium hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600"
        >
          <Wand2 size={11} /> Create Outlines
        </button>
        <button
          disabled={!canUngroup}
          onClick={onUngroup}
          title="Ungroup selected outlines into separate objects"
          className="flex items-center gap-1 h-6 px-1.5 rounded text-[10px] text-white/70 hover:bg-white/10 disabled:opacity-40"
        >
          <Ungroup size={11} /> Ungroup
        </button>
      </div>
    </div>
  );
}