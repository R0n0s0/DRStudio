import React from "react";
import { Row, Seg, Select, Num, Color, Toggle, Slider } from "./controls";

const ART_FORMATS = [
  { id: "svg", label: "SVG" },
  { id: "png", label: "PNG" },
  { id: "jpg", label: "JPG" },
  { id: "pdf", label: "PDF" },
  { id: "eps", label: "EPS" },
];
const AREAS = [
  { id: "entire", label: "Entire Canvas" },
  { id: "artboards", label: "Use Artboards" },
  { id: "selection", label: "Selected Objects Only" },
];
const RES = [
  { id: "72", label: "Screen · 72 ppi" },
  { id: "150", label: "Medium · 150 ppi" },
  { id: "300", label: "High · 300 ppi" },
  { id: "custom", label: "Custom" },
];

export default function ExportGraphicTab({ value, onChange, selCount }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const isRaster = value.format === "png" || value.format === "jpg";
  const isSvg = value.format === "svg";
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Format</div>
        <Seg options={ART_FORMATS} value={value.format} onChange={(v) => set("format", v)} />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Export Area</div>
        <div className="grid grid-cols-1 gap-1">
          {AREAS.map((a) => (
            <button key={a.id} disabled={a.id === "selection" && selCount === 0} onClick={() => set("area", a.id)} className={`h-8 rounded text-[12px] border text-left px-3 ${value.area === a.id ? "border-violet-500 bg-violet-500/15 text-white" : "border-white/10 text-white/55 hover:border-white/30"} disabled:opacity-40 disabled:cursor-not-allowed`}>{a.label}{a.id === "selection" ? ` (${selCount})` : ""}</button>
          ))}
        </div>
        {value.area === "artboards" && (
          <div className="mt-1.5"><Row label="Artboard range"><Num value={value.artboardRange} onChange={(v) => set("artboardRange", v)} w="w-24" /></Row></div>
        )}
      </div>

      {isRaster && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Raster</div>
          <Row label="Resolution"><Select value={value.resolution} onChange={(v) => set("resolution", v)} options={RES} /></Row>
          {value.resolution === "custom" && <Row label="PPI"><Num value={value.customPpi} onChange={(v) => set("customPpi", v)} w="w-24" /></Row>}
          <Row label="Anti-Aliasing"><Select value={value.antiAlias} onChange={(v) => set("antiAlias", v)} options={[{ id: "art", label: "Art Optimized" }, { id: "type", label: "Type Optimized" }, { id: "none", label: "None" }]} /></Row>
          <Row label="Background"><Select value={value.bgMode} onChange={(v) => set("bgMode", v)} options={[{ id: "transparent", label: "Transparent" }, { id: "white", label: "White" }, { id: "black", label: "Black" }, { id: "custom", label: "Custom" }]} /></Row>
          {value.bgMode === "custom" && <Row label="Fill color"><Color value={value.bgColor} onChange={(v) => set("bgColor", v)} /></Row>}
          {value.format === "jpg" && <Row label="Quality"><Slider value={value.quality} onChange={(v) => set("quality", v)} /></Row>}
        </div>
      )}

      {isSvg && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Vector (SVG)</div>
          <Row label="Decimal Precision"><Num value={value.precision} onChange={(v) => set("precision", Math.max(1, Math.min(5, +v || 3)))} w="w-20" /></Row>
          <Row label="Styling"><Select value={value.styling} onChange={(v) => set("styling", v)} options={[{ id: "presentation", label: "Presentation Attrs" }, { id: "inline", label: "Inline Styles" }, { id: "css", label: "Internal CSS" }]} /></Row>
          <Row label="Convert Text to Outlines"><Toggle checked={value.outlineText} onChange={(v) => set("outlineText", v)} /></Row>
          <Row label="Minify SVG"><Toggle checked={value.minify} onChange={(v) => set("minify", v)} /></Row>
        </div>
      )}

      {(value.format === "pdf" || value.format === "eps") && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-wider text-white/40">Vector</div>
          <Row label="Convert Text to Outlines"><Toggle checked={value.outlineText} onChange={(v) => set("outlineText", v)} /></Row>
        </div>
      )}

      <div className="pt-2 border-t border-white/10">
        <Row label="Glyph color"><Color value={value.color} onChange={(v) => set("color", v)} /></Row>
      </div>
    </div>
  );
}