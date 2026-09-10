import React, { useState, useEffect } from "react";
import { withLiveShape, convertToPath } from "@/font/liveShapes";
import { Link2, Link, Wand2 } from "lucide-react";

// Inspector for a selected live (parametric) shape. Edits update the liveShape
// params and rebuild the contour non-destructively. "Convert to Path" bakes it
// into a standard editable Bézier path.
export default function LiveShapeInspector({ glyph, contour, contourIndex, onGlyph }) {
  const ls = contour.liveShape;
  const [lockRatio, setLockRatio] = useState(false);
  const [linkCorners, setLinkCorners] = useState(true);

  const update = (patch) => {
    const contours = glyph.contours.map((c, i) => (i === contourIndex ? withLiveShape(c, patch) : c));
    onGlyph({ ...glyph, contours });
  };

  const setDim = (key, val) => {
    if (key === "width") {
      if (lockRatio) {
        const ratio = ls.height / ls.width;
        update({ width: Math.max(1, val), height: Math.max(1, val * ratio) });
      } else update({ width: Math.max(1, val) });
    } else {
      if (lockRatio) {
        const ratio = ls.width / ls.height;
        update({ height: Math.max(1, val), width: Math.max(1, val * ratio) });
      } else update({ height: Math.max(1, val) });
    }
  };

  const setCorner = (which, val) => {
    const cur = typeof ls.cornerRadius === "number" ? ls.cornerRadius : (ls.cornerRadius || 0);
    const base = linkCorners
      ? { tl: val, tr: val, br: val, bl: val }
      : { tl: cur.tl || 0, tr: cur.tr || 0, br: cur.br || 0, bl: cur.bl || 0, [which]: Math.max(0, val) };
    update({ cornerRadius: base });
  };

  const convert = () => {
    const contours = glyph.contours.map((c, i) => (i === contourIndex ? convertToPath(c) : c));
    onGlyph({ ...glyph, contours });
  };

  const cr = typeof ls.cornerRadius === "number" ? ls.cornerRadius : (ls.cornerRadius?.tl ?? 0);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-white/40">{ls.type} · Live Shape</span>
        <button onClick={convert} title="Convert to editable Bézier path" className="flex items-center gap-1.5 h-7 px-2 bg-violet-600 hover:bg-violet-500 text-white text-[11px] rounded">
          <Wand2 size={12} /> Convert to Path
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-end">
        <NumField label="W" value={ls.width} onChange={(v) => setDim("width", v)} />
        <button
          onClick={() => setLockRatio((v) => !v)}
          title="Constrain proportions"
          className={`h-8 w-8 grid place-items-center rounded mb-0.5 ${lockRatio ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/50 hover:text-white"}`}
        >
          {lockRatio ? <Link2 size={13} /> : <Link size={13} />}
        </button>
        <NumField label="H" value={ls.height} onChange={(v) => setDim("height", v)} />
      </div>

      <NumField label="Rotation°" value={ls.rotation || 0} onChange={(v) => update({ rotation: v })} />

      {ls.type === "rectangle" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Corner Radii</span>
            <button
              onClick={() => setLinkCorners((v) => !v)}
              title="Link corner radii"
              className={`flex items-center gap-1 h-6 px-1.5 rounded text-[10px] ${linkCorners ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/50"}`}
            >
              <Link2 size={11} /> Link
            </button>
          </div>
          {linkCorners ? (
            <NumField label="Radius" value={cr} onChange={(v) => setCorner("tl", v)} />
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <NumField label="TL" value={ls.cornerRadius?.tl ?? 0} onChange={(v) => setCorner("tl", v)} />
              <NumField label="TR" value={ls.cornerRadius?.tr ?? 0} onChange={(v) => setCorner("tr", v)} />
              <NumField label="BR" value={ls.cornerRadius?.br ?? 0} onChange={(v) => setCorner("br", v)} />
              <NumField label="BL" value={ls.cornerRadius?.bl ?? 0} onChange={(v) => setCorner("bl", v)} />
            </div>
          )}
        </div>
      )}

      {ls.type === "polygon" && (
        <NumField label="Sides" value={ls.sides} onChange={(v) => update({ sides: Math.max(3, Math.min(64, Math.round(v))) })} />
      )}

      {ls.type === "star" && (
        <>
          <NumField label="Points" value={ls.points} onChange={(v) => update({ points: Math.max(3, Math.min(64, Math.round(v))) })} />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/40 w-16">Inner R</span>
              <span className="text-[11px] text-white/60">{Math.round((ls.innerRadius ?? 0.5) * 100)}%</span>
            </div>
            <input type="range" min={0.05} max={0.95} step={0.01} value={ls.innerRadius ?? 0.5}
              onChange={(e) => update({ innerRadius: parseFloat(e.target.value) })}
              className="w-full accent-violet-500" />
          </div>
        </>
      )}

      {ls.type === "ellipse" && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {["full", "pie", "arc"].map((m) => (
              <button key={m} onClick={() => update({ arcMode: m })}
                className={`flex-1 h-7 text-[11px] rounded capitalize ${ls.arcMode === m ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/50 hover:text-white"}`}>
                {m}
              </button>
            ))}
          </div>
          {ls.arcMode !== "full" && (
            <div className="grid grid-cols-2 gap-1.5">
              <NumField label="Start°" value={ls.startAngle} onChange={(v) => update({ startAngle: v })} />
              <NumField label="End°" value={ls.endAngle} onChange={(v) => update({ endAngle: v })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }) {
  const [text, setText] = useState("");
  useEffect(() => { setText((Math.round(value * 100) / 100).toFixed(2)); }, [value]);
  const commit = () => {
    const v = parseFloat(text);
    if (!isNaN(v)) onChange(v);
    else setText((Math.round(value * 100) / 100).toFixed(2));
  };
  return (
    <label className="flex items-center gap-1.5 bg-neutral-800 border border-white/10 rounded px-2 h-8 focus-within:border-violet-500">
      <span className="text-[11px] text-white/40 w-8 shrink-0">{label}</span>
      <input type="text" value={text}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
        className="w-full bg-transparent text-[12px] text-white focus:outline-none" />
    </label>
  );
}