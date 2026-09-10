import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import ColorPicker from "./ColorPicker";
import { getAppearance, isGradientFill, solidFillOf, gradientToCss } from "@/font/appearance";

const checker = "repeating-conic-gradient(#3f3f46 0% 25%, #52525b 0% 50%) 50% / 6px 6px";
const noneMark = "linear-gradient(45deg,transparent 46%,#ef4444 47%,#ef4444 53%,transparent 54%)";

function FillBox({ value }) {
  const isNone = value == null;
  const bg = isNone ? checker : isGradientFill(value) ? gradientToCss(value) : value;
  return (
    <div className="absolute inset-0 rounded-full border border-black/40" style={{ background: bg }}>
      {isNone && <div className="absolute inset-0 rounded-full" style={{ background: noneMark }} />}
    </div>
  );
}

function StrokeBox({ value }) {
  const isNone = value == null;
  const color = isNone ? "#52525b" : isGradientFill(value) ? (value.stops?.[0]?.color || "#000000") : value;
  return (
    <div className="absolute inset-0 rounded-full" style={{ border: `2px solid ${color}`, background: "transparent" }}>
      {isNone && <div className="absolute inset-0 rounded-full" style={{ background: noneMark }} />}
    </div>
  );
}

export default function FillStrokeWidget({ focus, setFocus, glyph, selContours, apply, project, onProject, swap, resetDefault, color, gradient, none, onSolidPicked }) {
  const [picker, setPicker] = useState(null);
  const hasSel = selContours.length > 0;
  const first = hasSel ? glyph.contours[selContours[0]] : null;
  const a = first ? getAppearance(first) : { fill: "#FFFFFF", fillOpacity: 1, stroke: "#000000", strokeWidth: 1, strokeOpacity: 1 };
  const fillVal = a.fill;
  const strokeVal = a.strokeWidth > 0 ? a.stroke : null;

  const openPicker = (target) => {
    if (!hasSel) return;
    const original = target === "fill"
      ? { hex: solidFillOf(a.fill) || "#000000", alpha: a.fillOpacity }
      : { hex: solidFillOf(a.stroke) || "#000000", alpha: a.strokeOpacity };
    setPicker({ target, original, nonce: Date.now() });
  };
  const liveChange = (hex, alpha) => {
    if (picker.target === "fill") apply({ fill: hex, fillOpacity: alpha });
    else apply({ stroke: hex, strokeOpacity: alpha, strokeWidth: hex ? Math.max(a.strokeWidth, 1) : 0 });
  };
  const confirmPicker = (hex, alpha) => {
    liveChange(hex, alpha);
    if (hex) onSolidPicked?.(hex);
    setPicker(null);
  };
  const cancelPicker = () => {
    const { target, original } = picker;
    if (target === "fill") apply({ fill: original.hex, fillOpacity: original.alpha });
    else apply({ stroke: original.hex, strokeOpacity: original.alpha, strokeWidth: original.hex ? Math.max(a.strokeWidth, 1) : 0 });
    setPicker(null);
  };

  const fillFront = focus === "fill";
  const frontStyle = { left: 0, top: 0, zIndex: 2 };
  const backStyle = { left: 9, top: 9, zIndex: 1 };

  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      <div className="relative" style={{ width: 44, height: 44 }}>
        {/* Swap — top-right */}
        <button
          title="Swap Fill & Stroke (Shift+X)"
          onClick={swap}
          disabled={!hasSel}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 grid place-items-center rounded-full bg-neutral-800 border border-white/15 text-white/70 hover:text-white hover:bg-neutral-700 disabled:opacity-30 z-10"
        >
          <ArrowLeftRight size={12} strokeWidth={2} />
        </button>
        {/* Default — bottom-left */}
        <button
          title="Default Fill & Stroke (D)"
          onClick={resetDefault}
          disabled={!hasSel}
          className="absolute -bottom-1.5 -left-1.5 w-6 h-6 grid place-items-center rounded-full bg-neutral-800 border border-white/15 disabled:opacity-30 z-10"
        >
          <span className="block w-3.5 h-3.5 rounded-full bg-white border border-black" />
        </button>
        {/* Stroke circle */}
        <div
          className="absolute w-8 h-8"
          style={fillFront ? backStyle : frontStyle}
          onClick={() => setFocus("stroke")}
          onDoubleClick={() => { setFocus("stroke"); openPicker("stroke"); }}
        >
          <StrokeBox value={strokeVal} />
        </div>
        {/* Fill circle */}
        <div
          className="absolute w-8 h-8"
          style={fillFront ? frontStyle : backStyle}
          onClick={() => setFocus("fill")}
          onDoubleClick={() => { setFocus("fill"); openPicker("fill"); }}
        >
          <FillBox value={fillVal} />
        </div>
      </div>

      {/* Quick-set triad */}
      <div className="flex flex-col gap-0.5">
        <button
          title="Color (,)"
          onClick={color}
          disabled={!hasSel}
          className="w-9 h-7 grid place-items-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <span className="block w-4 h-4 rounded-sm border border-white/30" style={{ background: "#e5e7eb" }} />
        </button>
        <button
          title="Gradient (.)"
          onClick={gradient}
          disabled={!hasSel}
          className="w-9 h-7 grid place-items-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <span className="block w-4 h-4 rounded-sm border border-white/30" style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
        </button>
        <button
          title="None (/)"
          onClick={none}
          disabled={!hasSel}
          className="w-9 h-7 grid place-items-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <span className="block w-4 h-4 rounded-sm border border-white/30 bg-white relative overflow-hidden">
            <span className="absolute inset-0" style={{ background: noneMark }} />
          </span>
        </button>
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
          swatches={project.swatches || []}
          onSwatchesChange={(sw) => onProject({ ...project, swatches: sw })}
          recent={project.recentColors || []}
          onRecentChange={(rc) => onProject({ ...project, recentColors: rc })}
        />
      )}
    </div>
  );
}