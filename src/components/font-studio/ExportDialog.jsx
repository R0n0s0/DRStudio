import React, { useMemo, useState } from "react";
import { downloadFile, slugify } from "@/font/projectSerializer";
import { exportFont, exportArtwork, buildScene, renderSVG, sceneGlyph, designedGlyphs } from "@/font/artworkExport";
import { createOutlines } from "@/font/textOutlines";
import ExportFontTab from "./export/ExportFontTab";
import ExportGraphicTab from "./export/ExportGraphicTab";

export default function ExportDialog({ project, currentChar, selContours = [], loadedFonts = [], onClose, onToast, workspaceMode, onMetadata }) {
  const [tab, setTab] = useState(workspaceMode === "illustration" ? "graphic" : "font");
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");

  const [fontState, setFontState] = useState({
    formats: { otf: false, ttf: true, woff: false, woff2: false },
    metadata: { ...project.metadata },
    autoHint: true,
    exportKerning: true,
    upm: project.metrics.unitsPerEm || 1000,
  });

  const [graphicState, setGraphicState] = useState({
    format: "svg",
    area: "entire",
    artboardRange: "1",
    resolution: "150",
    customPpi: 144,
    antiAlias: "art",
    bgMode: "transparent",
    bgColor: "#ffffff",
    quality: 92,
    precision: 3,
    styling: "presentation",
    outlineText: false,
    minify: false,
    color: "#000000",
  });

  const ppiToScale = (g) => {
    const ppi = g.resolution === "custom" ? (+g.customPpi || 96) : ({ "72": 72, "150": 150, "300": 300 }[g.resolution] || 96);
    return ppi / 96;
  };

  const graphicOpts = (g) => ({
    color: g.color,
    background: g.bgMode === "transparent" ? (g.format === "jpg" ? "#ffffff" : null) : g.bgMode === "white" ? "#ffffff" : g.bgMode === "black" ? "#000000" : g.bgColor,
    scale: ppiToScale(g),
    smoothing: g.antiAlias !== "none",
    quality: g.quality / 100,
    precision: g.precision,
    styling: g.styling,
    minify: g.minify,
    outlineText: g.outlineText,
    currentChar,
  });

  const areaTarget = (area) => (area === "selection" ? "selection" : workspaceMode === "illustration" ? "artboard" : "canvas");

  const previewSvg = useMemo(() => {
    try {
      if (tab === "font") {
        const g = project.glyphs[currentChar];
        if (!g) return "";
        return renderSVG(sceneGlyph(project, g, { width: 600, height: 600, color: "#000", pad: 80 }));
      }
      const g = graphicState;
      const o = { ...graphicOpts(g) };
      if (g.area === "selection") o.selIndices = selContours;
      const scene = buildScene(project, areaTarget(g.area), o);
      return renderSVG(scene, o);
    } catch { return ""; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, project, currentChar, graphicState, selContours, workspaceMode]);

  const defaultName = useMemo(() => {
    if (tab === "font") return `${slugify(fontState.metadata.familyName || fontState.metadata.fontName || project.metadata.familyName)}.ttf`;
    const g = graphicState;
    const base = slugify(project.metadata.fontName);
    const areaLabel = g.area === "selection" ? "selection" : g.area === "artboards" ? "artboard" : "canvas";
    return `${base}-${areaLabel}.${g.format}`;
  }, [tab, fontState, graphicState, project.metadata.fontName]);

  const previewBg = tab === "graphic" && (graphicState.format === "png" || graphicState.format === "svg") && graphicState.bgMode === "transparent"
    ? "transparent"
    : tab === "graphic"
      ? (graphicState.bgMode === "white" ? "#ffffff" : graphicState.bgMode === "black" ? "#000000" : graphicState.bgMode === "custom" ? graphicState.bgColor : "transparent")
      : "transparent";

  const doExport = async () => {
    setBusy(true);
    try {
      if (tab === "font") {
        if (onMetadata) onMetadata(fontState.metadata);
        const formats = ["otf", "ttf", "woff", "woff2"].filter((f) => fontState.formats[f]);
        if (!formats.length) { onToast("Select at least one format"); return; }
        const slug = slugify(fontState.metadata.familyName || fontState.metadata.fontName || project.metadata.familyName);
        const exportProject = { ...project, metadata: fontState.metadata };
        let count = 0;
        for (const f of formats) {
          const res = await exportFont(exportProject, f, { upm: fontState.upm });
          if (!res) { onToast(`${f.toUpperCase()} not available`); continue; }
          downloadFile(`${slug}.${res.ext}`, res.blob);
          count++;
        }
        if (count) { onToast(`${count} file(s) exported`); onClose(); }
        else onToast("No files exported");
      } else {
        const g = graphicState;
        let proj = project;
        if (g.outlineText) {
          const glyph = project.glyphs[currentChar];
          const tfs = glyph?.textFrames || [];
          let extra = [];
          for (const tf of tfs) {
            try { const res = await createOutlines(tf, project, loadedFonts); if (res?.contours) extra = extra.concat(res.contours); } catch {}
          }
          if (extra.length) proj = { ...project, glyphs: { ...project.glyphs, [currentChar]: { ...glyph, contours: [...(glyph.contours || []), ...extra] } } };
        }
        const o = { ...graphicOpts(g) };
        if (g.area === "selection") o.selIndices = selContours;
        const { blob } = await exportArtwork(proj, areaTarget(g.area), g.format, o);
        downloadFile(filename || defaultName, blob);
        onToast(`${filename || defaultName} exported`);
        onClose();
      }
    } catch (err) {
      onToast("Export failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const designed = useMemo(() => designedGlyphs(project), [project]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => setTab("font")} className={`px-3 h-8 rounded text-[12px] font-medium tracking-wide ${tab === "font" ? "bg-violet-600 text-white" : "text-white/55 hover:text-white hover:bg-white/10"}`}>EXPORT FONT</button>
            <button onClick={() => setTab("graphic")} className={`px-3 h-8 rounded text-[12px] font-medium tracking-wide ${tab === "graphic" ? "bg-violet-600 text-white" : "text-white/55 hover:text-white hover:bg-white/10"}`}>EXPORT GRAPHIC</button>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[340px] border-r border-white/10 overflow-y-auto p-4">
            {tab === "font"
              ? <ExportFontTab value={fontState} onChange={setFontState} project={project} />
              : <ExportGraphicTab value={graphicState} onChange={setGraphicState} selCount={selContours.length} />}
          </div>
          <div className="flex-1 flex flex-col bg-neutral-950">
            <div className="h-9 flex items-center px-3 border-b border-white/10 text-[11px] text-white/40">Preview</div>
            <div className="flex-1 grid place-items-center p-6 overflow-auto" style={{ backgroundColor: "#3a3a3a", backgroundImage: "linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%)", backgroundSize: "16px 16px" }}>
              {previewSvg ? (
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(previewSvg)}`} alt="preview" className="max-w-full max-h-full object-contain shadow-2xl" style={{ background: previewBg }} />
              ) : (
                <div className="text-white/30 text-[13px]">Nothing to preview</div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/30 flex gap-4">
              {tab === "font" && <span>{designed.length} designed glyph(s)</span>}
              {tab === "graphic" && <span>{graphicState.format.toUpperCase()} · {graphicState.area}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10 shrink-0">
          <input value={filename} placeholder={defaultName} onChange={(e) => setFilename(e.target.value)} className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 h-8 text-[12px] text-white focus:outline-none focus:border-violet-500" />
          <button onClick={onClose} className="px-3 h-8 text-[12px] text-white/60 hover:text-white">Cancel</button>
          <button onClick={doExport} disabled={busy} className="px-4 h-8 text-[12px] bg-violet-600 hover:bg-violet-500 rounded text-white disabled:opacity-50">{busy ? "Exporting…" : tab === "font" ? "Export Font" : "Export Graphic"}</button>
        </div>
      </div>
    </div>
  );
}