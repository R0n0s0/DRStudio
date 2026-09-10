import React, { useState } from "react";
import {
  Combine, Minus, Plus as PlusIcon, Slash, Scissors, Eraser, Group,
  Crop as CropIcon, Spline, FlipVertical2, Settings2, RefreshCw,
} from "lucide-react";
import CompoundInspector from "./CompoundInspector";

const SHAPE_MODES = [
  { id: "unite", label: "Unite", icon: Combine, tip: "Fuse all selected shapes into one continuous vector contour." },
  { id: "minusFront", label: "Minus Front", icon: Minus, tip: "Subtract the front shapes from the back-most object." },
  { id: "intersect", label: "Intersect", icon: PlusIcon, tip: "Keep only the region where all selected shapes overlap." },
  { id: "exclude", label: "Exclude", icon: Slash, tip: "Keep non-overlapping regions; shared overlaps become holes." },
];

const DIVIDERS = [
  { id: "divide", label: "Divide", icon: Scissors, tip: "Cut objects into separate fragments at every intersection." },
  { id: "trim", label: "Trim", icon: Eraser, tip: "Remove hidden overlapping regions; removes strokes." },
  { id: "merge", label: "Merge", icon: Group, tip: "Trim hidden regions and unite adjacent shapes with the same fill." },
  { id: "crop", label: "Crop", icon: CropIcon, tip: "Use the frontmost object as a boundary; discard geometry outside it." },
  { id: "outline", label: "Outline", icon: Spline, tip: "Convert filled paths into line segments broken at each intersection." },
  { id: "minusBack", label: "Minus Back", icon: FlipVertical2, tip: "Subtract the back-most object from the front shape." },
];

function OpButton({ op, onRun, altHint }) {
  const Icon = op.icon;
  return (
    <button
      title={op.tip + (altHint ? "  (Alt-click = Compound Shape)" : "")}
      onClick={(e) => onRun(op.id, e.altKey)}
      className="flex flex-col items-center justify-center gap-1 h-14 rounded bg-neutral-800 hover:bg-violet-600/80 hover:text-white text-white/70 border border-white/5 transition-colors"
    >
      <Icon size={18} strokeWidth={1.75} />
      <span className="text-[10px] leading-none">{op.label}</span>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="px-3 py-2 border-b border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{title}</div>
      {children}
    </div>
  );
}

export default function ShapeShifterPanel({ onRun, lastOp, onRepeat, options, setOptions, selectionCount, frontmostLabel, backmostLabel, hasCompound, compoundOp, onExpand, onRelease }) {
  const [showOptions, setShowOptions] = useState(false);
  return (
    <div className="text-white">
      {hasCompound && <CompoundInspector op={compoundOp} onExpand={onExpand} onRelease={onRelease} />}
      <Section title="Shape Modes">
        <div className="grid grid-cols-2 gap-1.5">
          {SHAPE_MODES.map((op) => <OpButton key={op.id} op={op} onRun={onRun} altHint />)}
        </div>
        <div className="text-[10px] text-white/30 mt-1.5">Alt-click a Shape Mode to create a live, editable Compound Shape.</div>
      </Section>
      <Section title="Divide & Cut">
        <div className="grid grid-cols-2 gap-1.5">
          {DIVIDERS.map((op) => <OpButton key={op.id} op={op} onRun={onRun} />)}
        </div>
      </Section>
      <Section title="Options">
        <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-2 h-8 px-2 w-full rounded bg-neutral-800 hover:bg-white/10 text-white/70 text-[12px] border border-white/5">
          <Settings2 size={14} /> Shape Shifter Options
        </button>
        {showOptions && (
          <div className="mt-2 space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                <span>Precision</span><span>{["Low", "Medium", "High", "Very High"][options.precision]}</span>
              </div>
              <input type="range" min={0} max={3} value={options.precision}
                onChange={(e) => setOptions({ ...options, precision: parseInt(e.target.value) })}
                className="w-full accent-violet-500" />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
              <input type="checkbox" checked={options.removeUnpainted}
                onChange={(e) => setOptions({ ...options, removeUnpainted: e.target.checked })}
                className="accent-violet-500" />
              Divide &amp; Outline Remove Unpainted
            </label>
            <div className="text-[10px] text-white/30">Redundant anchor points are removed automatically after every operation.</div>
          </div>
        )}
        <button onClick={onRepeat} disabled={!lastOp}
          className="mt-2 flex items-center gap-2 h-8 px-2 w-full rounded bg-neutral-800 hover:bg-white/10 disabled:opacity-40 text-white/70 text-[12px] border border-white/5"
          title="Repeat the last Shape Shifter operation on the current selection">
          <RefreshCw size={14} /> Repeat Last{lastOp ? `: ${lastOp}` : ""}
        </button>
      </Section>
      <div className="px-3 py-2 text-[11px] text-white/40 space-y-0.5">
        <div>Selection: <span className="text-white/70">{selectionCount} object(s)</span></div>
        {selectionCount >= 2 && <>
          <div>Frontmost: <span className="text-violet-300">{frontmostLabel}</span></div>
          <div>Backmost: <span className="text-sky-300">{backmostLabel}</span></div>
        </>}
        {selectionCount < 2 && <div className="text-amber-400/80">Select two or more objects.</div>}
      </div>
    </div>
  );
}