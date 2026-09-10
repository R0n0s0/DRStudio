import React from "react";
import { Spline } from "lucide-react";

// The Vector Tool is the single, context-sensitive Bézier tool. Add/Delete/
// Convert/Move are contextual hover + modifier states of this one tool — no
// separate toolbar tools are exposed.
const VectorIcon = ({ size = 17, strokeWidth = 1.75 }) => (
  <Spline size={size} strokeWidth={strokeWidth} />
);

export default function PenGroupButton({ tool, setTool }) {
  const isActive = tool === "pen";
  return (
    <button
      title="Vector Tool (P) — hover path: add anchor · hover anchor: delete · Ctrl+drag: move · Alt+drag: convert"
      onClick={() => setTool("pen")}
      className={`relative w-9 h-9 grid place-items-center rounded-sm transition-colors ${
        isActive ? "bg-neutral-600 text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <VectorIcon size={17} strokeWidth={1.75} />
    </button>
  );
}