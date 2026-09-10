import React from "react";
import { pathD } from "@/font/geometry";
import { isGradientFill } from "@/font/appearance";
import { buildGrad } from "./gradientUtils";
import { capToSvg, dashArrayCss, buildTaperedStroke, arrowheadPath, endpointTangents } from "@/font/strokeRender";

// Renders the stroke of a single contour with full stroke properties:
// caps, joins + miter limit, dash pattern, stroke alignment (closed paths),
// variable width profiles, and start/end arrowheads.
export default function StrokeLayer({ contour, ap, toScreen, zoom, id }) {
  if (!ap.stroke || ap.strokeWidth <= 0) return null;
  const gid = `stroke-${id}`;
  const strokeAttr = isGradientFill(ap.stroke) ? `url(#${gid})` : ap.stroke;
  const d = pathD(contour, toScreen);
  const closed = contour.closed;
  const align = closed ? ap.strokeAlign : "center";
  const tapered = ap.widthProfile && ap.widthProfile !== "uniform";

  const tangents = endpointTangents(contour);
  const arrows = [];
  if (ap.arrowStart && ap.arrowStart.type && ap.arrowStart.type !== "none" && contour.points.length) {
    arrows.push({ key: "as", d: arrowheadPath(contour.points[0], tangents.start, ap.arrowStart.type, ap.arrowStart.scale, ap.arrowStart.align, ap.strokeWidth, toScreen) });
  }
  if (ap.arrowEnd && ap.arrowEnd.type && ap.arrowEnd.type !== "none" && contour.points.length > 1) {
    const last = contour.points.length - 1;
    arrows.push({ key: "ae", d: arrowheadPath(contour.points[last], tangents.end, ap.arrowEnd.type, ap.arrowEnd.scale, ap.arrowEnd.align, ap.strokeWidth, toScreen) });
  }

  const defs = isGradientFill(ap.stroke) ? <defs>{buildGrad(ap.stroke, gid, toScreen)}</defs> : null;

  if (tapered) {
    const td = buildTaperedStroke(contour, ap, toScreen);
    return (
      <g>
        {defs}
        <path d={td} fill={strokeAttr} fillOpacity={ap.strokeOpacity} opacity={ap.opacity} fillRule="nonzero" />
        {arrows.map((a) => <path key={a.key} d={a.d} fill={strokeAttr} fillOpacity={ap.strokeOpacity} opacity={ap.opacity} />)}
      </g>
    );
  }

  const strokeEl = (
    <path d={d} fill="none" stroke={strokeAttr} strokeWidth={ap.strokeWidth * zoom}
      strokeOpacity={ap.strokeOpacity} opacity={ap.opacity}
      strokeLinecap={capToSvg(ap.cap)} strokeLinejoin={ap.join} strokeMiterlimit={ap.miterLimit || 10}
      strokeDasharray={dashArrayCss(ap.dashPattern, zoom)} strokeDashoffset={(ap.dashOffset || 0) * zoom || undefined}
    />
  );

  let inner = strokeEl;
  if (align === "inside" && closed) {
    inner = (
      <g>
        <defs><clipPath id={`cl-${id}`}><path d={d} fillRule="evenodd" /></clipPath></defs>
        <g clipPath={`url(#cl-${id})`}>{strokeEl}</g>
      </g>
    );
  } else if (align === "outside" && closed) {
    inner = (
      <g>
        <defs>
          <mask id={`mk-${id}`} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
            <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
            <path d={d} fill="black" fillRule="evenodd" />
          </mask>
        </defs>
        <g mask={`url(#mk-${id})`}>{strokeEl}</g>
      </g>
    );
  }

  return (
    <g>
      {defs}
      {inner}
      {arrows.map((a) => <path key={a.key} d={a.d} fill={strokeAttr} fillOpacity={ap.strokeOpacity} opacity={ap.opacity} />)}
    </g>
  );
}