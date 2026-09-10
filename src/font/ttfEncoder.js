// Minimal TrueType (.ttf) font encoder for DR Font Studio.
// Converts glyph contours (cubic Béziers) to flattened polygons (on-curve points)
// and writes a valid TrueType font with the required tables.
import { flattenContour, resolveContours } from "./geometry";
import { normalizeGlyphDirections } from "./booleanEngine";
import wawoff from "wawoff2";

class BW {
  constructor() { this.b = []; }
  u8(v) { this.b.push(v & 255); }
  u16(v) { this.b.push((v >> 8) & 255, v & 255); }
  i16(v) { this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { this.b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  i32(v) { this.u32(v < 0 ? v + 4294967296 : v); }
  bytes(arr) { for (const x of arr) this.b.push(x & 255); }
  str(s) { for (let i = 0; i < s.length; i++) { this.u16(s.charCodeAt(i)); } }
  pad4() { while (this.b.length % 4 !== 0) this.b.push(0); }
  len() { return this.b.length; }
  result() { return new Uint8Array(this.b); }
}

function checksum(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    sum += ((bytes[i] || 0) << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0);
    sum >>>= 0;
  }
  return sum >>> 0;
}

function buildGlyphData(glyph) {
  const contours = [];
  let totalPoints = 0;
  for (const c of glyph.contours || []) {
    const pts = flattenContour(c, 24);
    if (pts.length >= 1) { contours.push(pts); totalPoints += pts.length; }
  }
  const w = new BW();
  if (contours.length === 0) {
    w.i16(0); w.i16(0); w.i16(0); w.i16(0); w.i16(0);
    while (w.len() % 4 !== 0) w.u8(0); // pad empty glyph to 4-byte boundary
    return { data: w.result(), points: 0, contours: 0, bbox: null };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pts of contours) for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  w.i16(contours.length);
  w.i16(Math.round(minX)); w.i16(Math.round(minY));
  w.i16(Math.round(maxX)); w.i16(Math.round(maxY));
  let idx = -1;
  for (const pts of contours) { idx += pts.length; w.u16(idx); }
  w.u16(0); // instruction length
  for (let i = 0; i < totalPoints; i++) w.u8(0x01);
  let px = 0;
  for (const pts of contours) for (const p of pts) {
    w.i16(Math.round(p.x) - px); px = Math.round(p.x);
  }
  let py = 0;
  for (const pts of contours) for (const p of pts) {
    w.i16(Math.round(p.y) - py); py = Math.round(p.y);
  }
  while (w.len() % 4 !== 0) w.u8(0);
  return { data: w.result(), points: totalPoints, contours: contours.length, bbox: { minX, minY, maxX, maxY } };
}

function buildTables(project) {
  const m = project.metrics || {};
  const upem = m.unitsPerEm || 1000;
  const glyphs = Object.values(project.glyphs || {}).filter((g) => (g.contours || []).length > 0);
  glyphs.sort((a, b) => a.unicode - b.unicode);

  const built = [{ data: null, points: 0, contours: 0, bbox: null, advance: 0, lsb: 0, code: null }];
  const charToIndex = {};
  let maxPoints = 0, maxContours = 0;
  let advMax = 0, minLsb = 0, minRsb = 0, xMaxExt = 0;
  glyphs.forEach((g) => {
    const b = buildGlyphData({ ...g, contours: normalizeGlyphDirections(resolveContours(g, project.glyphs)) });
    const idx = built.length;
    charToIndex[g.unicode] = idx;
    built.push({ ...b, advance: g.advanceWidth || 0, lsb: b.bbox ? Math.round(b.bbox.minX) : 0, code: g.unicode });
    maxPoints = Math.max(maxPoints, b.points);
    maxContours = Math.max(maxContours, b.contours);
    advMax = Math.max(advMax, g.advanceWidth || 0);
    if (b.bbox) {
      minLsb = Math.min(minLsb, b.bbox.minX);
      minRsb = Math.min(minRsb, (g.advanceWidth || 0) - b.bbox.maxX);
      xMaxExt = Math.max(xMaxExt, b.bbox.minX + (b.bbox.maxX - b.bbox.minX));
    }
  });
  const numGlyphs = built.length;

  // Font-wide bounding box (union of all glyph bboxes) for the head table.
  let fMinX = 0, fMinY = 0, fMaxX = 0, fMaxY = 0;
  built.forEach((g) => { if (g.bbox) { fMinX = Math.min(fMinX, g.bbox.minX); fMinY = Math.min(fMinY, g.bbox.minY); fMaxX = Math.max(fMaxX, g.bbox.maxX); fMaxY = Math.max(fMaxY, g.bbox.maxY); } });
  const fontBBox = { minX: fMinX, minY: fMinY, maxX: fMaxX, maxY: fMaxY };

  // glyf + loca
  const glyf = new BW();
  const loca = [0];
  built.forEach((g) => {
    if (g.data) glyf.bytes(g.data); else glyf.bytes(buildGlyphData({ contours: [] }).data);
    loca.push(glyf.len());
  });
  const glyfBytes = glyf.result();

  const locaW = new BW();
  loca.forEach((o) => locaW.u32(o));
  const locaBytes = locaW.result();

  // hmtx
  const hmtxW = new BW();
  built.forEach((g) => { hmtxW.u16(g.advance || 0); hmtxW.i16(g.lsb || 0); });
  const hmtxBytes = hmtxW.result();

  // head
  const head = new BW();
  head.u32(0x00010000); head.u32(0x00010000); head.u32(0); head.u32(0x5F0F3CF5);
  head.u16(0x000B); head.u16(upem);
  head.u32(0); head.u32(0);   // created
  head.u32(0); head.u32(0);   // modified
  head.i16(Math.round(fontBBox.minX)); head.i16(Math.round(fontBBox.minY)); head.i16(Math.round(fontBBox.maxX)); head.i16(Math.round(fontBBox.maxY));
  head.u16(0); head.u16(8); head.i16(2); head.i16(1); head.i16(0);
  const headBytes = head.result();

  // hhea
  const hhea = new BW();
  hhea.u32(0x00010000);
  hhea.i16(m.ascender || 800); hhea.i16(m.descender || -200); hhea.i16(0);
  hhea.u16(advMax); hhea.i16(minLsb); hhea.i16(minRsb); hhea.i16(xMaxExt);
  hhea.i16(1); hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0);
  hhea.u16(numGlyphs);
  const hheaBytes = hhea.result();

  // maxp
  const maxp = new BW();
  maxp.u32(0x00010000); maxp.u16(numGlyphs);
  maxp.u16(maxPoints); maxp.u16(maxContours); maxp.u16(0); maxp.u16(0);
  maxp.u16(2); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0);
  const maxpBytes = maxp.result();

  // OS/2 (version 4, 96 bytes)
  const os2 = new BW();
  os2.u16(4); os2.i16(0); os2.u16(400); os2.u16(5); os2.u16(0);
  for (let i = 0; i < 10; i++) os2.i16(0);
  os2.i16(0);
  for (let i = 0; i < 10; i++) os2.u8(0);
  os2.u32(0x00000001); os2.u32(0); os2.u32(0); os2.u32(0);
  os2.bytes([0x6E, 0x6F, 0x6E, 0x65]); // "none"
  os2.u16(0x0040);
  const codes = Object.keys(charToIndex).map(Number);
  os2.u16(codes.length ? Math.min(...codes) : 0);
  os2.u16(codes.length ? Math.max(...codes) : 0);
  os2.i16(m.ascender || 800); os2.i16(m.descender || -200); os2.i16(0);
  os2.u16(m.ascender || 800); os2.u16(Math.abs(m.descender || -200));
  os2.u32(1); os2.u32(0);
  os2.i16(m.xHeight || 500); os2.i16(m.capHeight || 700);
  os2.u16(0); os2.u16(32); os2.u16(0);
  while (os2.len() < 96) os2.u8(0);
  const os2Bytes = os2.result();

  // name — includes platform 1 (Mac Roman) + platform 3 (Windows Unicode) entries,
  // plus nameID 3 (Unique ID, required), 16 (Typographic Family), 17 (Typographic
  // Subfamily). Windows Font Viewer rejects fonts missing nameID 3 or Mac entries.
  const meta = project.metadata || {};
  const fam = meta.familyName || "New Font";
  const style = meta.style || "Regular";
  const psName = fam.replace(/\s+/g, "") + "-" + style;
  const nameMap = {
    0: meta.copyright || "",
    1: fam,
    2: style,
    3: `${fam} ${style};${meta.version || "1.000"};${meta.designer || "Donoso Ron"}`,
    4: `${fam} ${style}`,
    5: `Version ${meta.version || "1.000"}`,
    6: psName,
    9: meta.designer || "Donoso Ron",
    16: fam,
    17: style,
  };
  const plat1Ids = [1, 2, 4, 5, 6, 16, 17];
  const plat3Ids = [0, 1, 2, 3, 4, 5, 6, 9, 16, 17];
  const records = [];
  plat1Ids.forEach((id) => records.push({ plat: 1, enc: 0, lang: 0, id, s: nameMap[id] }));
  plat3Ids.forEach((id) => records.push({ plat: 3, enc: 1, lang: 0x0409, id, s: nameMap[id] }));
  const nameW = new BW();
  nameW.u16(0); nameW.u16(records.length);
  const storageOffset = 6 + records.length * 12;
  nameW.u16(storageOffset);
  let strOffset = 0;
  const storage = new BW();
  records.forEach((r) => {
    nameW.u16(r.plat); nameW.u16(r.enc); nameW.u16(r.lang); nameW.u16(r.id);
    if (r.plat === 3) {
      nameW.u16(r.s.length * 2); nameW.u16(strOffset);
      storage.str(r.s); strOffset += r.s.length * 2;
    } else {
      nameW.u16(r.s.length); nameW.u16(strOffset);
      for (let i = 0; i < r.s.length; i++) storage.u8(r.s.charCodeAt(i) & 0xff);
      strOffset += r.s.length;
    }
  });
  const nameBytes = new Uint8Array([...nameW.result(), ...storage.result()]);

  // cmap (format 4, platform 3 encoding 1)
  const sorted = Object.entries(charToIndex).map(([c, i]) => ({ code: Number(c), idx: i })).sort((a, b) => a.code - b.code);
  const segs = [];
  let cur = { start: null, end: null, idx: [] };
  sorted.forEach((e, i) => {
    if (cur.start === null) { cur = { start: e.code, end: e.code, idx: [e.idx] }; }
    else if (e.code === cur.end + 1) { cur.end = e.code; cur.idx.push(e.idx); }
    else { segs.push(cur); cur = { start: e.code, end: e.code, idx: [e.idx] }; }
    if (i === sorted.length - 1) segs.push(cur);
  });
  segs.push({ start: 0xFFFF, end: 0xFFFF, idx: [0] });
  const segCount = segs.length;
  const cmapSub = new BW();
  cmapSub.u16(4); cmapSub.u16(0); cmapSub.u16(0);
  cmapSub.u16(segCount * 2);
  const searchRange = 2 * Math.pow(2, Math.floor(Math.log2(segCount)));
  cmapSub.u16(searchRange); cmapSub.u16(Math.floor(Math.log2(segCount))); cmapSub.u16(segCount * 2 - searchRange);
  segs.forEach((sg) => cmapSub.u16(sg.end));
  cmapSub.u16(0); // reservedPad (must be 0, not 0xFFFF)
  segs.forEach((sg) => cmapSub.u16(sg.start));
  segs.forEach((sg) => {
    if (sg.start === 0xFFFF) cmapSub.i16(1);
    else if (sg.idx.length === 1) cmapSub.i16(sg.idx[0] - sg.start);
    else cmapSub.i16(0);
  });
  let gidByteOffset = 0;
  segs.forEach((sg, i) => {
    if (sg.start === 0xFFFF || sg.idx.length === 1) { cmapSub.u16(0); }
    else {
      cmapSub.u16(2 * segs.length + gidByteOffset - 2 * i);
      gidByteOffset += sg.idx.length * 2;
    }
  });
  segs.forEach((sg) => {
    if (sg.start !== 0xFFFF && sg.idx.length > 1) sg.idx.forEach((gi) => cmapSub.u16(gi));
  });
  const subLen = cmapSub.len();
  cmapSub.b[2] = (subLen >> 8) & 255; cmapSub.b[3] = subLen & 255;
  const cmapW = new BW();
  cmapW.u16(0); cmapW.u16(1);
  cmapW.u16(3); cmapW.u16(1); cmapW.u32(12);
  const cmapBytes = new Uint8Array([...cmapW.result(), ...cmapSub.result()]);

  // post (version 3.0)
  const post = new BW();
  post.u32(0x00030000); post.i32(0); post.i16(0); post.i16(0);
  post.u32(0); post.u32(0); post.u32(0); post.u32(0); post.u32(0);
  const postBytes = post.result();

  return [
    ["head", headBytes], ["hhea", hheaBytes], ["maxp", maxpBytes], ["OS/2", os2Bytes],
    ["hmtx", hmtxBytes], ["loca", locaBytes], ["glyf", glyfBytes], ["name", nameBytes],
    ["cmap", cmapBytes], ["post", postBytes],
  ];
}

export function encodeTTF(project) {
  const tables = buildTables(project);
  const numTables = tables.length;
  const sr = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
  const entrySel = Math.floor(Math.log2(numTables));
  const rangeShift = numTables * 16 - sr;

  const dir = new BW();
  dir.u32(0x00010000); dir.u16(numTables); dir.u16(sr); dir.u16(entrySel); dir.u16(rangeShift);
  let dataOffset = 12 + numTables * 16;
  const tableEntries = tables.map(([tag, bytes]) => {
    const tagCode = ((tag.charCodeAt(0) << 24) | (tag.charCodeAt(1) << 16) | (tag.charCodeAt(2) << 8) | tag.charCodeAt(3)) >>> 0;
    const entry = { tag, tagCode, offset: dataOffset, length: bytes.length, bytes };
    dataOffset += bytes.length;
    while (dataOffset % 4 !== 0) dataOffset++;
    return entry;
  });
  tableEntries.forEach((e) => {
    dir.u32(e.tagCode); dir.u32(checksum(e.bytes)); dir.u32(e.offset); dir.u32(e.length);
  });
  let font = [...dir.result()];
  tableEntries.forEach((e) => {
    font = font.concat([...e.bytes]);
    while (font.length % 4 !== 0) font.push(0);
  });
  const fontBytes = new Uint8Array(font);
  const totalChecksum = checksum(fontBytes);
  const adj = (0xB1B0AFBA - totalChecksum) >>> 0;
  // checksumAdjustment lives at offset 8 inside the 'head' table — NOT at file
  // offset 8 (the offset table's entrySelector/rangeShift). Writing it there
  // corrupts the directory; write it into head instead.
  const headOffset = tableEntries.find((e) => e.tag === "head").offset;
  fontBytes[headOffset + 8] = (adj >>> 24) & 255; fontBytes[headOffset + 9] = (adj >>> 16) & 255;
  fontBytes[headOffset + 10] = (adj >>> 8) & 255; fontBytes[headOffset + 11] = adj & 255;
  return fontBytes;
}

// Compress bytes with zlib (RFC 1950) via the browser-native CompressionStream.
// WOFF wraps each sfnt table in zlib-compressed form.
async function zlibCompress(data) {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// WOFF 1.0: a zlib-wrapped container around the same sfnt tables. Each table is
// compressed independently; tables that don't shrink are stored uncompressed.
export async function encodeWOFF(project) {
  const tables = buildTables(project);
  const numTables = tables.length;
  // totalSfntSize = offset table (12) + directory (numTables*16) + 4-byte-padded tables
  let totalSfntSize = 12 + numTables * 16;
  for (const [, bytes] of tables) {
    totalSfntSize += bytes.length;
    while (totalSfntSize % 4 !== 0) totalSfntSize++;
  }
  const entries = [];
  for (const [tag, bytes] of tables) {
    const comp = await zlibCompress(bytes);
    let compBytes = bytes, compLength = bytes.length;
    if (comp && comp.length < bytes.length) { compBytes = comp; compLength = comp.length; }
    entries.push({ tag, origLength: bytes.length, origChecksum: checksum(bytes), compBytes, compLength });
  }
  const headerSize = 44;
  let dataOffset = headerSize + numTables * 20;
  entries.forEach((e) => {
    e.offset = dataOffset;
    dataOffset += e.compLength;
    while (dataOffset % 4 !== 0) dataOffset++;
  });
  const totalLength = dataOffset;
  const w = new BW();
  w.u32(0x774F4646); // 'wOFF' signature
  w.u32(0x00010000); // flavor (TrueType sfnt version)
  w.u32(totalLength);
  w.u16(numTables);
  w.u16(0); // reserved
  w.u32(totalSfntSize);
  w.u16(1); w.u16(0); // major/minor version
  w.u32(0); w.u32(0); w.u32(0); // meta offset/length/origLength
  w.u32(0); w.u32(0); // private offset/length
  entries.forEach((e) => {
    const tagCode = ((e.tag.charCodeAt(0) << 24) | (e.tag.charCodeAt(1) << 16) | (e.tag.charCodeAt(2) << 8) | e.tag.charCodeAt(3)) >>> 0;
    w.u32(tagCode); w.u32(e.offset); w.u32(e.compLength); w.u32(e.origLength); w.u32(e.origChecksum);
  });
  let out = [...w.result()];
  entries.forEach((e) => {
    out = out.concat([...e.compBytes]);
    while (out.length % 4 !== 0) out.push(0);
  });
  return new Uint8Array(out);
}

// WOFF 2.0: delegates to Google's woff2 encoder (via wawoff2 WebAssembly build),
// which performs Brotli compression and the glyf/loca table transform. The input
// is a complete TTF; the output is a ready-to-serve .woff2 file.
export async function encodeWOFF2(project) {
  const ttfBytes = encodeTTF(project);
  return await wawoff.compress(ttfBytes);
}