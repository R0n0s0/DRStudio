// Project serialization (.drfontproj) and file helpers.
import { createNewProject, DEFAULT_METRICS, buildDefaultGlyphs } from "./glyphModel";

export const PROJECT_VERSION = 1;
export const PROJECT_EXT = ".dr";

export function serializeProject(project) {
  return JSON.stringify({ version: PROJECT_VERSION, ...project }, null, 2);
}

export function deserializeProject(text) {
  const data = JSON.parse(text);
  const base = createNewProject();
  const project = {
    metadata: { ...base.metadata, ...(data.metadata || {}) },
    metrics: { ...DEFAULT_METRICS, ...(data.metrics || {}) },
    glyphs: { ...buildDefaultGlyphs(data.metrics || DEFAULT_METRICS), ...(data.glyphs || {}) },
    artboard: data.artboard || base.artboard,
    kerning: data.kerning || {},
    guides: { ...base.guides, ...(data.guides || {}) },
    swatches: data.swatches || base.swatches,
    recentColors: data.recentColors || base.recentColors,
    settings: data.settings || {},
  };
  return project;
}

export function downloadFile(filename, content, mime = "application/octet-stream") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function slugify(name) {
  return (name || "untitled").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}