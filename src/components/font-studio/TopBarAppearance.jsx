import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import ColorPicker from "./ColorPicker";
import { getAppearance, isGradientFill, gradientToCss, solidFillOf } from "@/font/appearance";
import { WIDTH_PROFILES } from "@/font/strokeRender";

const checker = "repeating-conic-gradient(#3f3f46 0% 25%, #52525b 0% 50%) 50% / 6px 6px";
const noneMark = "linear-gradient(45deg,transparent 46%,#ef4444 47%,#ef4444 53%,transparent 54%)";

const StepNum = ({ value, onChange, min = 0, step = 0.25, w = "w-[64px]" }) => {
  const stepBy = (dir) => onChange(Math.max(min, +(value + dir * step).toFixed(2)));
  return (
    <div className={`flex items-center ${w} bg-neutral-800 border border-white/10 rounded h-6`}>
      <button onClick={() => stepBy(-1)} className="w-4 text-white/50 hover:text-white text-xs">−</button>
      <input type="number" value={value} min={min} step={step}
        onChange={(e) => onChange(+e.target.value || 0)}
        className="flex-1 min-w-0 w-0 bg-transparent text-[11px] text-white text-center focus:outline-none" />
      <button onClick={() => stepBy(1)} className="w-4 text-white/50 hover:text-white text-xs">+</button>
    </div>
  );
};

function Drop({ trigger, children, align = "left", width, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => { if (!disabled) setOpen((v) => !v); }} className={disabled ? "opacity-40 pointer-events-none" : ""}>{trigger}</div>
      {open && !disabled && (
        <div className={`absolute top-7 ${align === "right" ? "right-0" : "left-0"} ${width || "min-w-[150px]"} bg-neutral-800 border border-white/10 rounded-md shadow-xl py-1 z-50`}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

const Item = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 h-7 text-[11px] text-left ${active ? "bg-violet-600/30 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{children}</button>
);
const Sep = () => <div className="h-px bg-white/10 my-1" />;
const Label = ({ children }) => <div className="px-2.5 text-[9px] uppercase tracking-wider text-white/30 mb-0.5">{children}</div>;

const ProfileGraphic = ({ id }) => (
  <svg width="26" height="12" viewBox="0 0 26 12" className="text-white/80 shrink-0">
    {id === "uniform" ? <rect x="2" y="4" width="22" height="4" rx="1" fill="currentColor" />
      : id === "width1" ? <ellipse cx="13" cy="6" rx="10" ry="4" fill="currentColor" />
      : id === "width3" ? <polygon points="2,6 13,2 24,6 13,10" fill="currentColor" />
      : <path d="M2 6 Q8 2 13 6 T24 6" stroke="currentColor" strokeWidth="3.5" fill="none" />}
  </svg>
);
const LineGraphic = ({ dashed }) => (
  <svg width="22" height="10" viewBox="0 0 22 10" className="text-white/80 shrink-0">
    <line x1="2" y1="5" x2="20" y2="5" stroke="currentColor" strokeWidth="2.5" strokeDasharray={dashed ? "4 3" : "none"} />
  </svg>
);

// Top-bar Appearance: Fill / Stroke / Stroke width / Profile / Line / Opacity.
export default function TopBarAppearance({ fillStroke }) {
  const { setFocus, glyph, selContours, apply, project, onProject, onSolidPicked } = fillStroke;
  const [picker, setPicker] = useState(null);
  const [opOpen, setOpOpen] = useState(false);
  const opRef = useRef(null);
  useEffect(() => {
    if (!opOpen) return;
    const h = (e) => { if (opRef.current && !opRef.current.contains(e.target)) setOpOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [opOpen]);

  const hasSel = selContours.length > 0;
  const first = hasSel ? glyph.contours[selContours[0]] : null;
  const a = first ? getAppearance(first) : { fill: "#FFFFFF", fillOpacity: 1, stroke: "#000000", strokeWidth: 1, strokeOpacity: 1, opacity: 1 };
  const strokeColor = a.strokeWidth > 0 ? a.stroke : null;
  const dis = !hasSel ? "opacity-40 pointer-events-none" : "";

  const openPicker = (target) => {
    if (!hasSel) return;
    setFocus(target);
    const original = target === "fill"
      ? { hex: solidFillOf(a.fill) || "#000000", alpha: a.fillOpacity }
      : { hex: solidFillOf(a.stroke) || "#000000", alpha: a.strokeOpacity };
    setPicker({ target, original, nonce: Date.now() });
  };
  const liveChange = (hex, alpha) => {
    if (picker.target === "fill") apply({ fill: hex, fillOpacity: alpha });
    else apply({ stroke: hex, strokeOpacity: alpha, strokeWidth: hex ? Math.max(a.strokeWidth, 1) : 0 });
  };
  const confirmPicker = (hex, alpha) => { liveChange(hex, alpha); if (hex) onSolidPicked?.(hex); setPicker(null); };
  const cancelPicker = () => {
    const { target, original } = picker;
    if (target === "fill") apply({ fill: original.hex, fillOpacity: original.alpha });
    else apply({ stroke: original.hex, strokeOpacity: original.alpha, strokeWidth: original.hex ? Math.max(a.strokeWidth, 1) : 0 });
    setPicker(null);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Fill */}
      <button title="Fill" onClick={() => openPicker("fill")} disabled={!hasSel}
        className="flex items-center gap-0.5 h-6 pl-0.5 pr-1 rounded border border-white/10 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30">
        <span className="relative w-5 h-5 rounded-sm overflow-hidden border border-white/15"
          style={{ background: a.fill == null ? checker : isGradientFill(a.fill) ? gradientToCss(a.fill) : a.fill }}>
          {a.fill == null && <span className="absolute inset-0" style={{ background: noneMark }} />}
        </span>
        <ChevronDown size={10} className="text-white/40" />
      </button>
      {/* Stroke */}
      <button title="Stroke" onClick={() => openPicker("stroke")} disabled={!hasSel}
        className="flex items-center gap-0.5 h-6 pl-0.5 pr-1 rounded border border-white/10 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30">
        <span className="relative w-5 h-5 rounded-sm"
          style={{ border: `2px solid ${strokeColor == null ? "#52525b" : isGradientFill(strokeColor) ? (strokeColor.stops?.[0]?.color || "#000") : strokeColor}`, background: "transparent" }}>
          {strokeColor == null && <span className="absolute inset-0" style={{ background: noneMark }} />}
        </span>
        <ChevronDown size={10} className="text-white/40" />
      </button>

      <div className="w-px h-4 bg-white/10" />

      {/* Stroke width */}
      <div title="Stroke width" className={`flex items-center gap-1 ${dis}`}>
        <span className="text-[11px] text-white/50">Stroke:</span>
        <StepNum value={a.strokeWidth} step={0.25}
          onChange={(v) => apply({ strokeWidth: Math.max(0, v), stroke: a.stroke || "#000000" })} />
      </div>

      {/* Stroke Profile */}
      <Drop disabled={!hasSel} align="left" trigger={
        <button title="Stroke Profile" className="flex items-center gap-1 h-6 px-1.5 rounded border border-white/10 bg-neutral-800 text-white/80 hover:bg-neutral-700">
          <ProfileGraphic id={a.widthProfile || "uniform"} />
          <ChevronDown size={10} className="text-white/40" />
        </button>
      }>
        {(close) => WIDTH_PROFILES.map((p) => (
          <Item key={p.id} active={(a.widthProfile || "uniform") === p.id}
            onClick={() => { apply({ widthProfile: p.id === "uniform" ? null : p.id }); close(); }}>
            <ProfileGraphic id={p.id} /> <span>{p.label}</span>
          </Item>
        ))}
      </Drop>

      {/* Line definition: dashes + cap + join */}
      <Drop disabled={!hasSel} align="left" width="min-w-[170px]" trigger={
        <button title="Line / Caps / Joins" className="flex items-center gap-1 h-6 px-1.5 rounded border border-white/10 bg-neutral-800 text-white/80 hover:bg-neutral-700">
          <LineGraphic dashed={!!a.dashPattern} />
          <span className="text-[11px]">{a.dashPattern ? "Dashed" : "Basic"}</span>
          <ChevronDown size={10} className="text-white/40" />
        </button>
      }>
        {(close) => (<>
          <Item active={!a.dashPattern} onClick={() => { apply({ dashPattern: null, dashOffset: 0 }); close(); }}><LineGraphic dashed={false} /> Solid</Item>
          <Item active={!!a.dashPattern} onClick={() => { apply({ dashPattern: a.dashPattern || [40, 30, 0, 0, 0, 0] }); close(); }}><LineGraphic dashed={true} /> Dashed</Item>
          <Sep />
          <Label>Cap</Label>
          {["butt", "round", "square"].map((c) => (
            <Item key={c} active={(a.cap || "butt") === c} onClick={() => { apply({ cap: c }); close(); }}>{c.charAt(0).toUpperCase() + c.slice(1)}</Item>
          ))}
          <Sep />
          <Label>Join</Label>
          {["miter", "round", "bevel"].map((j) => (
            <Item key={j} active={(a.join || "miter") === j} onClick={() => { apply({ join: j }); close(); }}>{j.charAt(0).toUpperCase() + j.slice(1)}</Item>
          ))}
        </>)}
      </Drop>

      <div className="w-px h-4 bg-white/10" />

      {/* Opacity (expandable) */}
      <div className="relative" ref={opRef}>
        <div className={`flex items-center gap-1 ${dis}`}>
          <span className="text-[11px] text-white/50">Opacity:</span>
          <div className="flex items-center w-[52px] bg-neutral-800 border border-white/10 rounded h-6">
            <input type="number" value={Math.round((a.opacity ?? 1) * 100)} min={0} max={100}
              onChange={(e) => apply({ opacity: Math.max(0, Math.min(100, +e.target.value || 0)) / 100 })}
              className="flex-1 min-w-0 w-0 bg-transparent text-[11px] text-white text-center px-1 focus:outline-none" />
            <span className="text-[10px] text-white/40 pr-1">%</span>
          </div>
          <button title="Opacity options" onClick={() => setOpOpen((v) => !v)} disabled={!hasSel}
            className="w-5 h-6 grid place-items-center text-white/50 hover:text-white disabled:opacity-30">
            <ChevronDown size={12} />
          </button>
        </div>
        {opOpen && (
          <div className="absolute top-7 right-0 min-w-[180px] bg-neutral-800 border border-white/10 rounded-md shadow-xl p-2 z-50 space-y-1.5">
            {[
              { label: "Object opacity", val: a.opacity ?? 1, key: "opacity" },
              { label: "Fill opacity", val: a.fillOpacity, key: "fillOpacity" },
              { label: "Stroke opacity", val: a.strokeOpacity, key: "strokeOpacity" },
            ].map((o) => (
              <div key={o.key} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/60">{o.label}</span>
                <div className="flex items-center w-[52px] bg-neutral-900 border border-white/10 rounded h-6">
                  <input type="number" value={Math.round(o.val * 100)} min={0} max={100}
                    onChange={(e) => apply({ [o.key]: Math.max(0, Math.min(100, +e.target.value || 0)) / 100 })}
                    className="flex-1 min-w-0 w-0 bg-transparent text-[11px] text-white text-center px-1 focus:outline-none" />
                  <span className="text-[10px] text-white/40 pr-1">%</span>
                </div>
              </div>
            ))}
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
          swatches={project.swatches || []}
          onSwatchesChange={(sw) => onProject({ ...project, swatches: sw })}
          recent={project.recentColors || []}
          onRecentChange={(rc) => onProject({ ...project, recentColors: rc })}
        />
      )}
    </div>
  );
}