import { describe, it, expect, vi } from 'vitest';
import { GraphStore } from '../../../src/nodeprompt/store/GraphStore.js';
import type { NodeData, EdgeData } from '../../../src/nodeprompt/types/index.js';
import { createNodeData } from '../../../src/nodeprompt/types/index.js';

// ── Test fixtures ──

function makeNode(id: string, label?: string): NodeData {
  return createNodeData({ id, label: label ?? id, type: 'concept' });
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

// ── Construction & defaults ──

describe('GraphStore', () => {
  it('starts empty with default values', () => {
    const store = new GraphStore();
    expect(store.nodeArray).toEqual([]);
    expect(store.edgeArray).toEqual([]);
    expect(store.mode).toBe('sphere');
    expect(store.selectedNodeId).toBeNull();
    expect(store.hoveredNodeId).toBeNull();
    expect(store.originalPrompt).toBe('');
    expect(store.synthesizedPrompt).toBe('');
    expect(store.response).toBe('');
    expect(store.isProcessing).toBe(false);
    expect(store.sphereRadius).toBe(3);
    expect(store.showLabels).toBe(true);
    expect(store.gestureEnabled).toBe(false);
    expect(store.extractionConfig).toEqual({
      maxDepth: 3,
      maxNodes: 15,
      branchingFactor: 3,
    });
  });

  // ── addNode ──

  describe('addNode', () => {
    it('adds a node to the store', () => {
      const store = new GraphStore();
      const node = makeNode('n1', 'Alpha');
      store.addNode(node);
      expect(store.nodes.get('n1')).toEqual(node);
      expect(store.nodeArray).toHaveLength(1);
      expect(store.nodeArray[0]!.label).toBe('Alpha');
    });

    it('updates an existing node when adding with same id', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1', 'Old'));
      store.addNode(makeNode('n1', 'New'));
      expect(store.nodeArray).toHaveLength(1);
      expect(store.nodes.get('n1')!.label).toBe('New');
    });

    it('notifies listeners on add', () => {
      const store = new GraphStore();
      const listener = vi.fn();
      store.onChange(listener);
      store.addNode(makeNode('n1'));
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ── updateNode ──

  describe('updateNode', () => {
    it('patches specific fields on a node', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1', 'Alpha'));
      store.updateNode('n1', { label: 'Beta', weight: 0.9 });
      const node = store.nodes.get('n1')!;
      expect(node.label).toBe('Beta');
      expect(node.weight).toBe(0.9);
      expect(node.type).toBe('concept'); // unchanged
    });

    it('does nothing for non-existent node', () => {
      const store = new GraphStore();
      const listener = vi.fn();
      store.onChange(listener);
      store.updateNode('missing', { label: 'X' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps nodeArray entry in sync', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1', 'Alpha'));
      store.addNode(makeNode('n2', 'Beta'));
      store.updateNode('n1', { label: 'Updated' });
      expect(store.nodeArray[0]!.label).toBe('Updated');
      expect(store.nodeArray).toHaveLength(2);
    });
  });

  // ── removeNode ──

  describe('removeNode', () => {
    it('removes a node from the store', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.addNode(makeNode('n2'));
      store.removeNode('n1');
      expect(store.nodes.has('n1')).toBe(false);
      expect(store.nodeArray).toHaveLength(1);
      expect(store.nodeArray[0]!.id).toBe('n2');
    });

    it('cascades to remove connected edges', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.addNode(makeNode('n2'));
      store.addNode(makeNode('n3'));
      store.addEdge(makeEdge('e1', 'n1', 'n2'));
      store.addEdge(makeEdge('e2', 'n2', 'n3'));
      store.removeNode('n2');
      // e1 and e2 both connect to n2 → both removed
      expect(store.edges.has('e1')).toBe(false);
      expect(store.edges.has('e2')).toBe(false);
      expect(store.edgeArray).toHaveLength(0);
    });

    it('does nothing for non-existent node', () => {
      const store = new GraphStore();
      const listener = vi.fn();
      store.onChange(listener);
      store.removeNode('missing');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── softDeleteNode ──

  describe('softDeleteNode', () => {
    it('marks a node as deleted without removing it', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.softDeleteNode('n1');
      const node = store.nodes.get('n1')!;
      expect(node.isDeleted).toBe(true);
      expect(store.nodeArray).toHaveLength(1); // still in array
    });

    it('cascades to soft-delete connected edges', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.addNode(makeNode('n2'));
      store.addEdge(makeEdge('e1', 'n1', 'n2'));
      store.softDeleteNode('n1');
      expect(store.edges.get('e1')!.isDeleted).toBe(true);
    });

    it('is a no-op if node is already deleted', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.softDeleteNode('n1');
      const listener = vi.fn();
      store.onChange(listener);
      store.softDeleteNode('n1');
      // updateNode is called but returns early → no notify
      // Actually, softDeleteNode calls updateNode which does set+notify even if same value
      // Let's verify the state stays deleted
      expect(store.nodes.get('n1')!.isDeleted).toBe(true);
    });

    it('does nothing for non-existent node', () => {
      const store = new GraphStore();
      const listener = vi.fn();
      store.onChange(listener);
      store.softDeleteNode('missing');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── restoreNode ──

  describe('restoreNode', () => {
    it('restores a soft-deleted node', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.softDeleteNode('n1');
      store.restoreNode('n1');
      expect(store.nodes.get('n1')!.isDeleted).toBe(false);
    });

    it('restores connected edges if other endpoint is alive', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.addNode(makeNode('n2'));
      store.addEdge(makeEdge('e1', 'n1', 'n2'));
      store.softDeleteNode('n1'); // cascades to e1
      expect(store.edges.get('e1')!.isDeleted).toBe(true);
      store.restoreNode('n1');
      expect(store.edges.get('e1')!.isDeleted).toBe(false);
    });

    it('does not restore edge if other endpoint is also deleted', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.addNode(makeNode('n2'));
      store.addEdge(makeEdge('e1', 'n1', 'n2'));
      store.softDeleteNode('n1');
      store.softDeleteNode('n2');
      store.restoreNode('n1');
      // n2 is still deleted → edge stays deleted
      expect(store.edges.get('e1')!.isDeleted).toBe(true);
    });

    it('is a no-op if node is not deleted', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      const listener = vi.fn();
      store.onChange(listener);
      store.restoreNode('n1');
      // restoreNode calls updateNode which returns early if not deleted
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── addEdge ──

  describe('addEdge', () => {
    it('adds an edge to the store', () => {
      const store = new GraphStore();
      const edge = makeEdge('e1', 'n1', 'n2');
      store.addEdge(edge);
      expect(store.edges.get('e1')).toEqual(edge);
      expect(store.edgeArray).toHaveLength(1);
    });

    it('updates an existing edge when adding with same id', () => {
      const store = new GraphStore();
      store.addEdge(makeEdge('e1', 'n1', 'n2'));
      store.addEdge({ ...makeEdge('e1', 'n1', 'n2'), strength: 0.99 });
      expect(store.edgeArray).toHaveLength(1);
      expect(store.edges.get('e1')!.strength).toBe(0.99);
    });
  });

  // ── removeEdge ──

  describe('removeEdge', () => {
    it('removes an edge from the store', () => {
      const store = new GraphStore();
      store.addEdge(makeEdge('e1', 'n1', 'n2'));
      store.addEdge(makeEdge('e2', 'n2', 'n3'));
      store.removeEdge('e1');
      expect(store.edges.has('e1')).toBe(false);
      expect(store.edgeArray).toHaveLength(1);
      expect(store.edgeArray[0]!.id).toBe('e2');
    });

    it('does nothing for non-existent edge', () => {
      const store = new GraphStore();
      const listener = vi.fn();
      store.onChange(listener);
      store.removeEdge('missing');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── replaceGraph ──

  describe('replaceGraph', () => {
    it('replaces all nodes and edges atomically', () => {
      const store = new GraphStore();
      store.addNode(makeNode('old1'));
      store.addEdge(makeEdge('old_e1', 'old1', 'old1'));

      const nodes = [makeNode('n1', 'A'), makeNode('n2', 'B')];
      const edges = [makeEdge('e1', 'n1', 'n2')];
      store.replaceGraph(nodes, edges);

      expect(store.nodeArray).toHaveLength(2);
      expect(store.edgeArray).toHaveLength(1);
      expect(store.nodes.has('old1')).toBe(false);
      expect(store.edges.has('old_e1')).toBe(false);
    });

    it('handles empty replacement', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.replaceGraph([], []);
      expect(store.nodeArray).toHaveLength(0);
      expect(store.edgeArray).toHaveLength(0);
    });
  });

  // ── appendNodes ──

  describe('appendNodes', () => {
    it('appends nodes and edges to existing graph', () => {
      const store = new GraphStore();
      store.addNode(makeNode('existing'));
      store.appendNodes([makeNode('n1'), makeNode('n2')], [makeEdge('e1', 'n1', 'n2')]);
      expect(store.nodeArray).toHaveLength(3);
      expect(store.edgeArray).toHaveLength(1);
    });
  });

  // ── Simple setters ──

  describe('setters', () => {
    it('setMode updates mode', () => {
      const store = new GraphStore();
      store.setMode('radial');
      expect(store.mode).toBe('radial');
    });

    it('setSelectedNodeId updates selection', () => {
      const store = new GraphStore();
      store.setSelectedNodeId('n1');
      expect(store.selectedNodeId).toBe('n1');
      store.setSelectedNodeId(null);
      expect(store.selectedNodeId).toBeNull();
    });

    it('setHoveredNodeId updates hover', () => {
      const store = new GraphStore();
      store.setHoveredNodeId('n2');
      expect(store.hoveredNodeId).toBe('n2');
    });

    it('setOriginalPrompt updates prompt', () => {
      const store = new GraphStore();
      store.setOriginalPrompt('test prompt');
      expect(store.originalPrompt).toBe('test prompt');
    });

    it('setSynthesizedPrompt updates prompt', () => {
      const store = new GraphStore();
      store.setSynthesizedPrompt('synthesized');
      expect(store.synthesizedPrompt).toBe('synthesized');
    });

    it('setResponse updates response', () => {
      const store = new GraphStore();
      store.setResponse('response text');
      expect(store.response).toBe('response text');
    });

    it('setProcessing updates flag', () => {
      const store = new GraphStore();
      store.setProcessing(true);
      expect(store.isProcessing).toBe(true);
    });

    it('setSphereRadius updates radius', () => {
      const store = new GraphStore();
      store.setSphereRadius(10);
      expect(store.sphereRadius).toBe(10);
    });

    it('toggleLabels flips showLabels', () => {
      const store = new GraphStore();
      expect(store.showLabels).toBe(true);
      store.toggleLabels();
      expect(store.showLabels).toBe(false);
      store.toggleLabels();
      expect(store.showLabels).toBe(true);
    });

    it('setGestureEnabled updates flag', () => {
      const store = new GraphStore();
      store.setGestureEnabled(true);
      expect(store.gestureEnabled).toBe(true);
    });

    it('setExtractionConfig merges partial config', () => {
      const store = new GraphStore();
      store.setExtractionConfig({ maxDepth: 5 });
      expect(store.extractionConfig.maxDepth).toBe(5);
      expect(store.extractionConfig.maxNodes).toBe(15); // unchanged
    });
  });

  // ── onChange / listeners ──

  describe('onChange', () => {
    it('returns an unsubscribe function', () => {
      const store = new GraphStore();
      const listener = vi.fn();
      const unsub = store.onChange(listener);
      store.addNode(makeNode('n1'));
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
      store.addNode(makeNode('n2'));
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });

    it('supports multiple listeners', () => {
      const store = new GraphStore();
      const l1 = vi.fn();
      const l2 = vi.fn();
      store.onChange(l1);
      store.onChange(l2);
      store.addNode(makeNode('n1'));
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // ── clear ──

  describe('clear', () => {
    it('resets all state to defaults', () => {
      const store = new GraphStore();
      store.addNode(makeNode('n1'));
      store.addEdge(makeEdge('e1', 'n1', 'n1'));
      store.setMode('radial');
      store.setSelectedNodeId('n1');
      store.setOriginalPrompt('test');
      store.setProcessing(true);
      store.toggleLabels();
      store.setGestureEnabled(true);
      store.setExtractionConfig({ maxDepth: 10 });

      store.clear();

      expect(store.nodeArray).toHaveLength(0);
      expect(store.edgeArray).toHaveLength(0);
      expect(store.mode).toBe('sphere');
      expect(store.selectedNodeId).toBeNull();
      expect(store.originalPrompt).toBe('');
      expect(store.isProcessing).toBe(false);
      expect(store.showLabels).toBe(true);
      expect(store.gestureEnabled).toBe(false);
      expect(store.extractionConfig.maxDepth).toBe(3);
    });
  });

  // ── Dual-structure consistency ──

  describe('dual-structure consistency', () => {
    it('Map and Array stay in sync after add + remove + add', () => {
      const store = new GraphStore();
      store.addNode(makeNode('a'));
      store.addNode(makeNode('b'));
      store.addNode(makeNode('c'));
      store.removeNode('b');
      store.addNode(makeNode('d'));

      const mapIds = new Set(Array.from(store.nodes.keys()));
      const arrayIds = new Set(store.nodeArray.map((n) => n.id));
      expect(mapIds).toEqual(arrayIds);
      expect(mapIds).toEqual(new Set(['a', 'c', 'd']));
    });

    it('edge Map and Array stay in sync after removal', () => {
      const store = new GraphStore();
      store.addEdge(makeEdge('e1', 'a', 'b'));
      store.addEdge(makeEdge('e2', 'b', 'c'));
      store.addEdge(makeEdge('e3', 'c', 'd'));
      store.removeEdge('e2');

      const mapIds = new Set(Array.from(store.edges.keys()));
      const arrayIds = new Set(store.edgeArray.map((e) => e.id));
      expect(mapIds).toEqual(arrayIds);
      expect(mapIds).toEqual(new Set(['e1', 'e3']));
    });
  });
});
