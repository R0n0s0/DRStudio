import React, { useEffect, useRef } from "react";
import { Square, Circle, Triangle, Hexagon, Star } from "lucide-react";
import useToolFlyout from "./useToolFlyout";

// Custom rounded-rectangle icon (lucide version lacks SquareRoundCorner).
function RoundedRectIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="4" />
    </svg>
  );
}

// Custom ellipse icon (lucide has no plain ellipse).
function EllipseIcon({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="12" rx="10" ry="6.5" />
    </svg>
  );
}

const SHAPES = [
  { id: "rectangle", icon: Square, label: "Rectangle Tool", key: "M" },
  { id: "roundedRect", icon: RoundedRectIcon, label: "Rounded Rectangle Tool", key: "R" },
  { id: "circle", icon: Circle, label: "Circle Tool", key: "C" },
  { id: "ellipse", icon: EllipseIcon, label: "Ellipse Tool", key: "L" },
  { id: "triangle", icon: Triangle, label: "Triangle Tool", key: "T" },
  { id: "polygon", icon: Hexagon, label: "Polygon Tool", key: "G" },
  { id: "star", icon: Star, label: "Star Tool", key: "S" },
];
const SHAPE_IDS = SHAPES.map((s) => s.id);

export default function ShapeGroupButton({ tool, setTool }) {
  const lastShape = useRef("rectangle");
  useEffect(() => { if (SHAPE_IDS.includes(tool)) lastShape.current = tool; }, [tool]);
  const currentShape = SHAPE_IDS.includes(tool) ? tool : lastShape.current;
  const currentDef = SHAPES.find((s) => s.id === currentShape) || SHAPES[0];
  const CurrentIcon = currentDef.icon;
  const isActive = SHAPE_IDS.includes(tool);

  const { open, pos, hoveredId, wrapRef, registerItem, startPress, pickByClick } = useToolFlyout({
    holdMs: 250,
    onPick: setTool,
    onShortPress: () => setTool(currentShape),
  });

  return (
    <div className="relative" ref={wrapRef}>
      <button
        title={`${currentDef.label} (${currentDef.key}) — hold for all shapes`}
        onPointerDown={startPress}
        style={{ touchAction: "none" }}
        className={`relative w-9 h-9 grid place-items-center rounded-sm transition-colors ${
          isActive ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <CurrentIcon size={17} strokeWidth={1.75} />
        <span className="absolute bottom-0.5 right-0.5 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[4px] border-l-neutral-400" />
      </button>

      {open && pos && (
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 bg-neutral-900 border border-white/10 rounded-md shadow-xl p-1 flex flex-col gap-0.5"
        >
          {SHAPES.map((s) => {
            const Icon = s.icon;
            const sel = tool === s.id;
            const hov = hoveredId === s.id;
            return (
              <button
                key={s.id}
                ref={registerItem(s.id)}
                title={`${s.label} (${s.key})`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickByClick(s.id)}
                className={`w-9 h-9 grid place-items-center rounded-sm ${
                  hov ? "bg-violet-600 text-white" : sel ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={17} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}