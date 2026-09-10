import React from "react";
import { Row, Seg, Toggle, Field } from "./controls";
import { designedGlyphs } from "@/font/artworkExport";

const FONT_FORMATS = [
  { id: "otf", label: "OTF" },
  { id: "ttf", label: "TTF" },
  { id: "woff", label: "WOFF" },
  { id: "woff2", label: "WOFF2" },
];

export default function ExportFontTab({ value, onChange, project }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const setMeta = (k, v) => onChange({ ...value, metadata: { ...value.metadata, [k]: v } });
  const designed = designedGlyphs(project);
  const psName = (value.metadata.familyName || "NewFont").replace(/\s+/g, "") + "-" + (value.metadata.style || "Regular");
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Formats</div>
        <Seg options={FONT_FORMATS} value={value.formats} onChange={(v) => set("formats", v)} multi />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Font Metadata</div>
        <div className="space-y-2">
          <Field label="Family Name" value={value.metadata.familyName} onChange={(v) => setMeta("familyName", v)} />
          <Field label="Style / Subfamily" value={value.metadata.style} onChange={(v) => setMeta("style", v)} />
          <Row label="PostScript Name"><span className="text-[12px] text-white/60 font-mono truncate max-w-[180px]">{psName}</span></Row>
          <Field label="Version" value={value.metadata.version} onChange={(v) => setMeta("version", v)} />
          <Field label="Designer" value={value.metadata.designer} onChange={(v) => setMeta("designer", v)} />
          <Field label="Copyright" value={value.metadata.copyright} onChange={(v) => setMeta("copyright", v)} />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Compilation</div>
        <div className="space-y-1">
          <Row label="Auto-Hinting"><Toggle checked={value.autoHint} onChange={(v) => set("autoHint", v)} /></Row>
          <Row label="Export Kerning Pairs"><Toggle checked={value.exportKerning} onChange={(v) => set("exportKerning", v)} /></Row>
          <Row label="UPM Grid Scaling">
            <div className="flex items-center bg-neutral-800 rounded-md p-0.5 border border-white/10">
              {[1000, 2048].map((u) => (
                <button key={u} onClick={() => set("upm", u)} className={`px-2.5 h-6 text-[11px] rounded ${value.upm === u ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"}`}>{u}</button>
              ))}
            </div>
          </Row>
        </div>
      </div>
      <div className="text-[12px] space-y-1 bg-neutral-800/50 rounded p-2.5">
        <div className="text-white/70">{designed.length} glyph(s) designed.</div>
        <div className="text-white/35 text-[11px] leading-relaxed">OTF/TTF/WOFF/WOFF2 export flattens curves to polygons (experimental). Auto-hinting & kerning compilation are planned.</div>
      </div>
    </div>
  );
}