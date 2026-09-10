import React from "react";
import {
  Pencil, Scaling, Hand, ZoomIn, Pipette, Type,
  FlipHorizontal2, FlipVertical2, Trash2,
} from "lucide-react";
import ShapeGroupButton from "./ShapeGroupButton";
import BrushGroupButton from "./BrushGroupButton";
import SelectionGroupButton from "./SelectionGroupButton";
import PenGroupButton from "./PenGroupButton";
import FillStrokeWidget from "./FillStrokeWidget";
import GradientToolIcon from "./GradientToolIcon";

const TOOLS = {
  pencil: { icon: Pencil, label: "Pencil Tool", key: "N" },
  type: { icon: Type, label: "Type Tool", key: "T" },
  transform: { icon: Scaling, label: "Free Transform Tool", key: "E" },
  gradient: { icon: GradientToolIcon, label: "Gradient Tool", key: "G" },
  hand: { icon: Hand, label: "Hand Tool", key: "H" },
  zoom: { icon: ZoomIn, label: "Zoom Tool", key: "Z" },
  eyedropper: { icon: Pipette, label: "Eyedropper Tool", key: "I" },
};

// Flat tool list with dividers; the 7 shape tools collapse into one "shapeGroup" slot.
const LAYOUT = [
  "selectionGroup",
  "divider",
  "eyedropper",
  "penGroup", "pencil", "brushGroup",
  "divider",
  "type",
  "gradient",
  "divider",
  "shapeGroup",
  "divider",
  "transform",
  "divider",
  "hand", "zoom",
];

export default function Toolbar({ tool, setTool, onFlip, onDelete, brushSize, setBrushSize, pressureEnabled, setPressureEnabled, fillStroke }) {
  return (
    <div className="relative w-16 flex flex-col items-center py-2 bg-neutral-900 border-r border-black/40 z-30 overflow-y-auto">
      {LAYOUT.map((id, i) =>
        id === "divider" ? (
          <div key={"d" + i} className="w-6 h-px bg-black/40 my-1.5" />
        ) : id === "selectionGroup" ? (
          <SelectionGroupButton key={id} tool={tool} setTool={setTool} />
        ) : id === "penGroup" ? (
          <PenGroupButton key={id} tool={tool} setTool={setTool} />
        ) : id === "shapeGroup" ? (
          <ShapeGroupButton key={id} tool={tool} setTool={setTool} />
        ) : id === "brushGroup" ? (
          <BrushGroupButton key={id} tool={tool} setTool={setTool} brushSize={brushSize} setBrushSize={setBrushSize} pressureEnabled={pressureEnabled} setPressureEnabled={setPressureEnabled} />
        ) : (
          <ToolButton key={id} id={id} active={tool === id} onSelect={setTool} />
        )
      )}

      <div className="my-1.5 w-6 h-px bg-black/40" />

      <button
        title="Delete (Del)"
        onClick={onDelete}
        className="w-9 h-9 grid place-items-center rounded-sm text-neutral-300 hover:bg-white/10 hover:text-white"
      >
        <Trash2 size={17} strokeWidth={1.75} />
      </button>

      <div className="flex-1" />

      <div className="pt-1.5 border-t border-black/40 flex flex-col items-center gap-0.5">
        <button title="Flip Horizontal" onClick={() => onFlip("h")} className="w-9 h-9 grid place-items-center rounded-sm text-neutral-300 hover:bg-white/10 hover:text-white">
          <FlipHorizontal2 size={17} strokeWidth={1.75} />
        </button>
        <button title="Flip Vertical" onClick={() => onFlip("v")} className="w-9 h-9 grid place-items-center rounded-sm text-neutral-300 hover:bg-white/10 hover:text-white">
          <FlipVertical2 size={17} strokeWidth={1.75} />
        </button>
        <div className="my-1 w-6 h-px bg-black/40" />
        <FillStrokeWidget {...fillStroke} />
      </div>
    </div>
  );
}

function ToolButton({ id, active, onSelect }) {
  const t = TOOLS[id];
  const Icon = t.icon;
  return (
    <button
      title={`${t.label} (${t.key})`}
      onClick={() => onSelect(id)}
      className={`relative w-9 h-9 grid place-items-center rounded-sm transition-colors ${
        active ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={17} strokeWidth={1.75} />
    </button>
  );
}