// Glyph data model, character sets, and project factory for DR Font Studio.

export const DEFAULT_METRICS = {
  unitsPerEm: 1000,
  ascender: 800,
  capHeight: 700,
  xHeight: 500,
  descender: -200,
  baseline: 0,
  defaultAdvanceWidth: 600,
  defaultLSB: 50,
  defaultRSB: 50,
};

const range = (start, end) => {
  const out = [];
  for (let c = start; c <= end; c++) out.push(String.fromCharCode(c));
  return out;
};

export const CHAR_SETS = [
  {
    name: "Basic Latin",
    glyphs: [
      { label: "Uppercase A–Z", chars: range(65, 90) },
      { label: "Lowercase a–z", chars: range(97, 122) },
    ],
  },
  {
    name: "Numbers",
    glyphs: [{ label: "0–9", chars: range(48, 57) }],
  },
  {
    name: "Punctuation",
    glyphs: [
      { label: "Common", chars: [".", ",", ";", ":", "!", "?", "¿", "¡"] },
      { label: "Brackets", chars: ["(", ")", "[", "]", "{", "}"] },
      { label: "Quotes & dashes", chars: ["\u201C", "\u201D", "\u2018", "\u2019", "-", "_"] },
    ],
  },
  {
    name: "Symbols",
    glyphs: [{ label: "Common symbols", chars: ["@", "#", "$", "%", "&", "*", "+", "=", "/", "\u20AC"] }],
  },
  {
    name: "Accented",
    glyphs: [
      { label: "Uppercase acute", chars: ["Á", "É", "Í", "Ó", "Ú"] },
      { label: "Lowercase acute", chars: ["á", "é", "í", "ó", "ú"] },
      { label: "Ñ / Ü / Ç", chars: ["Ñ", "ñ", "Ü", "ü", "Ç", "ç"] },
    ],
  },
];

export function getGlyphList() {
  const list = [];
  for (const section of CHAR_SETS) {
    for (const group of section.glyphs) {
      for (const ch of group.chars) {
        list.push({ char: ch, unicode: ch.codePointAt(0), section: section.name });
      }
    }
  }
  return list;
}

export function makeEmptyGlyph(char, unicode, metrics = DEFAULT_METRICS) {
  return {
    char,
    unicode,
    contours: [],
    components: [],
    textFrames: [],
    layers: [],
    advanceWidth: metrics.defaultAdvanceWidth,
    leftSideBearing: metrics.defaultLSB,
    rightSideBearing: metrics.defaultRSB,
  };
}

export function buildDefaultGlyphs(metrics = DEFAULT_METRICS) {
  const glyphs = {};
  for (const { char, unicode } of getGlyphList()) {
    glyphs[char] = makeEmptyGlyph(char, unicode, metrics);
  }
  return glyphs;
}

export function createNewProject() {
  return {
    metadata: {
      fontName: "New Font",
      familyName: "New Font",
      style: "Regular",
      designer: "Donoso Ron",
      version: "1.000",
      copyright: "",
      description: "",
    },
    metrics: { ...DEFAULT_METRICS },
    glyphs: buildDefaultGlyphs(DEFAULT_METRICS),
    artboard: { width: 1080, height: 1080 },
    kerning: {},
    guides: { showGrid: true, showGuides: true },
    swatches: [],
    recentColors: [],
    settings: {},
  };
}