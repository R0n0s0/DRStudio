// Shared unit conversion helpers for rulers and metric panels.
// Font units (fu) map 1:1 to screen pixels at zoom 1, so all conversions
// route through pixels: 1 unit = PX_PER_UNIT[unit] px.

export const PX_PER_UNIT = { px: 1, in: 96, cm: 37.7952756, mm: 3.77952756, fu: 1 };
export const UNIT_LABELS = { px: "Pixels", cm: "Centimeters", in: "Inches", mm: "Millimeters", fu: "Font Units" };

// Convert a font-unit value to the display unit (rounded for UI).
export const toDisplay = (v, unit) =>
  unit === "fu" || unit === "px" ? Math.round(v) : Math.round((v / (PX_PER_UNIT[unit] || 1)) * 100) / 100;

// Convert an edited display-unit value back to font units.
export const fromDisplay = (v, unit) =>
  unit === "fu" || unit === "px" ? Math.round(v) : Math.round(v * (PX_PER_UNIT[unit] || 1));