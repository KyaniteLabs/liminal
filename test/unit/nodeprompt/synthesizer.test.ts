import { describe, it, expect } from 'vitest';
import { synthesizePrompt, renderTree } from '../../../src/nodeprompt/synthesis/PromptSynthesizer.js';
import { createNodeData } from '../../../src/nodeprompt/types/node.js';
import type { NodeData, EdgeData } from '../../../src/nodeprompt/types/index.js';

// ── Helpers ──

function makeNode(id: string, label: string, overrides: Partial<NodeData> = {}): NodeData {
  return createNodeData({ id, label, type: 'concept', ...overrides });
}

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  overrides: Partial<EdgeData> = {},
): EdgeData {
  return {
    id,
    sourceId,
    targetId,
    relation: 'causal',
    strength: 0.5,
    isUserCreated: false,
    isDeleted: false,
    isHierarchical: true,
    extractionPass: 1,
    ...overrides,
  };
}

// ── synthesizePrompt ──

describe('synthesizePrompt', () => {
  it('excludes deleted nodes from concept section', () => {
    const nodes = [
      makeNode('a', 'Active Node'),
      makeNode('b', 'Deleted Node', { isDeleted: true }),
    ];
    const result = synthesizePrompt('test prompt', nodes, []);
    expect(result).toContain('Active Node');
    expect(result).not.toContain('### Deleted Node');
    expect(result).toContain('Deleted Node'); // appears in Excluded Perspectives
  });

  it('includes deleted nodes in Excluded Perspectives section', () => {
    const nodes = [
      makeNode('a', 'Active'),
      makeNode('b', 'Removed', { isDeleted: true }),
    ];
    const result = synthesizePrompt('test', nodes, []);
    expect(result).toContain('### Excluded Perspectives');
    expect(result).toContain('~~Removed~~');
  });

  it('uses flat list when no hierarchy exists', () => {
    const nodes = [
      makeNode('a', 'Alpha', { weight: 0.9 }),
      makeNode('b', 'Beta', { weight: 0.5 }),
    ];
    const result = synthesizePrompt('test', nodes, []);
    expect(result).toContain('### Weighted Concept Guidance');
    expect(result).toContain('**Alpha**');
    expect(result).toContain('**Beta**');
  });

  it('uses tree rendering when hierarchy exists', () => {
    const nodes = [
      makeNode('root', 'Root', { parentId: null }),
      makeNode('child', 'Child', { parentId: 'root' }),
    ];
    const result = synthesizePrompt('test', nodes, []);
    expect(result).toContain('### Hierarchical Guidance');
    expect(result).toContain('### Root');
    expect(result).toContain('├─ Child');
  });

  it('renders cross-branch edges with correct labels', () => {
    const nodes = [
      makeNode('a', 'Source'),
      makeNode('b', 'Target'),
    ];
    const edges: EdgeData[] = [
      makeEdge('e1', 'a', 'b', {
        isHierarchical: false,
        relation: 'contrast',
        strength: 0.8,
      }),
    ];
    const result = synthesizePrompt('test', nodes, edges);
    expect(result).toContain('### Cross-Branch Relationships');
    expect(result).toContain('"Source" contrasts with "Target"');
    expect(result).toContain('0.80');
  });

  it('renders causal relation correctly', () => {
    const nodes = [
      makeNode('a', 'Cause'),
      makeNode('b', 'Effect'),
    ];
    const edges: EdgeData[] = [
      makeEdge('e1', 'a', 'b', { isHierarchical: false, relation: 'causal' }),
    ];
    const result = synthesizePrompt('test', nodes, edges);
    expect(result).toContain('"Cause" causes "Effect"');
  });

  it('renders amplify relation correctly', () => {
    const nodes = [
      makeNode('a', 'Amp1'),
      makeNode('b', 'Amp2'),
    ];
    const edges: EdgeData[] = [
      makeEdge('e1', 'a', 'b', { isHierarchical: false, relation: 'amplify' }),
    ];
    const result = synthesizePrompt('test', nodes, edges);
    expect(result).toContain('"Amp1" amplifies "Amp2"');
  });

  it('excludes deleted edges from cross-branch section', () => {
    const nodes = [
      makeNode('a', 'NodeA'),
      makeNode('b', 'NodeB'),
    ];
    const edges: EdgeData[] = [
      makeEdge('e1', 'a', 'b', {
        isHierarchical: false,
        isDeleted: true,
        relation: 'contrast',
      }),
    ];
    const result = synthesizePrompt('test', nodes, edges);
    expect(result).not.toContain('Cross-Branch Relationships');
  });

  it('includes original prompt in header', () => {
    const result = synthesizePrompt('My original prompt text', [], []);
    expect(result).toContain('## Original Prompt');
    expect(result).toContain('My original prompt text');
  });

  it('includes generation instructions section', () => {
    const result = synthesizePrompt('test', [], []);
    expect(result).toContain('## Generation Instructions');
  });

  it('handles empty nodes gracefully', () => {
    const result = synthesizePrompt('test', [], []);
    expect(result).toContain('# Structured Generation Prompt');
    expect(result).not.toContain('Excluded Perspectives');
    expect(result).not.toContain('Cross-Branch Relationships');
  });

  it('omits Excluded Perspectives when no deleted nodes', () => {
    const nodes = [makeNode('a', 'Active')];
    const result = synthesizePrompt('test', nodes, []);
    expect(result).not.toContain('### Excluded Perspectives');
  });

  it('omits Cross-Branch when no non-hierarchical edges', () => {
    const nodes = [makeNode('a', 'A'), makeNode('b', 'B')];
    const edges = [makeEdge('e1', 'a', 'b', { isHierarchical: true })];
    const result = synthesizePrompt('test', nodes, edges);
    expect(result).not.toContain('Cross-Branch Relationships');
  });
});

// ── renderTree ──

describe('renderTree', () => {
  it('returns empty string for empty input', () => {
    expect(renderTree([])).toBe('');
  });

  it('renders root nodes with ### headings', () => {
    const nodes = [makeNode('root', 'RootTopic')];
    const result = renderTree(nodes);
    expect(result).toContain('### RootTopic');
  });

  it('sorts roots by weight descending', () => {
    const nodes = [
      makeNode('low', 'LowWeight', { weight: 0.2 }),
      makeNode('high', 'HighWeight', { weight: 0.9 }),
    ];
    const result = renderTree(nodes);
    const lowIdx = result.indexOf('LowWeight');
    const highIdx = result.indexOf('HighWeight');
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it('renders children with hierarchy indentation', () => {
    const nodes = [
      makeNode('parent', 'Parent', { weight: 0.8 }),
      makeNode('child', 'Child', { parentId: 'parent', weight: 0.5 }),
    ];
    const result = renderTree(nodes);
    expect(result).toContain('├─ Child');
  });

  it('renders grandchildren at deeper indentation', () => {
    const nodes = [
      makeNode('root', 'Root'),
      makeNode('child', 'Child', { parentId: 'root' }),
      makeNode('grand', 'GrandChild', { parentId: 'child' }),
    ];
    const result = renderTree(nodes);
    // Grandchild should be more indented than child
    const childLine = result.split('\n').find(l => l.includes('├─ Child'))!;
    const grandLine = result.split('\n').find(l => l.includes('├─ GrandChild'))!;
    // Grandchild has more leading spaces
    const childIndent = childLine.match(/^(\s*)/)!;
    const grandIndent = grandLine.match(/^(\s*)/)!;
    expect(grandIndent[1]!.length).toBeGreaterThan(childIndent[1]!.length);
  });

  it('shows description for root nodes', () => {
    const nodes = [makeNode('r', 'Root', { description: 'A detailed description' })];
    const result = renderTree(nodes);
    expect(result).toContain('A detailed description');
  });

  it('shows abstraction level and facets for roots', () => {
    const nodes = [makeNode('r', 'Root')];
    const result = renderTree(nodes);
    expect(result).toContain('Abstraction: basic');
    expect(result).toContain('Facets: concept/theoretical/thesis');
  });

  it('sorts children by weight descending within same parent', () => {
    const nodes = [
      makeNode('parent', 'Parent', { weight: 1.0 }),
      makeNode('c1', 'ChildLow', { parentId: 'parent', weight: 0.3 }),
      makeNode('c2', 'ChildHigh', { parentId: 'parent', weight: 0.7 }),
    ];
    const result = renderTree(nodes);
    const lowIdx = result.indexOf('ChildLow');
    const highIdx = result.indexOf('ChildHigh');
    expect(highIdx).toBeLessThan(lowIdx);
  });
});
