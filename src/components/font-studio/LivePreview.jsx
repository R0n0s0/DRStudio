import React from "react";
import { pathD, resolveContours } from "@/font/geometry";

export default function LivePreview({ project, text, size, align }) {
  const upem = project.metrics.unitsPerEm || 1000;
  const scale = size / upem;
  const lineHeight = (project.metrics.ascender - project.metrics.descender) * scale;
  const lineH = project.metrics.ascender * scale;

  const renderLine = (line, key) => {
    let x = 0;
    const items = [];
    for (const ch of line) {
      const g = project.glyphs[ch];
      if (!g) { x += project.metrics.defaultAdvanceWidth * scale; continue; }
      const toScreen = (p) => ({ x: p.x * scale, y: -p.y * scale + lineH });
      items.push(
        <g key={key + "-" + items.length} transform={`translate(${x},0)`}>
          {resolveContours(g, project.glyphs).map((c, i) => (
            <path key={i} d={pathD(c, toScreen)} fill="currentColor" fillRule="evenodd" />
          ))}
        </g>
      );
      x += (g.advanceWidth || 0) * scale;
    }
    return { items, width: x };
  };

  const lines = text.split("\n");
  const rendered = lines.map((l, i) => renderLine(l, i));
  const totalWidth = Math.max(...rendered.map((r) => r.width), 100);

  return (
    <div className="p-3">
      <svg
        width="100%"
        height={rendered.length * lineHeight + 8}
        viewBox={`0 0 ${totalWidth} ${rendered.length * lineHeight + 8}`}
        preserveAspectRatio={align === "center" ? "xMidYMin meet" : align === "right" ? "xMaxYMin meet" : "xMinYMin meet"}
        className="text-white"
      >
        {rendered.map((r, i) => (
          <g key={i} transform={`translate(${align === "center" ? (totalWidth - r.width) / 2 : align === "right" ? totalWidth - r.width : 0}, ${i * lineHeight})`}>
            {r.items}
          </g>
        ))}
      </svg>
    </div>
  );
}