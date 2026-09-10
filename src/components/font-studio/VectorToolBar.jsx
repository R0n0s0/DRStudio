import React from "react";
import { PenTool, Scissors, MousePointer2 } from "lucide-react";

// Custom anchor icons matching the DR Studio reference (monolinear, off-white).
// Sharp: square anchor with two handles at different angles (corner point).
// Smooth: curved arc with anchor dots at both ends.
function SharpIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2.5" width="4" height="4" fill={color} stroke="none" />
      <line x1="10" y1="6.5" x2="4" y2="17" />
      <line x1="10" y1="6.5" x2="16" y2="14" />
    </svg>
  );
}
function SmoothIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14 C 6 4, 14 4, 17 14" />
      <circle cx="3" cy="14" r="1.6" fill={color} stroke="none" />
      <circle cx="17" cy="14" r="1.6" fill={color} stroke="none" />
    </svg>
  );
}

// Handles icon: a bifurcated tail — two thick arched arms from a vertical
// base on the right, flat vertical ends on the left, inner V-notch pointing
// right. Matches the DR Studio reference graphic.
function HandlesIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M15.5 7.5 C 12 7, 7 5, 4 3.5 L 4 6.5 C 7 7.5, 10 9, 12 10 C 10 11, 7 12.5, 4 13.5 L 4 16.5 C 7 15, 12 13, 15.5 12.5 Z"
        fill={color}
      />
    </svg>
  );
}

// Floating mode selector for the Vector Tool.
// "Vector Tool" (default) = the full contextual tool: hover a path to add an
// anchor, hover an anchor to delete (Auto Add/Delete), Alt-drag to convert,
// Ctrl-drag to move handles/anchors, click endpoints to continue/close paths.
// "Direct" = persistent handle/anchor editing: grab a lever to move it
//   (Alt-drag moves just one side of a smooth pair), grab an anchor to move it.
// "Sharp" / "Smooth" / "Delete" = single-purpose sub-modes: clicking an anchor
//   applies just that one action. Selecting "Vector Tool" returns to the full tool.
export default function VectorToolBar({ subMode, onSetSubMode }) {
  const Btn = ({ active, onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      className={`h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 transition-colors whitespace-nowrap ${
        active ? "bg-violet-600 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
  const select = (m) => onSetSubMode(subMode === m ? null : m);
  return (
    <div className="flex items-center gap-1 bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl px-1.5 py-1">
      <Btn active={subMode === null} onClick={() => onSetSubMode(null)}
        title={"Vector Tool (default)\nThe full contextual tool: hover a path to add an anchor, hover an anchor to delete (Auto Add/Delete), Alt-drag to convert, hold Ctrl/Cmd to move handles or anchors, click endpoints to continue/close.\nShortcut: P"}>
        <PenTool size={13} /> Vector Tool
      </Btn>
      <div className="w-px h-5 bg-white/10 mx-1" />
      <Btn active={subMode === "direct"} onClick={() => select("direct")}
        title={"Direct\nGrab a Bézier handle (lever) and move it — the opposite handle mirrors it for a smooth curve. Alt-drag moves just one side. Grab an anchor to reposition it.\nShortcut: hold Ctrl/Cmd in Vector Tool"}>
        <MousePointer2 size={13} /> Direct
      </Btn>
      <div className="w-px h-5 bg-white/10 mx-1" />
      <Btn active={subMode === "curveHandle"} onClick={() => select("curveHandle")}
        title={"Handles\nDrag a single lever — only the grabbed handle moves, the opposite handle stays put and the point becomes a corner. Use this to shape each side independently: one side curved, the other sharp, or two different curves."}>
        <HandlesIcon size={14} /> Handles
      </Btn>
      <div className="w-px h-5 bg-white/10 mx-1" />
      <Btn active={subMode === "sharp"} onClick={() => select("sharp")}
        title={"Sharp\nConvert the clicked anchor to a corner point (strips its handles).\nShortcut: Ctrl+Alt+drag in Vector Tool"}>
        <SharpIcon size={14} /> Sharp
      </Btn>
      <Btn active={subMode === "smooth"} onClick={() => select("smooth")}
        title={"Smooth\nConvert the clicked anchor to a smooth point with symmetric handles so the curve bends.\nShortcut: Alt+drag in Vector Tool"}>
        <SmoothIcon size={14} /> Smooth
      </Btn>
      <Btn active={subMode === "delete"} onClick={() => select("delete")}
        title={"Delete Anchor\nRemove the clicked anchor point.\nShortcut: hover + Auto Add/Delete in Vector Tool"}>
        <Scissors size={13} /> Delete
      </Btn>
    </div>
  );
}