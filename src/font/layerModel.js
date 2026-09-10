// Hierarchical Layer Engine for DR Studio.
// Model: Adobe Illustrator / Glyphs App layer system.
//
// The layer tree is an organizational overlay on top of the flat contours
// array. Each contour gets an `id` (UUID) linking it to a `path` leaf node
// in the tree. The tree controls:
//   - Z-order (flatten order = render order = contour array order)
//   - Visibility inheritance (parent hidden → all children hidden)
//   - Lock inheritance (parent locked → all children locked)
//   - Opacity inheritance (multiplied down the tree)
//   - Accent color (selection wireframe color from parent layer)
//   - Template mode (50% opacity, wireframe-only rendering)

export const ACCENT_PALETTE = [
  "#007AFF", "#FF2D55", "#34C759", "#FF9500", "#AF52DE",
  "#5AC8FA", "#FFCC00", "#FF3B30", "#5856D6", "#00C7BE",
];

let _idCounter = 0;
export function genId() {
  _idCounter++;
  return `ly${Date.now().toString(36)}${_idCounter.toString(36)}`;
}

export function createLayer(name, accentColor) {
  return {
    id: genId(),
    name: name || "Layer",
    type: "layer",
    visible: true,
    locked: false,
    expanded: true,
    accentColor: accentColor || ACCENT_PALETTE[0],
    opacity: 1,
    blendMode: "normal",
    isTemplate: false,
    children: [],
  };
}

export function createPathNode(contourId, accentColor) {
  return {
    id: genId(),
    name: "Path",
    type: "path",
    visible: true,
    locked: false,
    expanded: true,
    accentColor: accentColor || ACCENT_PALETTE[0],
    opacity: 1,
    blendMode: "normal",
    isTemplate: false,
    children: [],
    contourId: contourId || null,
  };
}

export function ensureContourIds(contours) {
  let changed = false;
  const result = (contours || []).map((c) => {
    if (c.id) return c;
    changed = true;
    return { ...c, id: genId() };
  });
  return changed ? result : (contours || []);
}

// Migrate a glyph that has no layer tree to the new system.
export function ensureLayers(glyph) {
  const contours = ensureContourIds(glyph.contours || []);
  const contoursChanged = contours !== glyph.contours;
  if (glyph.layers && glyph.layers.length) {
    return contoursChanged ? { ...glyph, contours } : glyph;
  }
  const layer = createLayer("Layer 1", ACCENT_PALETTE[0]);
  layer.children = contours.map((c) => createPathNode(c.id, ACCENT_PALETTE[0]));
  return { ...glyph, contours, layers: [layer] };
}

// Depth-first flatten: ordered list of { node, contourId, path: [ancestors] }
export function flattenLayers(layers, path = []) {
  const out = [];
  for (const node of layers || []) {
    const currentPath = [...path, node];
    if (node.type === "path" && node.contourId) {
      out.push({ node, contourId: node.contourId, path: currentPath });
    }
    if (node.children && node.children.length) {
      out.push(...flattenLayers(node.children, currentPath));
    }
  }
  return out;
}

export function findNode(layers, id, parent = null) {
  for (let i = 0; i < (layers || []).length; i++) {
    const node = layers[i];
    if (node.id === id) return { node, parent, index: i };
    if (node.children && node.children.length) {
      const found = findNode(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

export function removeNode(layers, id) {
  const out = [];
  for (const node of layers || []) {
    if (node.id === id) continue;
    if (node.children && node.children.length) {
      out.push({ ...node, children: removeNode(node.children, id) });
    } else {
      out.push(node);
    }
  }
  return out;
}

export function addNode(layers, node, parentId, index = -1) {
  if (parentId == null) {
    const arr = [...(layers || [])];
    if (index < 0 || index > arr.length) arr.push(node);
    else arr.splice(index, 0, node);
    return arr;
  }
  return (layers || []).map((n) => {
    if (n.id === parentId) {
      const children = [...(n.children || [])];
      if (index < 0 || index > children.length) children.push(node);
      else children.splice(index, 0, node);
      return { ...n, children };
    }
    if (n.children && n.children.length) {
      return { ...n, children: addNode(n.children, node, parentId, index) };
    }
    return n;
  });
}

export function moveNode(layers, nodeId, newParentId, newIndex) {
  const found = findNode(layers, nodeId);
  if (!found) return layers;
  const { node } = found;
  let removed = removeNode(layers, nodeId);
  return addNode(removed, node, newParentId, newIndex);
}

export function toggleNodeProp(layers, id, prop) {
  return (layers || []).map((n) => {
    if (n.id === id) return { ...n, [prop]: !n[prop] };
    if (n.children && n.children.length) {
      return { ...n, children: toggleNodeProp(n.children, id, prop) };
    }
    return n;
  });
}

export function updateNode(layers, id, patch) {
  return (layers || []).map((n) => {
    if (n.id === id) return { ...n, ...patch };
    if (n.children && n.children.length) {
      return { ...n, children: updateNode(n.children, id, patch) };
    }
    return n;
  });
}

// Compute inherited properties for a contourId.
export function getInheritedProps(layers, contourId) {
  const flat = flattenLayers(layers);
  const entry = flat.find((f) => f.contourId === contourId);
  if (!entry) return { visible: true, locked: false, opacity: 1, accentColor: "#007AFF", isTemplate: false };
  let visible = true, locked = false, opacity = 1, isTemplate = false;
  let accentColor = "#007AFF";
  for (const ancestor of entry.path) {
    if (!ancestor.visible) visible = false;
    if (ancestor.locked) locked = true;
    if (ancestor.opacity != null) opacity *= ancestor.opacity;
    if (ancestor.isTemplate) isTemplate = true;
    if (ancestor.type === "layer" && ancestor.accentColor) accentColor = ancestor.accentColor;
  }
  return { visible, locked, opacity, accentColor, isTemplate };
}

// Collect all contourIds that belong to a subtree rooted at nodeId.
export function getSubtreeContourIds(layers, nodeId) {
  const found = findNode(layers, nodeId);
  if (!found) return [];
  const ids = [];
  const collect = (node) => {
    if (node.contourId) ids.push(node.contourId);
    if (node.children) node.children.forEach(collect);
  };
  collect(found.node);
  return ids;
}

// Count path nodes in the tree.
function countPathNodes(layers) {
  let n = 0;
  for (const node of layers || []) {
    if (node.type === "path" && node.contourId) n++;
    if (node.children) n += countPathNodes(node.children);
  }
  return n;
}

// Remove path nodes whose contourId is not in the contourIdSet.
function pruneOrphanPathNodes(layers, contourIdSet) {
  return (layers || []).filter((n) => {
    if (n.type === "path" && n.contourId && !contourIdSet.has(n.contourId)) return false;
    return true;
  }).map((n) => {
    if (n.children && n.children.length) {
      return { ...n, children: pruneOrphanPathNodes(n.children, contourIdSet) };
    }
    return n;
  });
}

// Reconcile: assign IDs to contours, create path nodes for orphans, prune
// stale path nodes. Returns null if nothing changed.
export function reconcileLayers(glyph, activeLayerId) {
  const oldContours = glyph.contours || [];
  let contours = ensureContourIds(oldContours);
  let layers = glyph.layers;
  let changed = contours !== oldContours;

  if (!layers || !layers.length) {
    const layer = createLayer("Layer 1", ACCENT_PALETTE[0]);
    layer.children = contours.map((c) => createPathNode(c.id, ACCENT_PALETTE[0]));
    layers = [layer];
    changed = true;
  } else {
    const contourIdSet = new Set(contours.map((c) => c.id));
    const beforePrune = countPathNodes(layers);
    const pruned = pruneOrphanPathNodes(layers, contourIdSet);
    const afterPrune = countPathNodes(pruned);
    if (afterPrune !== beforePrune) { layers = pruned; changed = true; }

    // Find orphan contours (have ID but no path node)
    const existingIds = new Set();
    flattenLayers(layers).forEach((f) => existingIds.add(f.contourId));
    const orphans = contours.filter((c) => !existingIds.has(c.id));
    if (orphans.length) {
      layers = JSON.parse(JSON.stringify(layers));
      const targetId = activeLayerId && findNode(layers, activeLayerId) ? activeLayerId : (layers[0]?.id || null);
      const found = targetId ? findNode(layers, targetId) : null;
      if (found && (found.node.type === "layer" || found.node.type === "group")) {
        const accent = found.node.accentColor || ACCENT_PALETTE[0];
        found.node.children = [...(found.node.children || []), ...orphans.map((c) => createPathNode(c.id, accent))];
      } else if (layers[0]) {
        const accent = layers[0].accentColor || ACCENT_PALETTE[0];
        layers[0].children = [...(layers[0].children || []), ...orphans.map((c) => createPathNode(c.id, accent))];
      }
      changed = true;
    }
  }

  if (!changed) return null;
  return { ...glyph, contours, layers };
}

// Sync contour array from layer tree: reorder to match tree flatten order,
// propagate visibility/lock/accent to each contour.
// Returns { contours, selMap } where selMap maps old index → new index.
export function syncFromLayers(glyph) {
  if (!glyph.layers || !glyph.layers.length) {
    return { contours: glyph.contours, selMap: null };
  }
  const contourMap = new Map();
  (glyph.contours || []).forEach((c, i) => contourMap.set(c.id, { contour: c, oldIndex: i }));
  const flat = flattenLayers(glyph.layers);
  const newContours = [];
  const selMap = {};
  const usedIds = new Set();

  flat.forEach((entry, newIdx) => {
    const found = contourMap.get(entry.contourId);
    if (!found) return;
    usedIds.add(entry.contourId);
    const props = getInheritedProps(glyph.layers, entry.contourId);
    newContours.push({
      ...found.contour,
      hidden: !props.visible,
      locked: props.locked,
      _layerAccent: props.accentColor,
      _isTemplate: props.isTemplate,
    });
    selMap[found.oldIndex] = newIdx;
  });

  // Append orphan contours (not in tree) at the end
  for (const [, { contour, oldIndex }] of contourMap) {
    if (usedIds.has(contour.id)) continue;
    newContours.push(contour);
    selMap[oldIndex] = newContours.length - 1;
  }

  return { contours: newContours, selMap };
}

// Remap selContours using selMap.
export function remapSelection(selContours, selMap) {
  if (!selMap || !selContours) return selContours;
  return selContours.map((i) => (selMap[i] != null ? selMap[i] : -1)).filter((i) => i >= 0);
}

// --- Layer Panel Menu Operations ---

// Deep clone a node subtree with new IDs.
function cloneSubtree(node, contourIdMap) {
  const newNode = { ...node, id: genId(), expanded: true };
  if (node.type === "path" && node.contourId && contourIdMap.has(node.contourId)) {
    newNode.contourId = contourIdMap.get(node.contourId);
  }
  newNode.children = (node.children || []).map((c) => cloneSubtree(c, contourIdMap));
  return newNode;
}

// Duplicate a layer and its subtree. Returns { layers, contours } or null.
export function duplicateLayerNode(glyph, id) {
  const found = findNode(glyph.layers, id);
  if (!found) return null;
  const subtreeIds = getSubtreeContourIds(glyph.layers, id);
  const contourIdMap = new Map();
  const clonedContours = [];
  for (const cid of subtreeIds) {
    const orig = (glyph.contours || []).find((c) => c.id === cid);
    if (orig) {
      const newId = genId();
      contourIdMap.set(cid, newId);
      clonedContours.push({ ...JSON.parse(JSON.stringify(orig)), id: newId });
    }
  }
  const clonedNode = cloneSubtree(found.node, contourIdMap);
  const newLayers = addNode(glyph.layers, clonedNode, found.parent?.id || null, found.index);
  const newContours = [...(glyph.contours || []), ...clonedContours];
  return { layers: newLayers, contours: newContours };
}

// Wrap selected top-level nodes in a new parent layer.
export function collectInNewLayer(layers, nodeIds, name, accent) {
  if (!nodeIds || !nodeIds.length) return layers;
  const parent = createLayer(name || "New Layer", accent || ACCENT_PALETTE[0]);
  const wrapSet = new Set(nodeIds);
  const nodesToWrap = [];
  let insertIndex = Infinity;
  (layers || []).forEach((n, i) => {
    if (wrapSet.has(n.id)) { nodesToWrap.push(n); insertIndex = Math.min(insertIndex, i); }
  });
  if (!nodesToWrap.length) return layers;
  parent.children = nodesToWrap;
  const remaining = (layers || []).filter((n) => !wrapSet.has(n.id));
  const arr = [...remaining];
  if (insertIndex > arr.length) arr.push(parent);
  else arr.splice(insertIndex, 0, parent);
  return arr;
}

// Unpack children of a layer/group into independent top-level layers.
export function releaseToLayers(layers, id) {
  const found = findNode(layers, id);
  if (!found) return layers;
  const children = found.node.children || [];
  if (!children.length) return layers;
  const released = children.map((child) => {
    if (child.type === "layer" || child.type === "group") return child;
    const layer = createLayer(child.name || "Layer", child.accentColor);
    layer.children = [child];
    return layer;
  });
  if (!found.parent) {
    const arr = [...layers];
    arr.splice(found.index, 1, ...released);
    return arr;
  }
  const withoutNode = removeNode(layers, id);
  return [...withoutNode, ...released];
}

// Merge 2+ top-level layers into one consolidated layer.
export function mergeLayers(layers, ids, name, accent) {
  if (!ids || ids.length < 2) return layers;
  const merged = createLayer(name || "Merged Layer", accent || ACCENT_PALETTE[0]);
  const mergeSet = new Set(ids);
  let insertIndex = Infinity;
  (layers || []).forEach((n, i) => {
    if (mergeSet.has(n.id)) {
      insertIndex = Math.min(insertIndex, i);
      merged.children = [...(merged.children || []), ...(n.children || [])];
    }
  });
  if (insertIndex === Infinity) return layers;
  const remaining = (layers || []).filter((n) => !mergeSet.has(n.id));
  const arr = [...remaining];
  arr.splice(insertIndex, 0, merged);
  return arr;
}

// Flatten all layers into a single root layer, preserving Z-order.
export function flattenArtwork(layers, name, accent) {
  const root = createLayer(name || "Layer 1", accent || ACCENT_PALETTE[0]);
  const collectPaths = (nodes) => {
    for (const n of nodes || []) {
      if (n.type === "path" && n.contourId) root.children.push(n);
      if (n.children && n.children.length) collectPaths(n.children);
    }
  };
  collectPaths(layers);
  return [root];
}

// Toggle clipping mask on the top-most path in a layer.
export function toggleClipMask(layers, layerId) {
  const found = findNode(layers, layerId);
  if (!found) return layers;
  const children = found.node.children || [];
  const topPathIdx = children.findIndex((c) => c.type === "path");
  if (topPathIdx < 0) return layers;
  const hasMask = !!children[topPathIdx].clipMask;
  const newChildren = children.map((c, i) => ({ ...c, clipMask: i === topPathIdx ? !hasMask : false }));
  return (layers || []).map((n) => {
    if (n.id === layerId) return { ...n, children: newChildren };
    if (n.children && n.children.length) return { ...n, children: toggleClipMask(n.children, layerId) };
    return n;
  });
}

// Lock all top-level layers except the one with the given id.
export function lockOthers(layers, id) {
  return (layers || []).map((n) => ({ ...n, locked: n.id !== id }));
}

// Hide all top-level layers except the one with the given id.
export function hideOthers(layers, id) {
  return (layers || []).map((n) => ({ ...n, visible: n.id === id }));
}