/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * Undo/redo history store wrapping GraphStore mutations.
 */

import type { NodeData, EdgeData } from '../types/index.js';
import type { GraphStore } from './GraphStore.js';

const MAX_HISTORY = 50;

export interface HistoryEntry {
  type: 'updateNode' | 'softDeleteNode' | 'restoreNode' | 'addEdge' | 'removeEdge';
  targetId: string;
  before: Partial<NodeData> | Partial<EdgeData> | null;
  after: Partial<NodeData> | Partial<EdgeData> | null;
}

function applyEntry(entry: HistoryEntry, data: Partial<NodeData> | Partial<EdgeData> | null, graph: GraphStore): void {
  switch (entry.type) {
    case 'updateNode':
      if (!data) return;
      graph.updateNode(entry.targetId, data as Partial<NodeData>);
      break;
    case 'softDeleteNode':
      if (!data) return;
      if ((data as Partial<NodeData>).isDeleted === false) {
        graph.restoreNode(entry.targetId);
      } else {
        graph.softDeleteNode(entry.targetId);
      }
      break;
    case 'restoreNode':
      if (!data) return;
      if ((data as Partial<NodeData>).isDeleted === true) {
        graph.softDeleteNode(entry.targetId);
      } else {
        graph.restoreNode(entry.targetId);
      }
      break;
    case 'addEdge':
      if (data === null) {
        graph.removeEdge(entry.targetId);
      } else {
        graph.addEdge(data as EdgeData);
      }
      break;
    case 'removeEdge':
      if (data !== null) {
        graph.addEdge(data as EdgeData);
      } else {
        graph.removeEdge(entry.targetId);
      }
      break;
  }
}

export class HistoryStore {
  private _undoStack: HistoryEntry[] = [];
  private _redoStack: HistoryEntry[] = [];

  constructor(private graphStore: GraphStore) {}

  get canUndo(): boolean { return this._undoStack.length > 0; }
  get canRedo(): boolean { return this._redoStack.length > 0; }
  get undoStack(): readonly HistoryEntry[] { return this._undoStack; }
  get redoStack(): readonly HistoryEntry[] { return this._redoStack; }

  pushAction(entry: HistoryEntry): void {
    this._undoStack = [...this._undoStack.slice(-(MAX_HISTORY - 1)), entry];
    this._redoStack = []; // New action clears redo stack
  }

  undo(): void {
    if (this._undoStack.length === 0) return;

    const entry = this._undoStack[this._undoStack.length - 1]!;
    applyEntry(entry, entry.before, this.graphStore);

    this._undoStack = this._undoStack.slice(0, -1);
    this._redoStack = [...this._redoStack, entry];
  }

  redo(): void {
    if (this._redoStack.length === 0) return;

    const entry = this._redoStack[this._redoStack.length - 1]!;
    applyEntry(entry, entry.after, this.graphStore);

    this._redoStack = this._redoStack.slice(0, -1);
    this._undoStack = [...this._undoStack, entry];
  }

  clear(): void {
    this._undoStack = [];
    this._redoStack = [];
  }
}
