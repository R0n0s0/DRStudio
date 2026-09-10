import React from "react";

// Bounding box with 8 handles for a Direct Selection sub-selection (selected anchors).
// Blue dashed style distinguishes it from the purple object-selection bbox.
export default function SubSelectionBBox({ bb, toScreen }) {
  const midX = (bb.minX + bb.maxX) / 2, midY = (bb.minY + bb.maxY) / 2;
  const handles = [
    ["nw", bb.minX, bb.maxY], ["n", midX, bb.maxY], ["ne", bb.maxX, bb.maxY],
    ["e", bb.maxX, midY], ["se", bb.maxX, bb.minY], ["s", midX, bb.minY],
    ["sw", bb.minX, bb.minY], ["w", bb.minX, midY],
  ];
  const tl = toScreen({ x: bb.minX, y: bb.maxY }), br = toScreen({ x: bb.maxX, y: bb.minY });
  return (
    <g>
      <rect x={Math.min(tl.x, br.x)} y={Math.min(tl.y, br.y)} width={Math.abs(br.x - tl.x)} height={Math.abs(br.y - tl.y)} fill="none" stroke="#0ea5e9" strokeWidth={1} strokeDasharray="3 2" />
      {handles.map(([id, x, y]) => { const s = toScreen({ x, y }); return <rect key={id} x={s.x - 4} y={s.y - 4} width={8} height={8} fill="#fff" stroke="#0ea5e9" strokeWidth={1} />; })}
    </g>
  );
}