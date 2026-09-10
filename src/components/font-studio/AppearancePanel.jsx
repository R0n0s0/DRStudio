import React, { useState } from "react";
import ColorPicker from "./ColorPicker";
import {
  getAppearance, setAppearance, copyAppearance, hasAppearanceClip, getAppearanceClip, reorderContours,
  isGradientFill, gradientToCss, solidFillOf,
} from "@/font/appearance";
import { Lock, Unlock, BringToFront, SendToBack, ChevronUp, ChevronDown, Copy, ClipboardPaste, SlidersHorizontal, ArrowLeftRight, RotateCcw, EyeOff } from "lucide-react";

const checker = "repeating-conic-gradient(#3f3f46 0% 25%, #52525b 0% 50%) 50% / 8px 8px";

function Swatch({ color, alpha = 1, onClick, title }) {
  return (
    <button onClick={onClick} title={title} className="w-9 h-9 rounded border border-white/15 relative overflow-hidden shrink-0">
      {color == null ? (
        <div className="absolute inset-0" style={{ background: checker }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(45deg,transparent 46%,#ef4444 47%,#ef4444 53%,transparent 54%)" }} />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: checker }}>
          <div className="absolute inset-0" style={{ background: isGradientFill(color) ? gradientToCss(color) : color, opacity: alpha }} />
        </div>
      )}
    </button>
  );
}

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-[12px] text-white/55 shrink-0">{label}</span>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);
const Num = ({ value, onChange, w = "w-16", min, max, step }) => (
  <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(+e.target.value || 0)} className={`${w} bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500`} />
);

export default function AppearancePanel({ glyph, onGlyph, selContours, onSelectContours, swatches, onSwatchesChange, recent, onRecentChange }) {
  const [picker, setPicker] = useState(null);
  const [showAdv, setShowAdv] = useState(false);
  const [clipReady, setClipReady] = useState(hasAppearanceClip());

  if (!selContours.length) {
    return <div className="p-3 text-[12px] text-white/40">Select a contour to edit its appearance.</div>;
  }
  const first = glyph.contours[selContours[0]];
  if (!first) return null;
  const a = getAppearance(first);

  const apply = (patch) => {
    const contours = glyph.contours.map((c, i) => (selContours.includes(i) ? setAppearance(c, patch) : c));
    onGlyph({ ...glyph, contours });
  };

  const openPicker = (target) => {
    const original = target === "fill" ? { hex: solidFillOf(a.fill) || "#000000", alpha: a.fillOpacity } : { hex: solidFillOf(a.stroke) || "#000000", alpha: a.strokeOpacity };
    setPicker({ target, original, nonce: Date.now() });
  };
  const liveChange = (hex, alpha) => {
    if (picker.target === "fill") apply({ fill: hex, fillOpacity: alpha });
    else apply({ stroke: hex, strokeOpacity: alpha, strokeWidth: hex ? Math.max(a.strokeWidth, 1) : 0 });
  };
  const confirmPicker = (hex, alpha) => {
    if (picker.target === "fill") apply({ fill: hex, fillOpacity: alpha });
    else apply({ stroke: hex, strokeOpacity: alpha, strokeWidth: hex ? Math.max(a.strokeWidth, 1) : 0 });
    setPicker(null);
  };
  const cancelPicker = () => {
    const { target, original } = picker;
    if (target === "fill") apply({ fill: original.hex, fillOpacity: original.alpha });
    else apply({ stroke: original.hex, strokeOpacity: original.alpha, strokeWidth: original.hex ? Math.max(a.strokeWidth, 1) : 0 });
    setPicker(null);
  };

  const swap = () => apply({ fill: a.stroke, fillOpacity: a.strokeOpacity, stroke: a.fill, strokeOpacity: a.fillOpacity, strokeWidth: a.fill ? Math.max(a.strokeWidth, 1) : 0 });
  const defaultFillStroke = () => apply({ fill: "#000000", fillOpacity: 1, stroke: null, strokeWidth: 0, strokeOpacity: 1 });
  const removeFill = () => apply({ fill: null });
  const removeStroke = () => apply({ stroke: null, strokeWidth: 0 });

  const doCopy = () => { copyAppearance(first); setClipReady(true); };
  const doPaste = () => { if (hasAppearanceClip()) apply(getAppearanceClip()); };
  const doReorder = (dir) => {
    const { contours, sel } = reorderContours(glyph.contours, selContours, dir);
    onGlyph({ ...glyph, contours });
    onSelectContours(sel);
  };
  const toggleLock = () => {
    const contours = glyph.contours.map((c, i) => (selContours.includes(i) ? { ...c, locked: !c.locked } : c));
    onGlyph({ ...glyph, contours });
  };
  const anyLocked = selContours.some((i) => glyph.contours[i]?.locked);

  const Sel = ({ value, onChange, options }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500">
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="relative">
      <div className="p-3 space-y-2">
        {/* Object ops */}
        <div className="flex items-center gap-1 pb-2 border-b border-white/10">
          <button title="Bring to front" onClick={() => doReorder("front")} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><BringToFront size={14} /></button>
          <button title="Bring forward" onClick={() => doReorder("forward")} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><ChevronUp size={14} /></button>
          <button title="Send backward" onClick={() => doReorder("backward")} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><ChevronDown size={14} /></button>
          <button title="Send to back" onClick={() => doReorder("back")} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><SendToBack size={14} /></button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button title={anyLocked ? "Unlock" : "Lock"} onClick={toggleLock} className={`w-7 h-7 grid place-items-center rounded ${anyLocked ? "bg-violet-600 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>{anyLocked ? <Lock size={14} /> : <Unlock size={14} />}</button>
          <div className="flex-1" />
          <button title="Copy appearance" onClick={doCopy} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><Copy size={14} /></button>
          <button title="Paste appearance" onClick={doPaste} disabled={!clipReady} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"><ClipboardPaste size={14} /></button>
        </div>

        {/* Fill / Stroke with swap / default / remove */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Swatch color={a.fill} alpha={a.fillOpacity} title="Fill color" onClick={() => openPicker("fill")} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white/40">Fill</div>
                <div className="text-[11px] text-white/70 font-mono truncate">{a.fill == null ? "None" : isGradientFill(a.fill) ? "Gradient" : a.fill}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Swatch color={a.strokeWidth > 0 ? a.stroke : null} alpha={a.strokeOpacity} title="Stroke color" onClick={() => openPicker("stroke")} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-white/40">Stroke</div>
                <div className="text-[11px] text-white/70 font-mono truncate">{a.strokeWidth > 0 && a.stroke ? (isGradientFill(a.stroke) ? "Gradient" : a.stroke) : "None"}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 justify-center">
            <button title="Swap Fill / Stroke" onClick={swap} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><ArrowLeftRight size={14} /></button>
            <button title="Default Fill / Stroke" onClick={defaultFillStroke} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><RotateCcw size={14} /></button>
            <button title="Remove Fill" onClick={removeFill} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><EyeOff size={14} /></button>
            <button title="Remove Stroke" onClick={removeStroke} className="w-7 h-7 grid place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"><EyeOff size={14} className="text-rose-400" /></button>
          </div>
        </div>

        <div className="h-px bg-white/10 my-1" />

        <Row label="Stroke width">
          <input type="range" min={0} max={100} step={0.25} value={a.strokeWidth} onChange={(e) => apply({ strokeWidth: +e.target.value, stroke: a.stroke || "#000000" })} className="flex-1 accent-violet-500" />
          <Num value={a.strokeWidth} min={0} max={1000} step={0.25} onChange={(v) => apply({ strokeWidth: Math.max(0, v), stroke: a.stroke || "#000000" })} w="w-16" />
        </Row>
        <Row label="Fill opacity"><Num value={Math.round(a.fillOpacity * 100)} min={0} max={100} onChange={(v) => apply({ fillOpacity: Math.max(0, Math.min(100, v)) / 100 })} />%</Row>
        <Row label="Stroke opacity"><Num value={Math.round(a.strokeOpacity * 100)} min={0} max={100} onChange={(v) => apply({ strokeOpacity: Math.max(0, Math.min(100, v)) / 100 })} />%</Row>
        <Row label="Object opacity"><Num value={Math.round(a.opacity * 100)} min={0} max={100} onChange={(v) => apply({ opacity: Math.max(0, Math.min(100, v)) / 100 })} />%</Row>

        <button onClick={() => setShowAdv((v) => !v)} className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 pt-1">
          <SlidersHorizontal size={12} /> {showAdv ? "Hide advanced" : "Advanced"}
        </button>
        {showAdv && (
          <div className="space-y-1 pt-1 border-t border-white/10">
            <Row label="Cap"><Sel value={a.cap} onChange={(v) => apply({ cap: v })} options={[{ id: "butt", label: "Butt" }, { id: "round", label: "Round" }, { id: "square", label: "Square" }]} /></Row>
            <Row label="Join"><Sel value={a.join} onChange={(v) => apply({ join: v })} options={[{ id: "miter", label: "Miter" }, { id: "round", label: "Round" }, { id: "bevel", label: "Bevel" }]} /></Row>
            <Row label="Dashes">
              <Sel value={a.dashPattern ? "dashed" : "solid"} onChange={(v) => apply({ dashPattern: v === "dashed" ? [40, 30, 0, 0, 0, 0] : null, dashOffset: 0 })} options={[{ id: "solid", label: "Solid" }, { id: "dashed", label: "Dashed" }]} />
            </Row>
            {a.dashPattern && (
              <>
                <Row label="Dash"><Num value={a.dashPattern[0]} onChange={(v) => apply({ dashPattern: [v, a.dashPattern[1], 0, 0, 0, 0] })} /></Row>
                <Row label="Gap"><Num value={a.dashPattern[1]} onChange={(v) => apply({ dashPattern: [a.dashPattern[0], v, 0, 0, 0, 0] })} /></Row>
                <Row label="Offset"><Num value={a.dashOffset || 0} onChange={(v) => apply({ dashOffset: v })} /></Row>
              </>
            )}
          </div>
        )}
      </div>

      {picker && (
        <ColorPicker
          key={picker.nonce}
          target={picker.target}
          value={picker.original}
          original={picker.original}
          onChange={liveChange}
          onConfirm={confirmPicker}
          onCancel={cancelPicker}
          swatches={swatches}
          onSwatchesChange={onSwatchesChange}
          recent={recent}
          onRecentChange={onRecentChange}
        />
      )}
    </div>
  );
}