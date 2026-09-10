import React from "react";
import { Plus, Copy, Trash2, Layers, Square, Scissors, EyeOff, Lock, Settings, Folder, Grid } from "lucide-react";

export default function LayerOptionsMenu({ open, onClose, actions }) {
  if (!open) return null;

  const Item = ({ icon: Icon, label, onClick, disabled, danger }) => (
    <button
      onClick={() => { if (!disabled) { onClick(); onClose(); } }}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2.5 py-1 text-[11px] rounded text-left transition-colors ${
        disabled ? "text-white/20 cursor-default"
        : danger ? "text-white/80 hover:bg-red-500/20 hover:text-red-300"
        : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {Icon && <Icon size={12} className="flex-shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );

  const Section = ({ title, children }) => (
    <div className="py-0.5">
      <div className="px-2.5 text-[9px] uppercase tracking-wider text-white/30 font-medium mb-0.5">{title}</div>
      {children}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full right-0 mt-1 w-52 bg-neutral-800 border border-white/15 rounded-lg shadow-2xl z-50 max-h-[70vh] overflow-y-auto py-1">
        <Section title="Create & Delete">
          <Item icon={Plus} label="New Layer..." onClick={actions.newLayer} />
          <Item icon={Folder} label="New Sublayer..." onClick={actions.newSublayer} disabled={!actions.hasActive} />
          <Item icon={Copy} label="Duplicate Layer" onClick={actions.duplicateLayer} disabled={!actions.hasActive} />
          <Item icon={Trash2} label={`Delete "${actions.targetName || "Layer"}"`} onClick={actions.deleteLayer} disabled={!actions.hasActive} danger />
        </Section>
        <div className="border-t border-white/10 my-1" />
        <Section title="Hierarchy & Consolidation">
          <Item icon={Layers} label="Collect in New Layer" onClick={actions.collectInNewLayer} disabled={!actions.hasSelection} />
          <Item icon={Square} label="Release to Layers (Sequence)" onClick={actions.releaseToLayers} disabled={!actions.hasActive} />
          <Item icon={Layers} label="Merge Layers" onClick={actions.mergeLayers} disabled={!actions.canMerge} />
          <Item icon={Grid} label="Flatten Artwork" onClick={actions.flattenArtwork} disabled={!actions.canFlatten} />
        </Section>
        <div className="border-t border-white/10 my-1" />
        <Section title="Masks & Isolation">
          <Item icon={Scissors} label={actions.hasClipMask ? "Release Clipping Mask" : "Make Clipping Mask"} onClick={actions.toggleClipMask} disabled={!actions.canClipMask} />
          <Item icon={EyeOff} label="Toggle Template State" onClick={actions.toggleTemplate} disabled={!actions.hasActive} />
          <Item icon={Lock} label="Lock Others" onClick={actions.lockOthers} disabled={!actions.hasActive} />
          <Item icon={EyeOff} label="Hide Others" onClick={actions.hideOthers} disabled={!actions.hasActive} />
        </Section>
        <div className="border-t border-white/10 my-1" />
        <Section title="Panel View Options">
          <Item icon={Settings} label="Panel Options..." onClick={actions.panelOptions} />
        </Section>
      </div>
    </>
  );
}