import React, { useEffect, useRef, useState } from "react";
import {
  hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb,
  rgbToCmyk, cmykToRgb, parseHexAlpha,
} from "@/font/appearance";
import { Pipette, X, Plus, Trash2, Pencil, Check } from "lucide-react";

const DEFAULT_SWATCHES = [
  { name: "Black", color: "#000000" },
  { name: "White", color: "#ffffff" },
  { name: "Gray", color: "#7f7f7f" },
  { name: "Red", color: "#ef4444" },
  { name: "Orange", color: "#f97316" },
  { name: "Yellow", color: "#eab308" },
  { name: "Green", color: "#22c55e" },
  { name: "Cyan", color: "#06b6d4" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Purple", color: "#8b5cf6" },
  { name: "Magenta", color: "#ec4899" },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const checker = "repeating-conic-gradient(#3f3f46 0% 25%, #52525b 0% 50%) 50% / 10px 10px";

export default function ColorPicker({ target, value, original, onChange, onConfirm, onCancel, swatches, onSwatchesChange, recent, onRecentChange }) {
  const [hex, setHex] = useState(value?.hex || "#000000");
  const [alpha, setAlpha] = useState(value?.alpha != null ? value.alpha : 1);
  const [model, setModel] = useState("hsb");
  const [hexFocused, setHexFocused] = useState(false);
  const [hexDraft, setHexDraft] = useState("");
  const [editingSwatch, setEditingSwatch] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const alphaRef = useRef(null);

  const { r, g, b } = hexToRgb(hex);
  const { h, s, v } = rgbToHsv(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const hexDisplay = "#" + hex.replace("#", "") + Math.round(alpha * 255).toString(16).padStart(2, "0");

  useEffect(() => { if (!hexFocused) setHexDraft(hexDisplay); }, [hexDisplay, hexFocused]);

  const emit = (newHex, newAlpha = alpha) => {
    setHex(newHex);
    if (newAlpha != null) setAlpha(newAlpha);
    onChange && onChange(newHex, newAlpha != null ? newAlpha : alpha);
  };

  const startDrag = (fn) => (e) => {
    fn(e);
    const move = (ev) => fn(ev);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onSV = (e) => {
    const rect = svRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const { r, g, b } = hsvToRgb(h, x, 1 - y);
    emit(rgbToHex(r, g, b));
  };
  const onHue = (e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const nh = clamp(((e.clientX - rect.left) / rect.width) * 360, 0, 360);
    const { r, g, b } = hsvToRgb(nh, s, v);
    emit(rgbToHex(r, g, b));
  };
  const onAlpha = (e) => {
    const rect = alphaRef.current.getBoundingClientRect();
    const na = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    emit(hex, na);
  };

  const setRgb = (nr, ng, nb) => emit(rgbToHex(clamp(nr, 0, 255), clamp(ng, 0, 255), clamp(nb, 0, 255)));
  const setHsv = (nh, ns, nv) => { const { r, g, b } = hsvToRgb(((nh % 360) + 360) % 360, clamp(ns, 0, 100) / 100, clamp(nv, 0, 100) / 100); emit(rgbToHex(r, g, b)); };
  const setHsl = (nh, ns, nl) => { const { r, g, b } = hslToRgb(((nh % 360) + 360) % 360, clamp(ns, 0, 100) / 100, clamp(nl, 0, 100) / 100); emit(rgbToHex(r, g, b)); };
  const setCmyk = (nc, nm, ny, nk) => { const { r, g, b } = cmykToRgb(nc, nm, ny, nk); emit(rgbToHex(r, g, b)); };

  const onHexInput = (val) => {
    setHexDraft(val);
    const parsed = parseHexAlpha(val);
    if (parsed) { setHex(parsed.hex); setAlpha(parsed.alpha); onChange && onChange(parsed.hex, parsed.alpha); }
  };

  const sample = async () => {
    if (window.EyeDropper) {
      try { const res = await new window.EyeDropper().open(); const p = parseHexAlpha(res.sRGBHex); if (p) emit(p.hex, p.alpha); } catch {}
    }
  };

  const projSwatches = swatches && swatches.length ? swatches : DEFAULT_SWATCHES.map((s, i) => ({ id: "d" + i, ...s }));
  const isCustom = (id) => id && !String(id).startsWith("d");
  const addSwatch = () => { if (!onSwatchesChange) return; onSwatchesChange([...projSwatches, { id: "s" + Date.now(), name: "Swatch " + (projSwatches.length + 1), color: hex }]); };
  const deleteSwatch = (id) => { onSwatchesChange && onSwatchesChange(projSwatches.filter((s) => s.id !== id)); };
  const startRename = (s) => { setEditingSwatch(s.id); setRenameVal(s.name); };
  const commitRename = () => { onSwatchesChange && onSwatchesChange(projSwatches.map((s) => s.id === editingSwatch ? { ...s, name: renameVal || s.name } : s)); setEditingSwatch(null); };

  const pushRecent = (color) => { if (!onRecentChange || !color) return; onRecentChange([color, ...(recent || []).filter((c) => c !== color)].slice(0, 12)); };
  const applySwatch = (color) => { emit(color, alpha); pushRecent(color); };

  const confirm = () => { pushRecent(hex); onConfirm && onConfirm(hex, alpha); };
  const cancel = () => { onCancel && onCancel(); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Enter") { e.preventDefault(); confirm(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={cancel}>
      <div className="w-[340px] bg-neutral-900 border border-white/15 rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 h-9 border-b border-white/10">
          <span className="text-[12px] font-medium text-white">{target === "stroke" ? "Stroke Color" : "Fill Color"}</span>
          <button onClick={cancel} className="text-white/50 hover:text-white"><X size={15} /></button>
        </div>
        <div className="p-3 space-y-3">
          {/* SV field */}
          <div ref={svRef} onPointerDown={startDrag(onSV)} className="relative h-44 rounded cursor-crosshair overflow-hidden" style={{ background: `hsl(${h},100%,50%)` }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right,#fff,rgba(255,255,255,0))" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top,#000,rgba(0,0,0,0))" }} />
            <div className="absolute w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, boxShadow: "0 0 0 2px #fff, 0 0 0 3px #000" }} />
          </div>
          {/* Hue */}
          <div ref={hueRef} onPointerDown={startDrag(onHue)} className="relative h-3 rounded cursor-pointer" style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}>
            <div className="absolute top-1/2 w-3 h-5 -translate-x-1/2 -translate-y-1/2 rounded-sm pointer-events-none" style={{ left: `${(h / 360) * 100}%`, boxShadow: "0 0 0 2px #fff, 0 0 0 3px #000" }} />
          </div>
          {/* Alpha */}
          <div ref={alphaRef} onPointerDown={startDrag(onAlpha)} className="relative h-3 rounded cursor-pointer overflow-hidden" style={{ background: checker }}>
            <div className="absolute inset-0" style={{ background: `linear-gradient(to right,rgba(0,0,0,0),${hex})` }} />
            <div className="absolute top-1/2 w-3 h-5 -translate-x-1/2 -translate-y-1/2 rounded-sm pointer-events-none" style={{ left: `${alpha * 100}%`, boxShadow: "0 0 0 2px #fff, 0 0 0 3px #000" }} />
          </div>

          {/* Original / New preview */}
          <div className="flex items-center gap-2">
            <div className="flex rounded overflow-hidden border border-white/15 h-9 flex-1">
              <div className="flex-1 relative" style={{ background: checker }}>
                {original?.hex && <div className="absolute inset-0" style={{ background: original.hex, opacity: original.alpha != null ? original.alpha : 1 }} />}
              </div>
              <div className="flex-1 relative" style={{ background: checker }}>
                <div className="absolute inset-0" style={{ background: hex, opacity: alpha }} />
              </div>
            </div>
            <div className="text-[10px] text-white/40 leading-tight w-10">
              <div>Current</div><div>New</div>
            </div>
          </div>

          {/* Model tabs */}
          <div className="flex gap-1">
            {["hsb", "rgb", "hsl", "cmyk", "hex"].map((m) => (
              <button key={m} onClick={() => setModel(m)} className={`flex-1 h-6 text-[10px] uppercase rounded ${model === m ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/50"}`}>{m}</button>
            ))}
          </div>

          {/* Numeric inputs */}
          {model === "hex" && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded border border-white/15 relative overflow-hidden" style={{ background: checker }}>
                <div className="absolute inset-0" style={{ background: hex, opacity: alpha }} />
              </div>
              <input
                value={hexFocused ? hexDraft : hexDisplay}
                onFocus={() => setHexFocused(true)}
                onBlur={() => setHexFocused(false)}
                onChange={(e) => onHexInput(e.target.value)}
                className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white font-mono focus:outline-none focus:border-violet-500"
              />
            </div>
          )}
          {model === "rgb" && (
            <div className="grid grid-cols-3 gap-2">
              <NumField label="R" value={r} min={0} max={255} onChange={(x) => setRgb(x, g, b)} />
              <NumField label="G" value={g} min={0} max={255} onChange={(x) => setRgb(r, x, b)} />
              <NumField label="B" value={b} min={0} max={255} onChange={(x) => setRgb(r, g, x)} />
            </div>
          )}
          {model === "hsb" && (
            <div className="grid grid-cols-3 gap-2">
              <NumField label="H" value={Math.round(h)} min={0} max={360} onChange={(x) => setHsv(x, s * 100, v * 100)} />
              <NumField label="S" value={Math.round(s * 100)} min={0} max={100} onChange={(x) => setHsv(h, x, v * 100)} />
              <NumField label="B" value={Math.round(v * 100)} min={0} max={100} onChange={(x) => setHsv(h, s * 100, x)} />
            </div>
          )}
          {model === "hsl" && (
            <div className="grid grid-cols-3 gap-2">
              <NumField label="H" value={Math.round(hsl.h)} min={0} max={360} onChange={(x) => setHsl(x, hsl.s * 100, hsl.l * 100)} />
              <NumField label="S" value={Math.round(hsl.s * 100)} min={0} max={100} onChange={(x) => setHsl(hsl.h, x, hsl.l * 100)} />
              <NumField label="L" value={Math.round(hsl.l * 100)} min={0} max={100} onChange={(x) => setHsl(hsl.h, hsl.s * 100, x)} />
            </div>
          )}
          {model === "cmyk" && (
            <div className="grid grid-cols-4 gap-2">
              <NumField label="C" value={cmyk.c} min={0} max={100} onChange={(x) => setCmyk(x, cmyk.m, cmyk.y, cmyk.k)} />
              <NumField label="M" value={cmyk.m} min={0} max={100} onChange={(x) => setCmyk(cmyk.c, x, cmyk.y, cmyk.k)} />
              <NumField label="Y" value={cmyk.y} min={0} max={100} onChange={(x) => setCmyk(cmyk.c, cmyk.m, x, cmyk.k)} />
              <NumField label="K" value={cmyk.k} min={0} max={100} onChange={(x) => setCmyk(cmyk.c, cmyk.m, cmyk.y, x)} />
            </div>
          )}

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50 w-14">Opacity</span>
            <input type="range" min={0} max={100} value={Math.round(alpha * 100)} onChange={(e) => emit(hex, +e.target.value / 100)} className="flex-1 accent-violet-500" />
            <input type="number" min={0} max={100} value={Math.round(alpha * 100)} onChange={(e) => emit(hex, clamp(+e.target.value, 0, 100) / 100)} className="w-14 bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500" />
            <span className="text-[11px] text-white/40">%</span>
          </div>

          {/* Eyedropper + None */}
          <div className="flex gap-2">
            <button onClick={sample} className="flex items-center gap-1.5 px-3 h-8 text-[12px] rounded bg-neutral-800 text-white/70 hover:bg-white/10"><Pipette size={14} /> Sample</button>
            <button onClick={() => { onConfirm && onConfirm(null, alpha); }} className="flex items-center gap-1.5 px-3 h-8 text-[12px] rounded bg-neutral-800 text-white/70 hover:bg-white/10">None</button>
          </div>

          {/* Swatches */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40">Swatches</span>
              <button onClick={addSwatch} className="text-violet-400 hover:text-violet-300 flex items-center gap-1 text-[10px]"><Plus size={11} /> Add</button>
            </div>
            <div className="grid grid-cols-11 gap-1">
              {projSwatches.map((s) => (
                <div key={s.id} className="group relative">
                  <button onClick={() => applySwatch(s.color)} title={s.name} className="w-4 h-4 rounded border border-white/15 block" style={{ background: s.color }} />
                  {isCustom(s.id) && (
                    <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5 z-10">
                      <button onClick={(e) => { e.stopPropagation(); startRename(s); }} className="bg-neutral-700 rounded p-0.5"><Pencil size={8} className="text-white" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteSwatch(s.id); }} className="bg-neutral-700 rounded p-0.5"><Trash2 size={8} className="text-white" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editingSwatch && (
              <div className="flex items-center gap-1 mt-1">
                <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 h-6 text-[11px] text-white" autoFocus onKeyDown={(e) => { if (e.key === "Enter") commitRename(); }} />
                <button onClick={commitRename} className="px-2 h-6 grid place-items-center rounded bg-violet-600 text-white"><Check size={11} /></button>
              </div>
            )}
          </div>

          {/* Recent */}
          {recent && recent.length > 0 && (
            <div>
              <div className="text-[10px] text-white/40 mb-1">Recent</div>
              <div className="grid grid-cols-11 gap-1">
                {recent.map((c, i) => (
                  <button key={i} onClick={() => applySwatch(c)} className="w-4 h-4 rounded border border-white/15" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
          )}

          {/* OK / Cancel */}
          <div className="flex justify-end gap-2 pt-1 border-t border-white/10">
            <button onClick={cancel} className="px-4 h-8 text-[12px] rounded bg-neutral-800 text-white/70 hover:bg-white/10">Cancel</button>
            <button onClick={confirm} className="px-4 h-8 text-[12px] rounded bg-violet-600 text-white hover:bg-violet-500">OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <span className="text-[9px] text-white/40">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value || 0)} className="w-full bg-neutral-800 border border-white/10 rounded px-1.5 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500" />
    </label>
  );
}