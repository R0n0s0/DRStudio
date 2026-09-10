import React, { useEffect, useRef } from "react";
import { fontAscent } from "@/font/textModel";

// Inline textarea overlay for editing a text frame's content.
export default function TextFrameEditor({ frame, toScreen, zoom, metrics, loadedFonts, onChange, onCommit }) {
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  // Screen position of the editing box.
  let left, top, width, height;
  if (frame.kind === "area") {
    const tl = toScreen({ x: frame.x, y: frame.y });
    width = frame.width * zoom;
    height = frame.height * zoom;
    left = tl.x;
    top = tl.y;
  } else {
    const ascent = fontAscent(frame, metrics, loadedFonts);
    const base = toScreen({ x: frame.x, y: frame.y });
    left = base.x - 2;
    top = base.y - ascent * zoom;
    width = 240;
    height = Math.max(frame.fontSize * zoom * 1.4, 30);
  }

  return (
    <textarea
      ref={ref}
      value={frame.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onCommit(); }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onCommit(); }
      }}
      placeholder="Type text…"
      spellCheck={false}
      className="absolute z-40 bg-neutral-800/90 border border-violet-500 rounded px-1 py-0.5 text-white resize-none outline-none placeholder-white/30"
      style={{
        left, top, width, height: frame.kind === "area" ? height : "auto",
        minHeight: height,
        fontFamily: frame.fontFamily === "__project__" ? "system-ui" : `"${frame.fontFamily}", sans-serif`,
        fontSize: frame.fontSize * zoom,
        fontWeight: frame.fontWeight === "italic" ? "normal" : frame.fontWeight,
        fontStyle: frame.fontWeight === "italic" ? "italic" : "normal",
        letterSpacing: frame.tracking * zoom,
        lineHeight: frame.leading / 100,
        textAlign: frame.align,
      }}
    />
  );
}