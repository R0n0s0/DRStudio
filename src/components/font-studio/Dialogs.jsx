import React, { useState } from "react";
import { downloadFile, serializeProject, slugify } from "@/font/projectSerializer";
import Logo from "./Logo";

function Modal({ title, children, onClose, width = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${width} bg-neutral-900 border border-white/10 rounded-xl shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/10">
          <h3 className="text-[14px] font-medium">{title}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-[12px] text-white/60">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-neutral-800 border border-white/10 rounded px-2 h-8 text-[13px] text-white focus:outline-none focus:border-violet-500" />
    </label>
  );
}

export function MetadataDialog({ metadata, onChange, onClose }) {
  const [m, setM] = useState(metadata);
  const save = () => { onChange(m); onClose(); };
  return (
    <Modal title="Font Metadata" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Font Name" value={m.fontName} onChange={(v) => setM({ ...m, fontName: v })} />
        <Field label="Family Name" value={m.familyName} onChange={(v) => setM({ ...m, familyName: v })} />
        <Field label="Style" value={m.style} onChange={(v) => setM({ ...m, style: v })} />
        <Field label="Designer" value={m.designer} onChange={(v) => setM({ ...m, designer: v })} />
        <Field label="Version" value={m.version} onChange={(v) => setM({ ...m, version: v })} />
        <Field label="Copyright" value={m.copyright} onChange={(v) => setM({ ...m, copyright: v })} />
      </div>
      <label className="block mt-3">
        <span className="text-[12px] text-white/60">Description</span>
        <textarea value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} rows={3} className="mt-1 w-full bg-neutral-800 border border-white/10 rounded px-2 py-1.5 text-[13px] text-white resize-none focus:outline-none focus:border-violet-500" />
      </label>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-3 h-8 text-[13px] text-white/60 hover:text-white">Cancel</button>
        <button onClick={save} className="px-4 h-8 text-[13px] bg-violet-600 hover:bg-violet-500 rounded text-white">Save</button>
      </div>
    </Modal>
  );
}

export function AboutDialog({ onClose }) {
  return (
    <Modal title="About DR Studio" onClose={onClose} width="max-w-md">
      <div className="text-center space-y-3 py-2">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 grid place-items-center p-2">
          <Logo className="w-full h-full" fill="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">DR Studio</h2>
          <p className="text-[13px] text-white/50">Free Typeface & Vector Design Software</p>
        </div>
        <p className="text-[13px] text-white/70 max-w-sm mx-auto leading-relaxed">
          Be free to create, my friend.
        </p>
        <p className="text-[12px] text-white/40">Created by Donoso Ron</p>
      </div>
    </Modal>
  );
}