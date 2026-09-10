import React, { useState } from "react";
import LivePreview from "./LivePreview";
import MetricsPanel from "./MetricsPanel";
import KerningPanel from "./KerningPanel";
import LayersPanel from "./LayersPanel";
import AppearancePanel from "./AppearancePanel";
import TransformPanel from "./TransformPanel";
import ShapeShifterPanel from "./ShapeShifterPanel";
import StrokePropertiesPanel from "./StrokePropertiesPanel";
import { Type, Layers, Ruler, MoveHorizontal, Palette, SlidersHorizontal, Combine, PenLine, ChevronUp, ChevronDown, X } from "lucide-react";

const ICONS = {
  preview: Type,
  layers: Layers,
  metrics: Ruler,
  kerning: MoveHorizontal,
  appearance: Palette,
  stroke: PenLine,
  transform: SlidersHorizontal,
  shapeshifter: Combine,
};

const FONT_ONLY_PANELS = ["preview", "metrics", "kerning"];

export default function RightPanel({ project, glyph, onMetrics, onGlyph, onProject, onKerning, previewState, setPreviewState, selContours, onSelectContours, selPoints, selSegments, panels, onTogglePanel, onMovePanel, shapeshifter, rulerUnit = "fu", workspaceMode = "font" }) {
  const visible = panels.filter((p) => p.visible && (workspaceMode === "font" || !FONT_ONLY_PANELS.includes(p.id)));
  const [openId, setOpenId] = useState(null);
  const open = visible.find((p) => p.id === openId);
  const openIndex = open ? visible.findIndex((p) => p.id === open.id) : -1;

  const renderContent = (p) => {
    if (p.id === "preview") {
      return (
        <div>
          <div className="p-3 space-y-2 border-b border-white/10">
            <textarea
              value={previewState.text}
              onChange={(e) => setPreviewState({ ...previewState, text: e.target.value })}
              rows={2}
              className="w-full bg-neutral-800 border border-white/10 rounded px-2 py-1.5 text-[13px] text-white resize-none focus:outline-none focus:border-violet-500"
            />
            <div className="flex items-center gap-2">
              <input
                type="range" min={12} max={96} value={previewState.size}
                onChange={(e) => setPreviewState({ ...previewState, size: parseInt(e.target.value) })}
                className="flex-1 accent-violet-500"
              />
              <span className="text-[11px] text-white/40 w-8">{previewState.size}px</span>
            </div>
            <div className="flex gap-1">
              {["left", "center", "right"].map((a) => (
                <button
                  key={a}
                  onClick={() => setPreviewState({ ...previewState, align: a })}
                  className={`flex-1 h-7 text-[11px] rounded capitalize ${previewState.align === a ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/50"}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <LivePreview
            project={project}
            text={previewState.text}
            size={previewState.size}
            align={previewState.align}
          />
        </div>
      );
    }
    if (p.id === "layers") return <LayersPanel glyph={glyph} onGlyph={onGlyph} selContours={selContours} onSelectContours={onSelectContours} workspaceMode={workspaceMode} />;
    if (p.id === "metrics") return <MetricsPanel metrics={project.metrics} glyph={glyph} onMetrics={onMetrics} onGlyph={onGlyph} project={project} onProject={onProject} rulerUnit={rulerUnit} workspaceMode={workspaceMode} />;
    if (p.id === "kerning") {
      return (
        <KerningPanel
          project={project}
          onAdd={(a, b, v) => onKerning({ ...project.kerning, [`${a},${b}`]: v })}
          onUpdate={(key, v) => onKerning({ ...project.kerning, [key]: v })}
          onDelete={(key) => {
            const next = { ...project.kerning }; delete next[key]; onKerning(next);
          }}
        />
      );
    }
    if (p.id === "appearance") return <AppearancePanel glyph={glyph} onGlyph={onGlyph} selContours={selContours} onSelectContours={onSelectContours} swatches={project.swatches || []} onSwatchesChange={(sw) => onProject({ ...project, swatches: sw })} recent={project.recentColors || []} onRecentChange={(rc) => onProject({ ...project, recentColors: rc })} />;
    if (p.id === "stroke") return <StrokePropertiesPanel glyph={glyph} onGlyph={onGlyph} selContours={selContours} />;
    if (p.id === "transform") return <TransformPanel glyph={glyph} onGlyph={onGlyph} selContours={selContours} selPoints={selPoints} selSegments={selSegments} />;
    if (p.id === "shapeshifter") return <ShapeShifterPanel {...shapeshifter} />;
    return null;
  };

  return (
    <div className="flex bg-neutral-900 border-l border-white/10">
      {open && (
        <div className="w-72 flex flex-col">
          <div className="flex items-center gap-2 h-9 px-2 bg-neutral-900/60 border-b border-white/10">
            {(() => { const Icon = ICONS[open.id] || Layers; return <Icon size={15} strokeWidth={1.75} className="text-white/70" />; })()}
            <span className="text-[11px] uppercase tracking-wider text-white/50 font-medium flex-1">{open.label}</span>
            <button onClick={() => onMovePanel(open.id, -1)} disabled={openIndex === 0} className="text-white/40 hover:text-white disabled:opacity-20" title="Move up"><ChevronUp size={14} /></button>
            <button onClick={() => onMovePanel(open.id, 1)} disabled={openIndex === visible.length - 1} className="text-white/40 hover:text-white disabled:opacity-20" title="Move down"><ChevronDown size={14} /></button>
            <button onClick={() => setOpenId(null)} className="text-white/40 hover:text-white" title="Collapse"><X size={13} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">{renderContent(open)}</div>
        </div>
      )}
      <div className="w-11 flex flex-col items-center py-2 gap-0.5">
        {visible.length === 0 && (
          <div className="text-[10px] text-white/30 text-center px-1 leading-tight">All hidden</div>
        )}
        {visible.map((p) => {
          const Icon = ICONS[p.id] || Layers;
          const active = openId === p.id;
          return (
            <button
              key={p.id}
              title={p.label}
              onClick={() => setOpenId(active ? null : p.id)}
              className={`w-9 h-9 grid place-items-center rounded-sm transition-colors ${
                active ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={17} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
    </div>
  );
}