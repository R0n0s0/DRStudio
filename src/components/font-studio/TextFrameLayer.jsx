import React from "react";
import { resolveContours, transformContour, pathD } from "@/font/geometry";
import { layoutText, PROJECT_FONT_ID, fontString } from "@/font/textModel";

// Renders a single text frame as SVG content (no DOM root — returns a <g>).
export default function TextFrameLayer({ frame, toScreen, zoom, metrics, loadedFonts, projectGlyphs }) {
  const lines = layoutText(frame, metrics, loadedFonts, projectGlyphs);
  const opacity = frame.opacity ?? 1;

  if (frame.fontFamily === PROJECT_FONT_ID) {
    // Draw designed glyph contours per character.
    const upm = metrics.unitsPerEm;
    const scale = frame.fontSize / upm;
    const elems = [];
    lines.forEach((line, li) => {
      let cursorX = line.x;
      for (const ch of line.text) {
        const g = projectGlyphs?.[ch];
        if (g && g.contours && g.contours.length) {
          const resolved = resolveContours(g, projectGlyphs);
          resolved.forEach((c, ci) => {
            const tc = transformContour(c, (x, y) => ({ x: x * scale + cursorX, y: y * scale + line.baselineY }));
            elems.push(<path key={`p${li}-${cursorX}-${ci}`} d={pathD(tc, toScreen)} fill="#e5e7eb" fillRule="evenodd" opacity={opacity} />);
          });
        }
        cursorX += ((g ? g.advanceWidth : upm * 0.5) * scale) + frame.tracking;
      }
    });
    return <g>{elems}</g>;
  }

  // System / loaded font: native SVG <text>.
  return (
    <g opacity={opacity}>
      {lines.map((line, i) => {
        const s = toScreen({ x: line.x, y: line.baselineY });
        return (
          <text
            key={`t${i}`}
            x={s.x}
            y={s.y}
            fill="#e5e7eb"
            fontFamily={frame.fontFamily}
            fontSize={frame.fontSize * zoom}
            fontWeight={frame.fontWeight === "italic" ? "normal" : frame.fontWeight}
            fontStyle={frame.fontWeight === "italic" ? "italic" : "normal"}
            letterSpacing={frame.tracking * zoom}
            style={{ font: fontString({ ...frame, fontSize: frame.fontSize * zoom }) }}
          >
            {line.text}
          </text>
        );
      })}
    </g>
  );
}