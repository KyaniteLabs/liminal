import { describe, it, expect, vi } from 'vitest';
import { HistoryStore } from '../../../src/nodeprompt/store/HistoryStore.js';
import type { HistoryEntry } from '../../../src/nodeprompt/store/HistoryStore.js';
import { GraphStore } from '../../../src/nodeprompt/store/GraphStore.js';
import type { NodeData, EdgeData } from '../../../src/nodeprompt/types/index.js';
import { createNodeData } from '../../../src/nodeprompt/types/index.js';

// ── Test fixtures ──

function makeNode(id: string): NodeData {
  return createNodeData({ id, label: id, type: 'concept' });
}

function makeEdge(id: string, sourceId: string, targetId: string): EdgeData {
  return {
    id,
    sourceId,
    targetId,
    relation: 'causal',
    strength: 0.5,
    isUserCreated: false,
    isDeleted: false,
    isHierarchical: false,
    extractionPass: 0,
  };
}

function setup(): { graph: GraphStore; history: HistoryStore } {
  const graph = new GraphStore();
  const history = new HistoryStore(graph);
  return { graph, history };
}

// ── Construction & initial state ──

describe('HistoryStore', () => {
  it('starts with empty undo/redo stacks', () => {
    const { history } = setup();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoStack).toEqual([]);
    expect(history.redoStack).toEqual([]);
  });

  // ── pushAction ──

  describe('pushAction', () => {
    it('enables undo after pushing an entry', () => {
      const { history } = setup();
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: { label: 'Old' },
        after: { label: 'New' },
      });
      expect(history.canUndo).toBe(true);
      expect(history.undoStack).toHaveLength(1);
    });

    it('clears the redo stack on new action', () => {
      const { history } = setup();
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: null,
        after: { label: 'A' },
      });
      // Undo to fill redo stack
      history.undo();
      expect(history.canRedo).toBe(true);
      // Push new action → redo clears
      history.pushAction({
        type: 'updateNode',
        targetId: 'n2',
        before: null,
        after: { label: 'B' },
      });
      expect(history.canRedo).toBe(false);
    });
  });

  // ── undo ──

  describe('undo', () => {
    it('reverts an updateNode action', () => {
      const { graph, history } = setup();
      graph.addNode(makeNode('n1'));
      // Simulate: user updated n1 label from 'n1' to 'Updated'
      graph.updateNode('n1', { label: 'Updated' });
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: { label: 'n1' },
        after: { label: 'Updated' },
      });

      history.undo();
      expect(graph.nodes.get('n1')!.label).toBe('n1');
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(true);
    });

    it('reverts a softDeleteNode action', () => {
      const { graph, history } = setup();
      graph.addNode(makeNode('n1'));
      graph.softDeleteNode('n1');
      history.pushAction({
        type: 'softDeleteNode',
        targetId: 'n1',
        before: { isDeleted: false } as Partial<NodeData>,
        after: { isDeleted: true } as Partial<NodeData>,
      });

      history.undo();
      expect(graph.nodes.get('n1')!.isDeleted).toBe(false);
    });

    it('reverts a restoreNode action', () => {
      const { graph, history } = setup();
      graph.addNode(makeNode('n1'));
      graph.softDeleteNode('n1');
      graph.restoreNode('n1');
      history.pushAction({
        type: 'restoreNode',
        targetId: 'n1',
        before: { isDeleted: true } as Partial<NodeData>,
        after: { isDeleted: false } as Partial<NodeData>,
      });

      history.undo();
      expect(graph.nodes.get('n1')!.isDeleted).toBe(true);
    });

    it('reverts an addEdge action by removing it', () => {
      const { graph, history } = setup();
      const edge = makeEdge('e1', 'n1', 'n2');
      graph.addNode(makeNode('n1'));
      graph.addNode(makeNode('n2'));
      graph.addEdge(edge);
      history.pushAction({
        type: 'addEdge',
        targetId: 'e1',
        before: null,
        after: edge,
      });

      history.undo();
      expect(graph.edges.has('e1')).toBe(false);
    });

    it('reverts a removeEdge action by re-adding it', () => {
      const { graph, history } = setup();
      const edge = makeEdge('e1', 'n1', 'n2');
      graph.addNode(makeNode('n1'));
      graph.addNode(makeNode('n2'));
      graph.addEdge(edge);
      graph.removeEdge('e1');
      history.pushAction({
        type: 'removeEdge',
        targetId: 'e1',
        before: edge,
        after: null,
      });

      history.undo();
      expect(graph.edges.get('e1')).toEqual(edge);
    });

    it('is a no-op when undo stack is empty', () => {
      const { history } = setup();
      history.undo(); // should not throw
      expect(history.canUndo).toBe(false);
    });
  });

  // ── redo ──

  describe('redo', () => {
    it('re-applies an undone updateNode action', () => {
      const { graph, history } = setup();
      graph.addNode(makeNode('n1'));
      graph.updateNode('n1', { label: 'Updated' });
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: { label: 'n1' },
        after: { label: 'Updated' },
      });

      history.undo();
      expect(graph.nodes.get('n1')!.label).toBe('n1');

      history.redo();
      expect(graph.nodes.get('n1')!.label).toBe('Updated');
      expect(history.canRedo).toBe(false);
      expect(history.canUndo).toBe(true);
    });

    it('is a no-op when redo stack is empty', () => {
      const { history } = setup();
      history.redo(); // should not throw
      expect(history.canRedo).toBe(false);
    });
  });

  // ── undo → redo round-trip ──

  describe('undo/redo round-trip', () => {
    it('preserves state through multiple undo/redo cycles', () => {
      const { graph, history } = setup();
      graph.addNode(makeNode('n1'));

      // Action 1: update label
      graph.updateNode('n1', { label: 'First' });
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: { label: 'n1' },
        after: { label: 'First' },
      });

      // Action 2: update label again
      graph.updateNode('n1', { label: 'Second' });
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: { label: 'First' },
        after: { label: 'Second' },
      });

      // Undo twice → back to original
      history.undo();
      expect(graph.nodes.get('n1')!.label).toBe('First');
      history.undo();
      expect(graph.nodes.get('n1')!.label).toBe('n1');

      // Redo twice → back to latest
      history.redo();
      expect(graph.nodes.get('n1')!.label).toBe('First');
      history.redo();
      expect(graph.nodes.get('n1')!.label).toBe('Second');
    });
  });

  // ── MAX_HISTORY (50) ──

  describe('max history cap', () => {
    it('caps undo stack at 50 entries', () => {
      const { history } = setup();
      for (let i = 0; i < 55; i++) {
        history.pushAction({
          type: 'updateNode',
          targetId: `n${i}`,
          before: { label: `old${i}` },
          after: { label: `new${i}` },
        });
      }
      expect(history.undoStack).toHaveLength(50);
      // Oldest entries discarded
      expect(history.undoStack[0]!.targetId).toBe('n5');
    });
  });

  // ── clear ──

  describe('clear', () => {
    it('empties both undo and redo stacks', () => {
      const { history } = setup();
      history.pushAction({
        type: 'updateNode',
        targetId: 'n1',
        before: null,
        after: { label: 'A' },
      });
      history.undo();
      expect(history.canRedo).toBe(true);

      history.clear();
      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(false);
      expect(history.undoStack).toEqual([]);
      expect(history.redoStack).toEqual([]);
    });
  });
});
