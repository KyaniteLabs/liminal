/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * GraphStore — in-memory graph store with dual Map+Array structure.
 * Ported from useGraphStore.ts (Zustand) to a plain TypeScript class
 * for CLI/server usage without React or browser dependencies.
 *
 * Data structure rationale:
 *   Map  → O(1) lookup by ID
 *   Array → efficient iteration (for-each, map, filter)
 *   IndexMap → O(1) array position lookup for mutations
 */

import type { NodeData, EdgeData } from '../types/index.js';

// ── View mode (local definition) ──

export type ViewMode = 'sphere' | 'radial' | 'interior';

// ── Default extraction config ──

const DEFAULT_EXTRACTION_CONFIG = {
  maxDepth: 3,
  maxNodes: 15,
  branchingFactor: 3,
} as const;

// ── Rebuilt array result ──

interface RebuiltArrays<T> {
  array: T[];
  indexMap: Map<string, number>;
}

// ── GraphStore ──

export class GraphStore {
  // ── Dual-structure state (nodes) ──
  private _nodes: Map<string, NodeData> = new Map();
  private _nodeArray: NodeData[] = [];
  private _nodeIndexMap: Map<string, number> = new Map();

  // ── Dual-structure state (edges) ──
  private _edges: Map<string, EdgeData> = new Map();
  private _edgeArray: EdgeData[] = [];
  private _edgeIndexMap: Map<string, number> = new Map();

  // ── View / interaction state ──
  private _mode: ViewMode = 'sphere';
  private _selectedNodeId: string | null = null;
  private _hoveredNodeId: string | null = null;
  private _sphereRadius = 3;
  private _showLabels = true;
  private _gestureEnabled = false;

  // ── Prompt state ──
  private _originalPrompt = '';
  private _synthesizedPrompt = '';
  private _response = '';
  private _isProcessing = false;

  // ── Extraction config ──
  private _extractionConfig = { ...DEFAULT_EXTRACTION_CONFIG };

  // ── Change listeners ──
  private _listeners: Set<() => void> = new Set();

  // ── Getters ──

  get mode(): ViewMode { return this._mode; }
  get nodes(): ReadonlyMap<string, NodeData> { return this._nodes; }
  get nodeArray(): readonly NodeData[] { return this._nodeArray; }
  get edges(): ReadonlyMap<string, EdgeData> { return this._edges; }
  get edgeArray(): readonly EdgeData[] { return this._edgeArray; }
  get selectedNodeId(): string | null { return this._selectedNodeId; }
  get hoveredNodeId(): string | null { return this._hoveredNodeId; }
  get originalPrompt(): string { return this._originalPrompt; }
  get synthesizedPrompt(): string { return this._synthesizedPrompt; }
  get response(): string { return this._response; }
  get isProcessing(): boolean { return this._isProcessing; }
  get sphereRadius(): number { return this._sphereRadius; }
  get showLabels(): boolean { return this._showLabels; }
  get gestureEnabled(): boolean { return this._gestureEnabled; }
  get extractionConfig(): typeof DEFAULT_EXTRACTION_CONFIG { return this._extractionConfig; }

  // ── Event emitter ──

  /** Register a listener called after every state mutation. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener();
    }
  }

  // ── Node CRUD ──

  addNode(node: NodeData): void {
    if (this._nodes.has(node.id)) {
      // Update existing — merge into array slot
      const idx = this._nodeIndexMap.get(node.id);
      if (idx !== undefined) {
        this._nodes.set(node.id, node);
        this._nodeArray[idx] = node;
      }
    } else {
      this._nodes.set(node.id, node);
      this._nodeArray.push(node);
      this._nodeIndexMap.set(node.id, this._nodeArray.length - 1);
    }
    this._notify();
  }

  updateNode(id: string, partial: Partial<NodeData>): void {
    const existing = this._nodes.get(id);
    if (!existing) return;

    const updated = { ...existing, ...partial };
    this._nodes.set(id, updated);

    const idx = this._nodeIndexMap.get(id);
    if (idx !== undefined) {
      this._nodeArray[idx] = updated;
    }
    this._notify();
  }

  removeNode(id: string): void {
    if (!this._nodes.has(id)) return;

    // Cascade: hard-delete all edges connected to this node
    const edgesToRemove: string[] = [];
    for (const edge of this._edges.values()) {
      if (edge.sourceId === id || edge.targetId === id) {
        edgesToRemove.push(edge.id);
      }
    }
    for (const edgeId of edgesToRemove) {
      this._edges.delete(edgeId);
    }
    if (edgesToRemove.length > 0) {
      const rebuilt = this._rebuildArrays(this._edges);
      this._edgeArray = rebuilt.array;
      this._edgeIndexMap = rebuilt.indexMap;
    }

    // Remove the node itself
    this._nodes.delete(id);
    const rebuilt = this._rebuildArrays(this._nodes);
    this._nodeArray = rebuilt.array;
    this._nodeIndexMap = rebuilt.indexMap;

    this._notify();
  }

  softDeleteNode(id: string): void {
    const node = this._nodes.get(id);
    if (!node || node.isDeleted) return;

    this.updateNode(id, { isDeleted: true });

    // Cascade: soft-delete connected edges
    for (const edge of this._edges.values()) {
      if (!edge.isDeleted && (edge.sourceId === id || edge.targetId === id)) {
        this.updateEdge(edge.id, { isDeleted: true });
      }
    }
    // updateNode / updateEdge already call _notify
  }

  restoreNode(id: string): void {
    const node = this._nodes.get(id);
    if (!node || !node.isDeleted) return;

    this.updateNode(id, { isDeleted: false });

    // Restore edges that were soft-deleted because of this node
    for (const edge of this._edges.values()) {
      if (edge.isDeleted && (edge.sourceId === id || edge.targetId === id)) {
        // Only restore if the *other* endpoint is also alive
        const otherId = edge.sourceId === id ? edge.targetId : edge.sourceId;
        const other = this._nodes.get(otherId);
        if (other && !other.isDeleted) {
          this.updateEdge(edge.id, { isDeleted: false });
        }
      }
    }
  }

  // ── Edge CRUD ──

  addEdge(edge: EdgeData): void {
    if (this._edges.has(edge.id)) {
      const idx = this._edgeIndexMap.get(edge.id);
      if (idx !== undefined) {
        this._edges.set(edge.id, edge);
        this._edgeArray[idx] = edge;
      }
    } else {
      this._edges.set(edge.id, edge);
      this._edgeArray.push(edge);
      this._edgeIndexMap.set(edge.id, this._edgeArray.length - 1);
    }
    this._notify();
  }

  removeEdge(id: string): void {
    if (!this._edges.has(id)) return;
    this._edges.delete(id);
    const rebuilt = this._rebuildArrays(this._edges);
    this._edgeArray = rebuilt.array;
    this._edgeIndexMap = rebuilt.indexMap;
    this._notify();
  }

  // ── Bulk operations ──

  replaceGraph(nodes: NodeData[], edges: EdgeData[]): void {
    this._nodes.clear();
    this._edges.clear();

    for (const node of nodes) {
      this._nodes.set(node.id, node);
    }
    const rebuiltNodes = this._rebuildArrays(this._nodes);
    this._nodeArray = rebuiltNodes.array;
    this._nodeIndexMap = rebuiltNodes.indexMap;

    for (const edge of edges) {
      this._edges.set(edge.id, edge);
    }
    const rebuiltEdges = this._rebuildArrays(this._edges);
    this._edgeArray = rebuiltEdges.array;
    this._edgeIndexMap = rebuiltEdges.indexMap;

    this._notify();
  }

  appendNodes(nodes: NodeData[], edges: EdgeData[]): void {
    for (const node of nodes) {
      this.addNode(node);
    }
    for (const edge of edges) {
      this.addEdge(edge);
    }
    // addNode/addEdge already call _notify per item; one final notify is harmless
    this._notify();
  }

  // ── Simple setters ──

  setMode(mode: ViewMode): void {
    this._mode = mode;
    this._notify();
  }

  setSelectedNodeId(id: string | null): void {
    this._selectedNodeId = id;
    this._notify();
  }

  setHoveredNodeId(id: string | null): void {
    this._hoveredNodeId = id;
    this._notify();
  }

  setOriginalPrompt(p: string): void {
    this._originalPrompt = p;
    this._notify();
  }

  setSynthesizedPrompt(p: string): void {
    this._synthesizedPrompt = p;
    this._notify();
  }

  setResponse(r: string): void {
    this._response = r;
    this._notify();
  }

  setProcessing(v: boolean): void {
    this._isProcessing = v;
    this._notify();
  }

  setSphereRadius(r: number): void {
    this._sphereRadius = r;
    this._notify();
  }

  toggleLabels(): void {
    this._showLabels = !this._showLabels;
    this._notify();
  }

  setGestureEnabled(v: boolean): void {
    this._gestureEnabled = v;
    this._notify();
  }

  setExtractionConfig(config: Partial<typeof DEFAULT_EXTRACTION_CONFIG>): void {
    this._extractionConfig = { ...this._extractionConfig, ...config };
    this._notify();
  }

  // ── Reset ──

  clear(): void {
    this._nodes.clear();
    this._nodeArray = [];
    this._nodeIndexMap.clear();
    this._edges.clear();
    this._edgeArray = [];
    this._edgeIndexMap.clear();
    this._mode = 'sphere';
    this._selectedNodeId = null;
    this._hoveredNodeId = null;
    this._originalPrompt = '';
    this._synthesizedPrompt = '';
    this._response = '';
    this._isProcessing = false;
    this._sphereRadius = 3;
    this._showLabels = true;
    this._gestureEnabled = false;
    this._extractionConfig = { ...DEFAULT_EXTRACTION_CONFIG };
    this._notify();
  }

  // ── Private helpers ──

  /**
   * Rebuild the array and index map from a Map.
   * Used after deletions to keep array contiguous.
   */
  private _rebuildArrays<T extends { id: string }>(map: Map<string, T>): RebuiltArrays<T> {
    const array: T[] = [];
    const indexMap = new Map<string, number>();
    let i = 0;
    for (const item of map.values()) {
      array.push(item);
      indexMap.set(item.id, i);
      i++;
    }
    return { array, indexMap };
  }

  /**
   * Update an edge in-place. Unlike the public removeEdge (which deletes),
   * this patches fields and keeps the edge in the store.
   */
  private updateEdge(id: string, partial: Partial<EdgeData>): void {
    const existing = this._edges.get(id);
    if (!existing) return;

    const updated = { ...existing, ...partial };
    this._edges.set(id, updated);

    const idx = this._edgeIndexMap.get(id);
    if (idx !== undefined) {
      this._edgeArray[idx] = updated;
    }
  }
}
