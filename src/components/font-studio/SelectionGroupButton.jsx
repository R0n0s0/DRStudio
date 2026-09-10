import React, { useEffect, useRef } from "react";
import { MousePointer2, MousePointer } from "lucide-react";
import useToolFlyout from "./useToolFlyout";

const SELECTORS = [
  { id: "select", icon: MousePointer2, label: "Selection Tool", key: "V" },
  { id: "node", icon: MousePointer, label: "Direct Selection Tool", key: "A" },
];
const SELECTOR_IDS = SELECTORS.map((s) => s.id);

export default function SelectionGroupButton({ tool, setTool }) {
  const last = useRef("select");
  useEffect(() => { if (SELECTOR_IDS.includes(tool)) last.current = tool; }, [tool]);
  const currentId = SELECTOR_IDS.includes(tool) ? tool : last.current;
  const currentDef = SELECTORS.find((s) => s.id === currentId) || SELECTORS[0];
  const CurrentIcon = currentDef.icon;
  const isActive = SELECTOR_IDS.includes(tool);

  const { open, pos, hoveredId, wrapRef, registerItem, startPress, pickByClick } = useToolFlyout({
    holdMs: 250,
    onPick: setTool,
    onShortPress: () => setTool(currentId),
  });

  return (
    <div className="relative" ref={wrapRef}>
      <button
        title={`${currentDef.label} (${currentDef.key}) — hold for both selection tools`}
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
          {SELECTORS.map((s) => {
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