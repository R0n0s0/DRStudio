import React, { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, ChevronRight, ChevronDown, Spline, Target, Menu } from "lucide-react";
import {
  ACCENT_PALETTE, createLayer, ensureLayers, findNode, removeNode, addNode,
  moveNode, toggleNodeProp, updateNode, getSubtreeContourIds, syncFromLayers,
  remapSelection, reconcileLayers, flattenLayers,
  duplicateLayerNode, collectInNewLayer, releaseToLayers, mergeLayers, flattenArtwork,
  toggleClipMask, lockOthers, hideOthers,
} from "@/font/layerModel";
import LayerOptionsMenu from "./LayerOptionsMenu";
import LayerOptionsModal from "./LayerOptionsModal";
import PanelOptionsModal from "./PanelOptionsModal";

let _colorIdx = 0;
function nextAccent() {
  const c = ACCENT_PALETTE[_colorIdx % ACCENT_PALETTE.length];
  _colorIdx++;
  return c;
}

export default function LayersPanel({ glyph, onGlyph, selContours, onSelectContours, workspaceMode = "font" }) {
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [layerModal, setLayerModal] = useState(null);
  const [panelModal, setPanelModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [rowSize, setRowSize] = useState(() => localStorage.getItem("drstudio.layerRowSize") || "medium");
  const [showLayersOnly, setShowLayersOnly] = useState(() => localStorage.getItem("drstudio.layerShowOnly") === "true");
  const rowH = rowSize === "small" ? 20 : rowSize === "large" ? 48 : 32;

  // Ensure glyph has a layer tree; reconcile orphan contours.
  useEffect(() => {
    if (!glyph) return;
    let g = ensureLayers(glyph);
    let changed = g !== glyph;
    if (!changed) {
      const reconciled = reconcileLayers(glyph, activeLayerId);
      if (reconciled) { g = reconciled; changed = true; }
    }
    if (changed) onGlyph(g);
    if (!activeLayerId && g.layers?.length) setActiveLayerId(g.layers[0].id);
  }, [glyph]);

  const layers = glyph?.layers || [];
  const contours = glyph?.contours || [];

  // Apply layer tree changes: update layers + sync contours + remap selection.
  const applyLayers = useCallback((newLayers, newContours) => {
    const baseGlyph = newContours ? { ...glyph, contours: newContours } : glyph;
    const next = syncFromLayers({ ...baseGlyph, layers: newLayers });
    const newGlyph = { ...baseGlyph, layers: newLayers, contours: next.contours };
    onGlyph(newGlyph);
    if (next.selMap) {
      const remapped = remapSelection(selContours || [], next.selMap);
      if (remapped.length !== (selContours || []).length || remapped.some((v, i) => v !== selContours[i])) {
        onSelectContours(remapped);
      }
    }
  }, [glyph, onGlyph, selContours, onSelectContours]);

  const toggleVisible = (id) => applyLayers(toggleNodeProp(layers, id, "visible"));
  const toggleLocked = (id) => applyLayers(toggleNodeProp(layers, id, "locked"));
  const toggleExpanded = (id) => applyLayers(toggleNodeProp(layers, id, "expanded"));

  const newLayer = () => {
    const layer = createLayer(`Layer ${layers.length + 1}`, nextAccent());
    applyLayers([...layers, layer]);
    setActiveLayerId(layer.id);
  };

  const deleteNode = (id) => {
    const subtreeIds = getSubtreeContourIds(layers, id);
    const contourIdSet = new Set(subtreeIds);
    const remainingContours = contours.filter((c) => !contourIdSet.has(c.id));
    const newLayers = removeNode(layers, id);
    onGlyph({ ...glyph, layers: newLayers, contours: remainingContours });
    // Clear selection if any deleted contours were selected
    if (selContours?.length) {
      const stillValid = selContours.filter((i) => i < remainingContours.length);
      if (stillValid.length !== selContours.length) onSelectContours(stillValid);
    }
    if (activeLayerId === id) setActiveLayerId(newLayers[0]?.id || null);
  };

  // Select all contours in a layer subtree.
  const selectLayer = (nodeId) => {
    const subtreeIds = getSubtreeContourIds(layers, nodeId);
    const indices = [];
    contours.forEach((c, i) => { if (subtreeIds.includes(c.id)) indices.push(i); });
    onSelectContours(indices);
  };

  // Check if any contour in this subtree is selected.
  const hasSelection = (nodeId) => {
    const subtreeIds = new Set(getSubtreeContourIds(layers, nodeId));
    return (selContours || []).some((i) => contours[i] && subtreeIds.has(contours[i].id));
  };

  // --- Menu operations ---
  const selectedTopLevelIds = (() => {
    const ids = new Set();
    const flat = flattenLayers(layers);
    for (const idx of selContours || []) {
      const c = contours[idx];
      if (!c) continue;
      const entry = flat.find((f) => f.contourId === c.id);
      if (entry && entry.path[0]) ids.add(entry.path[0].id);
    }
    return [...ids];
  })();

  const activeLayer = activeLayerId ? findNode(layers, activeLayerId)?.node : null;
  const activeChildren = activeLayer?.children || [];
  const hasClipMask = activeChildren.some((c) => c.clipMask);

  const handleNewLayerModal = (mode) => {
    const isSub = mode === "newSublayer";
    const subCount = (activeLayer?.children || []).filter((c) => c.type === "layer").length;
    setLayerModal({
      mode,
      initial: {
        name: isSub ? `Sublayer ${subCount + 1}` : `Layer ${layers.length + 1}`,
        accentColor: nextAccent(),
        locked: false,
        hidden: false,
        isTemplate: false,
        opacity: 1,
      },
      onConfirm: (vals) => {
        const layer = createLayer(vals.name, vals.accentColor);
        layer.locked = vals.locked;
        layer.visible = !vals.hidden;
        layer.isTemplate = vals.isTemplate;
        layer.opacity = vals.opacity ?? 1;
        if (isSub && activeLayerId) {
          applyLayers(addNode(layers, layer, activeLayerId, -1));
        } else {
          applyLayers([...layers, layer]);
        }
        setActiveLayerId(layer.id);
        setLayerModal(null);
      },
    });
  };

  const handleDuplicate = () => {
    if (!activeLayerId) return;
    const result = duplicateLayerNode(glyph, activeLayerId);
    if (result) applyLayers(result.layers, result.contours);
  };

  const handleCollect = () => {
    if (!selectedTopLevelIds.length) return;
    applyLayers(collectInNewLayer(layers, selectedTopLevelIds, "New Layer", nextAccent()));
  };

  const handleRelease = () => {
    if (!activeLayerId) return;
    applyLayers(releaseToLayers(layers, activeLayerId));
  };

  const handleMerge = () => {
    if (selectedTopLevelIds.length < 2) return;
    applyLayers(mergeLayers(layers, selectedTopLevelIds, "Merged Layer", nextAccent()));
  };

  const handleFlatten = () => {
    applyLayers(flattenArtwork(layers, "Layer 1", ACCENT_PALETTE[0]));
  };

  const handleToggleClipMask = () => {
    if (!activeLayerId) return;
    applyLayers(toggleClipMask(layers, activeLayerId));
  };

  const handleToggleTemplate = () => {
    if (!activeLayerId || !activeLayer) return;
    applyLayers(updateNode(layers, activeLayerId, { isTemplate: !activeLayer.isTemplate }));
  };

  const handleLockOthers = () => {
    if (!activeLayerId) return;
    applyLayers(lockOthers(layers, activeLayerId));
  };

  const handleHideOthers = () => {
    if (!activeLayerId) return;
    applyLayers(hideOthers(layers, activeLayerId));
  };

  const handleDeleteActive = () => {
    if (!activeLayerId) return;
    deleteNode(activeLayerId);
  };

  const menuActions = {
    newLayer: () => handleNewLayerModal("new"),
    newSublayer: () => handleNewLayerModal("newSublayer"),
    duplicateLayer: handleDuplicate,
    deleteLayer: handleDeleteActive,
    collectInNewLayer: handleCollect,
    releaseToLayers: handleRelease,
    mergeLayers: handleMerge,
    flattenArtwork: handleFlatten,
    toggleClipMask: handleToggleClipMask,
    toggleTemplate: handleToggleTemplate,
    lockOthers: handleLockOthers,
    hideOthers: handleHideOthers,
    panelOptions: () => setPanelModal(true),
    hasActive: !!activeLayer,
    hasSelection: (selContours || []).length > 0,
    canMerge: selectedTopLevelIds.length >= 2,
    canFlatten: layers.length >= 2,
    canClipMask: activeChildren.some((c) => c.type === "path"),
    hasClipMask,
    targetName: activeLayer?.name || "Layer",
  };

  // --- Drag and drop ---
  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (e, id, isContainer) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ id, isContainer });
  };
  const onDrop = (e, targetId, isContainer) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropTarget(null);
    if (!sourceId || sourceId === targetId) return;
    // Can't drop a parent into its own child
    const found = findNode(layers, sourceId);
    if (found && getSubtreeContourIds(layers, sourceId).length > 0) {
      // Check target is not a descendant of source
      let walk = findNode(layers, targetId);
      while (walk) {
        if (walk.node.id === sourceId) return;
        walk = walk.parent ? findNode(layers, walk.parent.id) : null;
      }
    }
    if (isContainer) {
      // Drop inside a layer/group
      applyLayers(moveNode(layers, sourceId, targetId, -1));
    } else {
      // Drop before the target (reorder sibling)
      const targetFound = findNode(layers, targetId);
      const parent = targetFound?.parent;
      const parentId = parent?.id || null;
      const siblings = parent?.children || layers;
      const targetIndex = siblings.findIndex((s) => s.id === targetId);
      applyLayers(moveNode(layers, sourceId, parentId, targetIndex));
    }
  };
  const onDragEnd = () => { setDragId(null); setDropTarget(null); };

  const openProps = (node) => {
    setLayerModal({
      mode: "properties",
      initial: {
        name: node.name,
        accentColor: node.accentColor,
        opacity: node.opacity ?? 1,
        locked: node.locked,
        hidden: !node.visible,
        isTemplate: node.isTemplate,
      },
      onConfirm: (vals) => {
        applyLayers(updateNode(layers, node.id, {
          name: vals.name,
          accentColor: vals.accentColor,
          opacity: vals.opacity,
          locked: vals.locked,
          visible: !vals.hidden,
          isTemplate: vals.isTemplate,
        }));
        setLayerModal(null);
      },
    });
  };

  const renderNode = (node, depth) => {
    const isPath = node.type === "path";
    const isSelected = hasSelection(node.id);
    const isActive = activeLayerId === node.id;
    const isDropTarget = dropTarget?.id === node.id;
    const contour = isPath && node.contourId ? contours.find((c) => c.id === node.contourId) : null;
    const childCount = node.children?.length || 0;
    const visibleChildCount = showLayersOnly ? (node.children || []).filter((c) => c.type !== "path").length : childCount;

    return (
      <div key={node.id}>
        <div
          draggable={!isPath || contour}
          onDragStart={(e) => onDragStart(e, node.id)}
          onDragOver={(e) => onDragOver(e, node.id, !isPath)}
          onDrop={(e) => onDrop(e, node.id, !isPath)}
          onDragEnd={onDragEnd}
          onClick={() => { selectLayer(node.id); if (!isPath) setActiveLayerId(node.id); }}
          className={`group flex items-center gap-1 rounded cursor-pointer border ${
            isActive ? "bg-violet-600/15 border-violet-500/40" : "border-transparent hover:bg-white/5"
          } ${isDropTarget && dropTarget.isContainer ? "ring-1 ring-violet-400" : ""} ${dragId === node.id ? "opacity-40" : ""}`}
          style={{ height: rowH, paddingLeft: depth * 14 + 4, paddingRight: 4 }}
        >
          {/* Expand/collapse */}
          {visibleChildCount > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); toggleExpanded(node.id); }} className="text-white/40 hover:text-white w-4 flex-shrink-0">
              {node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}

          {/* Visibility */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleVisible(node.id); }}
            className={`flex-shrink-0 ${node.visible ? "text-white/60 hover:text-white" : "text-white/25"}`}
            title={node.visible ? "Hide" : "Show"}
          >
            {node.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>

          {/* Lock */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleLocked(node.id); }}
            className={`flex-shrink-0 ${node.locked ? "text-amber-400" : "text-white/30 hover:text-white/60"}`}
            title={node.locked ? "Unlock" : "Lock"}
          >
            {node.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>

          {/* Color swatch / icon */}
          {isPath ? (
            <Spline size={12} className="flex-shrink-0" style={{ color: node.accentColor }} />
          ) : (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); openProps(node); }}
              className="w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-white/20"
              style={{ backgroundColor: node.accentColor }}
              title="Double-click for properties"
            />
          )}

          {/* Name */}
          <span className="text-[11px] text-white/80 flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); openProps(node); }}>
            {node.isTemplate && <span className="text-white/40 mr-1">TPL</span>}
            {isPath ? (contour?.compound ? `Compound (${contour.compound.members.length})` : node.name) : node.name}
          </span>

          {/* Point count for paths */}
          {isPath && contour && (
            <span className="text-[9px] text-white/30 flex-shrink-0">{contour.points.length}p</span>
          )}

          {/* Selection target ring */}
          <button
            onClick={(e) => { e.stopPropagation(); selectLayer(node.id); }}
            className={`flex-shrink-0 w-4 grid place-items-center ${isSelected ? "text-violet-400" : "text-white/20 hover:text-white/50"}`}
            title="Select all in layer"
          >
            {isSelected ? <Target size={11} fill="currentColor" /> : <Target size={11} />}
          </button>

          {/* Delete on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
            className="flex-shrink-0 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>

        {/* Drop zone before children */}
        {isDropTarget && !dropTarget.isContainer && (
          <div className="h-0.5 bg-violet-400 mx-1 rounded" style={{ marginLeft: depth * 14 + 4 }} />
        )}

        {/* Children */}
        {node.expanded && visibleChildCount > 0 && (
          <div>
            {node.children.map((child) => {
              if (showLayersOnly && child.type === "path") return null;
              return renderNode(child, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-2 space-y-0.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 px-1 relative">
        <div className="text-[11px] uppercase tracking-wider text-white/40 font-medium">Layers</div>
        <div className="flex items-center gap-0.5">
          <button onClick={newLayer} title="New Layer" className="w-6 h-6 grid place-items-center rounded text-white/60 hover:text-white hover:bg-white/10">
            <Plus size={14} />
          </button>
          <button onClick={() => setMenuOpen((v) => !v)} title="Layer Panel Options"
            className={`w-6 h-6 grid place-items-center rounded ${menuOpen ? "text-violet-400 bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
            <Menu size={14} />
          </button>
        </div>
        <LayerOptionsMenu open={menuOpen} onClose={() => setMenuOpen(false)} actions={menuActions} />
      </div>

      {/* Tree */}
      <div className="space-y-0.5">
        {layers.length === 0 && (
          <p className="text-[11px] text-white/30 px-1 leading-relaxed">
            No layers yet. Click + to create one, or draw paths to auto-create a layer.
          </p>
        )}
        {layers.map((node) => renderNode(node, 0))}
      </div>

      {/* Layer options modal (New Layer / New Sublayer / Properties) */}
      {layerModal && (
        <LayerOptionsModal
          mode={layerModal.mode}
          initial={layerModal.initial}
          onConfirm={layerModal.onConfirm}
          onCancel={() => setLayerModal(null)}
        />
      )}
      {/* Panel options modal */}
      {panelModal && (
        <PanelOptionsModal
          rowSize={rowSize}
          showLayersOnly={showLayersOnly}
          onConfirm={({ rowSize: rs, showLayersOnly: slo }) => {
            setRowSize(rs);
            setShowLayersOnly(slo);
            localStorage.setItem("drstudio.layerRowSize", rs);
            localStorage.setItem("drstudio.layerShowOnly", String(slo));
            setPanelModal(false);
          }}
          onCancel={() => setPanelModal(false)}
        />
      )}
    </div>
  );
}