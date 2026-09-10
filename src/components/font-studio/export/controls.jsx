import React from "react";

export function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-white/55 shrink-0">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export const Num = ({ value, onChange, w = "w-20" }) => (
  <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`${w} bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500`} />
);

export const Color = ({ value, onChange }) => (
  <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded bg-neutral-800 border border-white/10 cursor-pointer" />
);

export const Toggle = ({ checked, onChange }) => (
  <button onClick={() => onChange(!checked)} className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-violet-600" : "bg-neutral-700"}`}>
    <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
  </button>
);

export const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-neutral-800 border border-white/10 rounded px-2 h-7 text-[12px] text-white focus:outline-none focus:border-violet-500">
    {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
  </select>
);

export function Seg({ options, value, onChange, multi = false }) {
  if (!multi) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => (
          <button key={o.id} disabled={o.soon} onClick={() => onChange(o.id)} className={`h-9 rounded text-[12px] border transition-colors ${o.soon ? "border-white/5 text-white/25 cursor-not-allowed" : value === o.id ? "border-violet-500 bg-violet-500/15 text-white" : "border-white/10 text-white/55 hover:border-white/30"}`}>{o.label}{o.soon ? " · soon" : ""}</button>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((o) => {
        const on = !!value[o.id];
        return (
          <button key={o.id} disabled={o.soon} onClick={() => onChange({ ...value, [o.id]: !on })} className={`h-9 rounded text-[12px] border transition-colors flex items-center justify-center gap-1.5 ${o.soon ? "border-white/5 text-white/25 cursor-not-allowed" : on ? "border-violet-500 bg-violet-500/15 text-white" : "border-white/10 text-white/55 hover:border-white/30"}`}>
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${on ? "bg-violet-600 border-violet-600" : "border-white/30"}`}>{on && <span className="w-1.5 h-1.5 bg-white rounded-full" />}</span>
            {o.label}{o.soon ? " · soon" : ""}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="flex-1 accent-violet-500 h-1" />
      <span className="text-[11px] text-white/50 w-8 text-right">{value}</span>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-[11px] text-white/40">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-neutral-800 border border-white/10 rounded px-2 h-8 text-[12px] text-white focus:outline-none focus:border-violet-500" />
    </label>
  );
}