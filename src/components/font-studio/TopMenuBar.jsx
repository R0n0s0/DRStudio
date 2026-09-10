import React, { useState, useRef, useEffect } from "react";
import {
  FilePlus, FolderOpen, Save, Download, Undo2, Redo2, Grid3x3, Ruler,
  Plus, Copy, Trash2, ZoomIn, ZoomOut, Maximize, Info, Type, Check, Wand2, Ungroup, Shapes, Sun, Moon, ChevronDown, Upload, Lock, LockOpen, RotateCcw,
} from "lucide-react";
import TopBarAppearance from "./TopBarAppearance";
import Logo from "./Logo";

function Menu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        className={`px-3 h-8 text-[13px] rounded hover:bg-white/10 ${open ? "bg-white/10" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-8 min-w-[220px] bg-neutral-900 border border-white/10 rounded-md shadow-xl py-1 z-50">
          {items.map((it, i) =>
            it.divider ? (
              <div key={i} className="h-px bg-white/10 my-1" />
            ) : (
              <button
                key={i}
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onClick?.(); }}
                className="w-full flex items-center gap-2 px-3 h-8 text-[13px] text-left hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {it.checked !== undefined ? (
                  it.checked ? <Check size={14} className="opacity-90" /> : <span className="w-[14px]" />
                ) : it.icon ? <it.icon size={14} className="opacity-70" /> : <span className="w-[14px]" />}
                <span className="flex-1">{it.label}</span>
                {it.shortcut && <span className="text-white/30 text-xs">{it.shortcut}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function TopMenuBar({ onAction, fillStroke, canUndo, canRedo, showGrid, showGuides, panels, onTogglePanel, toolbarVisible, onToggleToolbar, showBBox, onToggleBBox, workspaceMode, onModeChange, canvasTheme, onToggleCanvasTheme, artboard, onArtboardChange, rulerUnit, onRulerUnitChange, onExport, showRulers, onToggleRulers, lockMargins = false, onToggleLockMargins, onResetMargins, autoAddDelete, onToggleAutoAddDelete, rubberBand, onToggleRubberBand }) {
  return (
    <div className="flex items-center h-9 px-2 bg-neutral-950 border-b border-white/10 select-none">
      <div className="flex items-center gap-1.5 mr-3 pr-3 border-r border-white/10">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 grid place-items-center p-[3px]">
          <Logo className="w-full h-full" fill="#fff" />
        </div>
        <span className="text-[13px] font-medium tracking-tight">DR Studio</span>
      </div>
      <Menu label="File" items={[
        { label: "New Font", icon: FilePlus, onClick: () => onAction("new") },
        { label: "Open Project…", icon: FolderOpen, onClick: () => onAction("open") },
        { divider: true },
        { label: "Save", icon: Save, shortcut: "⌘S", onClick: () => onAction("save") },
        { label: "Save As…", shortcut: "⌘⇧S", onClick: () => onAction("saveAs") },
        { label: "Export Font…", icon: Download, onClick: () => onAction("export") },
        { divider: true },
        { label: "Font Info…", icon: Type, onClick: () => onAction("metadata") },
        { divider: true },
        { label: "Exit", onClick: () => onAction("exit") },
      ]} />
      <Menu label="Edit" items={[
        { label: "Undo", icon: Undo2, shortcut: "⌘Z", disabled: !canUndo, onClick: () => onAction("undo") },
        { label: "Redo", icon: Redo2, shortcut: "⌘⇧Z", disabled: !canRedo, onClick: () => onAction("redo") },
        { divider: true },
        { label: "Cut", shortcut: "⌘X", onClick: () => onAction("cut") },
        { label: "Copy", shortcut: "⌘C", onClick: () => onAction("copy") },
        { label: "Paste", shortcut: "⌘V", onClick: () => onAction("paste") },
        { label: "Delete", shortcut: "⌫", onClick: () => onAction("delete") },
        { label: "Duplicate", shortcut: "⌘D", onClick: () => onAction("duplicate") },
      ]} />
      <Menu label="View" items={[
        { label: "Zoom In", icon: ZoomIn, onClick: () => onAction("zoomIn") },
        { label: "Zoom Out", icon: ZoomOut, onClick: () => onAction("zoomOut") },
        { label: "Fit Canvas", icon: Maximize, onClick: () => onAction("fit") },
        { divider: true },
        { label: "Grid", icon: Grid3x3, checked: showGrid, onClick: () => onAction("toggleGrid") },
        { label: "Guides", icon: Ruler, checked: showGuides, onClick: () => onAction("toggleGuides") },
        { label: "Bounding Box", checked: showBBox, onClick: onToggleBBox },
        { divider: true },
        { label: "Auto Add/Delete (Vector)", checked: autoAddDelete, onClick: onToggleAutoAddDelete },
        { label: "Rubber Band Preview", checked: rubberBand, onClick: onToggleRubberBand },
        { divider: true },
        { label: "Toolbar", checked: toolbarVisible, onClick: onToggleToolbar },
        ...panels.map((p) => ({ label: p.label, checked: p.visible, onClick: () => onTogglePanel(p.id) })),
      ]} />
      <Menu label="Object" items={[
        { label: "Shape Shifter: Unite", onClick: () => onAction("shapeshifter:unite") },
        { label: "Shape Shifter: Minus Front", onClick: () => onAction("shapeshifter:minusFront") },
        { label: "Shape Shifter: Intersect", onClick: () => onAction("shapeshifter:intersect") },
        { label: "Shape Shifter: Exclude", onClick: () => onAction("shapeshifter:exclude") },
        { divider: true },
        { label: "Shape Shifter: Divide", onClick: () => onAction("shapeshifter:divide") },
        { label: "Shape Shifter: Trim", onClick: () => onAction("shapeshifter:trim") },
        { label: "Shape Shifter: Merge", onClick: () => onAction("shapeshifter:merge") },
        { label: "Shape Shifter: Crop", onClick: () => onAction("shapeshifter:crop") },
        { label: "Shape Shifter: Outline", onClick: () => onAction("shapeshifter:outline") },
        { label: "Shape Shifter: Minus Back", onClick: () => onAction("shapeshifter:minusBack") },
        { divider: true },
        { label: "Repeat Last Shape Shifter", onClick: () => onAction("shapeshifterRepeat") },
        { divider: true },
        { label: "Expand Compound Shape", icon: Wand2, onClick: () => onAction("compoundExpand") },
        { label: "Release Compound Shape", icon: Ungroup, onClick: () => onAction("compoundRelease") },
        { divider: true },
        { label: "Create Outlines", icon: Wand2, shortcut: "⌘⇧O", onClick: () => onAction("createOutlines") },
        { label: "Ungroup Outlines", icon: Ungroup, onClick: () => onAction("ungroupOutlines") },
      ]} />
      <Menu label="Glyph" items={[
        { label: "New Glyph", icon: Plus, onClick: () => onAction("newGlyph") },
        { label: "Duplicate Glyph", icon: Copy, onClick: () => onAction("duplicateGlyph") },
        { label: "Clear Glyph", icon: Trash2, onClick: () => onAction("clearGlyph") },
        { divider: true },
        { label: "Import SVG…", icon: Upload, onClick: () => onAction("importSvg") },
      ]} />
      <Menu label="Help" items={[
        { label: "About DR Studio", icon: Info, onClick: () => onAction("about") },
      ]} />
      <div className="flex-1 flex justify-center items-center gap-2">
        <TopBarAppearance fillStroke={fillStroke} />
        <button
          title="Toggle Rulers (Ctrl+R)"
          onClick={onToggleRulers}
          className={`w-7 h-7 grid place-items-center rounded-md ${showRulers ? "bg-neutral-700 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
        >
          <Ruler size={15} strokeWidth={1.75} />
        </button>
        {workspaceMode === "font" && (
          <button
            title={lockMargins ? "Unlock Margins" : "Lock Margins"}
            onClick={onToggleLockMargins}
            className={`w-7 h-7 grid place-items-center rounded-md ${lockMargins ? "bg-violet-600 text-white" : "text-white/60 hover:text-white hover:bg-white/10"}`}
          >
            {lockMargins ? <Lock size={15} strokeWidth={1.75} /> : <LockOpen size={15} strokeWidth={1.75} />}
          </button>
        )}
        {workspaceMode === "font" && (
          <button
            title="Reset Margins"
            onClick={onResetMargins}
            className="w-7 h-7 grid place-items-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
          >
            <RotateCcw size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 pr-1">
        <button
          title={`Canvas: ${canvasTheme === "light" ? "Light" : "Dark"} (click to switch)`}
          onClick={onToggleCanvasTheme}
          className="w-7 h-7 grid place-items-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
        >
          {canvasTheme === "light" ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
        </button>
        <div className="flex items-center bg-neutral-800 rounded-md p-0.5 border border-white/10">
          <button
            onClick={() => onModeChange("font")}
            className={`flex items-center gap-1 px-2.5 h-6 text-[11px] rounded transition-colors ${workspaceMode === "font" ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"}`}
          >
            <Type size={12} />
            Font Design
          </button>
          <button
            onClick={() => onModeChange("illustration")}
            className={`flex items-center gap-1 px-2.5 h-6 text-[11px] rounded transition-colors ${workspaceMode === "illustration" ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"}`}
          >
            <Shapes size={12} />
            Illustration
          </button>
        </div>
        <div className="w-px h-6 bg-white/10 mx-2" />
        <button
          onClick={onExport}
          className="flex items-center gap-1 h-7 px-3 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium"
        >
          Export <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}