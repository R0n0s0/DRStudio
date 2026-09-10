import React, { useState } from "react";
import { getAppearance, setAppearance } from "@/font/appearance";
import { CAP_OPTIONS, JOIN_OPTIONS, ARROW_TYPES, WIDTH_PROFILES } from "@/font/strokeRender";
import { FlipHorizontal2, FlipVertical2 } from "lucide-react";

const Num = ({ value, onChange, w = "w-16", min = 0, max, step = 1, onStep }) => {
  const stepBy = (dir) => {
    if (onStep) return onStep(dir);
    const s = step || 1;
    onChange(Math.max(min ?? -Infinity, +value + dir * s));
  };
  return (
    <div className={`flex items-center ${w} bg-neutral-800 border border-white/10 rounded h-7`}>
      <button onClick={() => stepBy(-1)} className="w-5 h-7 text-white/50 hover:text-white text-xs">−</button>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(+e.target.value || 0)}
        className="flex-1 min-w-0 w-0 bg-transparent text-[12px] text-white text-center focus:outline-none" />
      <button onClick={() => stepBy(1)} className="w-5 h-7 text-white/50 hover:text-white text-xs">+</button>
    </div>
  );
};

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-[12px] text-white/55 shrink-0">{label}</span>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

const SegBtn = ({ active, onClick, title, disabled, children }) => (
  <button onClick={onClick} title={title} disabled={disabled}
    className={`flex-1 h-8 grid place-items-center rounded border text-[11px] transition-colors ${
      active ? "bg-violet-600 border-violet-500 text-white" : "bg-neutral-800 border-white/10 text-white/60 hover:text-white hover:border-white/20"
    } disabled:opacity-30 disabled:hover:bg-neutral-800`}>
    {children}
  </button>
);

// Tiny SVG icons for cap / join / align selectors.
const CapIcon = ({ type }) => (
  <svg width="34" height="14" viewBox="0 0 34 14">
    {type === "butt" && <line x1="6" y1="7" x2="28" y2="7" stroke="currentColor" strokeWidth="6" strokeLinecap="butt" />}
    {type === "round" && <line x1="6" y1="7" x2="28" y2="7" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />}
    {type === "projecting" && <line x1="9" y1="7" x2="25" y2="7" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />}
  </svg>
);
const JoinIcon = ({ type }) => (
  <svg width="34" height="16" viewBox="0 0 34 16">
    <path d="M5 12 L17 4 L29 12" fill="none" stroke="currentColor" strokeWidth="4"
      strokeLinejoin={type === "round" ? "round" : type === "bevel" ? "bevel" : "miter"} strokeLinecap="butt" />
  </svg>
);
const AlignIcon = ({ type }) => (
  <svg width="34" height="20" viewBox="0 0 34 20">
    <rect x="9" y="5" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    {type === "center" && <rect x="7" y="3" width="20" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" />}
    {type === "inside" && <rect x="9" y="5" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" />}
    {type === "outside" && <rect x="5" y="1" width="24" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" />}
  </svg>
);

export default function StrokePropertiesPanel({ glyph, onGlyph, selContours }) {
  const [scaleLock, setScaleLock] = useState(false);

  if (!selContours.length) {
    return <div className="p-3 text-[12px] text-white/40">Select an object to edit its stroke.</div>;
  }
  const first = glyph.contours[selContours[0]];
  if (!first) return null;
  const a = getAppearance(first);
  const closed = !!first.closed;

  const apply = (patch) => {
    const contours = glyph.contours.map((c, i) => (selContours.includes(i) ? setAppearance(c, patch) : c));
    onGlyph({ ...glyph, contours });
  };

  const setArrowType = (which, type) => {
    if (!type || type === "none") { apply({ [which]: null }); return; }
    const cur = a[which] || {};
    apply({ [which]: { type, scale: cur.scale != null ? cur.scale : 100, align: cur.align || "tip" } });
  };
  const setArrowScale = (which, scale) => {
    const patch = {};
    const cur = a[which] || { type: "simple", scale: 100, align: "tip" };
    patch[which] = { ...cur, scale };
    if (scaleLock) {
      const other = which === "arrowStart" ? "arrowEnd" : "arrowStart";
      const oc = a[other] || { type: "simple", scale: 100, align: "tip" };
      if (a[other]) patch[other] = { ...oc, scale };
    }
    apply(patch);
  };
  const setArrowAlign = (align) => {
    const patch = {};
    if (a.arrowStart) patch.arrowStart = { ...a.arrowStart, align };
    if (a.arrowEnd) patch.arrowEnd = { ...a.arrowEnd, align };
    if (!Object.keys(patch).length) return;
    apply(patch);
  };

  const dashPair = (i) => [a.dashPattern?.[i * 2] || 0, a.dashPattern?.[i * 2 + 1] || 0];
  const setDash = (pairIdx, slot, val) => {
    const cur = a.dashPattern ? [...a.dashPattern] : [0, 0, 0, 0, 0, 0];
    while (cur.length < 6) cur.push(0);
    cur[pairIdx * 2 + slot] = Math.max(0, val);
    apply({ dashPattern: cur });
  };
  const toggleDashed = (on) => {
    if (on) apply({ dashPattern: a.dashPattern || [12, 8, 0, 0, 0, 0] });
    else apply({ dashPattern: null, dashOffset: 0 });
  };

  const stepWeight = (dir) => apply({ strokeWidth: Math.max(0, Math.round((a.strokeWidth + dir * (a.strokeWidth < 1 ? 0.25 : 1)) * 100) / 100) });

  return (
    <div className="p-3 space-y-2">
      {/* Stroke weight */}
      <Row label="Stroke Weight">
        <Num value={a.strokeWidth} step={0.25} min={0} onStep={stepWeight} onChange={(v) => apply({ strokeWidth: Math.max(0, v), stroke: a.stroke || "#000000" })} />
        <span className="text-[11px] text-white/40">px</span>
      </Row>

      {/* Caps */}
      <div>
        <div className="text-[11px] text-white/40 mb-1">Caps</div>
        <div className="flex gap-1">
          {CAP_OPTIONS.map((c) => (
            <SegBtn key={c.id} active={a.cap === c.id} title={c.label} onClick={() => apply({ cap: c.id })}>
              <CapIcon type={c.id} />
            </SegBtn>
          ))}
        </div>
      </div>

      {/* Joins + miter limit */}
      <div>
        <div className="text-[11px] text-white/40 mb-1">Corners</div>
        <div className="flex gap-1">
          {JOIN_OPTIONS.map((j) => (
            <SegBtn key={j.id} active={a.join === j.id} title={j.label} onClick={() => apply({ join: j.id })}>
              <JoinIcon type={j.id} />
            </SegBtn>
          ))}
        </div>
        <Row label="Miter Limit">
          <Num value={a.miterLimit ?? 10} min={1} step={1} onStep={(d) => apply({ miterLimit: Math.max(1, (a.miterLimit ?? 10) + d) })} onChange={(v) => apply({ miterLimit: Math.max(1, v) })} w="w-14" />
        </Row>
      </div>

      {/* Align stroke (closed paths only) */}
      <div>
        <div className="text-[11px] text-white/40 mb-1">Align Stroke {!closed && <span className="text-white/25">(closed paths only)</span>}</div>
        <div className="flex gap-1">
          {["center", "inside", "outside"].map((al) => (
            <SegBtn key={al} active={a.strokeAlign === al} disabled={!closed}
              title={`Align ${al}`} onClick={() => apply({ strokeAlign: al })}>
              <AlignIcon type={al} />
            </SegBtn>
          ))}
        </div>
      </div>

      {/* Dashed line */}
      <div className="pt-1 border-t border-white/10">
        <label className="flex items-center gap-2 text-[12px] text-white/70 cursor-pointer">
          <input type="checkbox" checked={!!a.dashPattern} onChange={(e) => toggleDashed(e.target.checked)} className="accent-violet-500" />
          Dashed Line
        </label>
        {a.dashPattern && (
          <div className="mt-2 space-y-1">
            {[0, 1, 2].map((i) => {
              const [dp, gp] = dashPair(i);
              return (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-white/35 w-4">{i + 1}</span>
                  <Num value={dp} min={0} step={1} w="w-14" onChange={(v) => setDash(i, 0, v)} />
                  <span className="text-[10px] text-white/35">dash</span>
                  <Num value={gp} min={0} step={1} w="w-14" onChange={(v) => setDash(i, 1, v)} />
                  <span className="text-[10px] text-white/35">gap</span>
                </div>
              );
            })}
            <Row label="Dash Offset">
              <Num value={a.dashOffset || 0} step={1} w="w-14" onChange={(v) => apply({ dashOffset: v })} />
            </Row>
            <Row label="Corners">
              <div className="flex gap-1">
                <SegBtn active={a.dashCornerMode !== "align"} onClick={() => apply({ dashCornerMode: "exact" })}>Exact</SegBtn>
                <SegBtn active={a.dashCornerMode === "align"} onClick={() => apply({ dashCornerMode: "align" })}>Align</SegBtn>
              </div>
            </Row>
          </div>
        )}
      </div>

      {/* Arrowheads */}
      <div className="pt-1 border-t border-white/10">
        <div className="text-[11px] text-white/40 mb-1">Arrowheads</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-white/35 mb-0.5">Start</div>
            <select value={a.arrowStart?.type || "none"} onChange={(e) => setArrowType("arrowStart", e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded h-7 px-2 text-[11px] text-white focus:outline-none focus:border-violet-500">
              {ARROW_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-white/35 mb-0.5">End</div>
            <select value={a.arrowEnd?.type || "none"} onChange={(e) => setArrowType("arrowEnd", e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded h-7 px-2 text-[11px] text-white focus:outline-none focus:border-violet-500">
              {ARROW_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-1 space-y-1">
          <Row label="Start Scale"><Num value={a.arrowStart?.scale ?? 100} min={1} max={1000} step={10} w="w-14" onChange={(v) => setArrowScale("arrowStart", v)} /></Row>
          <Row label="End Scale"><Num value={a.arrowEnd?.scale ?? 100} min={1} max={1000} step={10} w="w-14" onChange={(v) => setArrowScale("arrowEnd", v)} /></Row>
          <label className="flex items-center gap-2 text-[11px] text-white/55 cursor-pointer">
            <input type="checkbox" checked={scaleLock} onChange={(e) => setScaleLock(e.target.checked)} className="accent-violet-500" />
            Proportional scale lock
          </label>
        </div>
        <Row label="Arrow Align">
          <div className="flex gap-1">
            <SegBtn active={(a.arrowStart?.align || "tip") !== "extend"} onClick={() => setArrowAlign("tip")}>Tip at end</SegBtn>
            <SegBtn active={(a.arrowStart?.align || "tip") === "extend"} onClick={() => setArrowAlign("extend")}>Extend</SegBtn>
          </div>
        </Row>
      </div>

      {/* Variable Width Profile */}
      <div className="pt-1 border-t border-white/10">
        <div className="text-[11px] text-white/40 mb-1">Variable Width Profile</div>
        <select value={a.widthProfile || "uniform"} onChange={(e) => apply({ widthProfile: e.target.value })}
          className="w-full bg-neutral-800 border border-white/10 rounded h-7 px-2 text-[11px] text-white focus:outline-none focus:border-violet-500">
          {WIDTH_PROFILES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {a.widthProfile && a.widthProfile !== "uniform" && (
          <div className="flex gap-1 mt-2">
            <button title="Flip Along (reverse start↔end)" onClick={() => apply({ widthProfileFlipAlong: !a.widthProfileFlipAlong })}
              className={`flex-1 h-8 grid place-items-center rounded border text-[11px] ${a.widthProfileFlipAlong ? "bg-violet-600 border-violet-500 text-white" : "bg-neutral-800 border-white/10 text-white/60 hover:text-white"}`}>
              <FlipHorizontal2 size={14} /> Flip Along
            </button>
            <button title="Flip Across (mirror over path axis)" onClick={() => apply({ widthProfileFlipAcross: !a.widthProfileFlipAcross })}
              className={`flex-1 h-8 grid place-items-center rounded border text-[11px] ${a.widthProfileFlipAcross ? "bg-violet-600 border-violet-500 text-white" : "bg-neutral-800 border-white/10 text-white/60 hover:text-white"}`}>
              <FlipVertical2 size={14} /> Flip Across
            </button>
          </div>
        )}
      </div>
    </div>
  );
}