/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * Prompt synthesis pipeline: converts an edited concept graph back into a
 * structured prompt suitable for LLM generation.
 */

import type { NodeData, EdgeData } from '../types/index.js';

// ── Relation label formatters ──

const RELATION_LABELS: Record<string, (source: string, target: string) => string> = {
  causal: (s, t) => `"${s}" causes "${t}"`,
  contrast: (s, t) => `"${s}" contrasts with "${t}"`,
  amplify: (s, t) => `"${s}" amplifies "${t}"`,
  suppress: (s, t) => `"${s}" suppresses "${t}"`,
  parallel: (s, t) => `"${s}" parallels "${t}"`,
  dependency: (s, t) => `"${s}" depends on "${t}"`,
  'parent-child': (s, t) => `"${s}" contains "${t}"`,
  'cross-link': (s, t) => `"${s}" relates to "${t}"`,
  custom: (s, t) => `"${s}" → "${t}"`,
};

// ── Internal helpers ──

/**
 * Render a node tree grouped by parentId. Root nodes use `###` headings;
 * children use ├─ indentation. Nodes are sorted by weight descending.
 * Only root-level nodes show their description.
 */
export function renderTree(nodes: NodeData[]): string {
  const byParent = new Map<string | null, NodeData[]>();
  for (const node of nodes) {
    const key = node.parentId;
    const siblings = byParent.get(key) ?? [];
    siblings.push(node);
    byParent.set(key, siblings);
  }

  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) return '';

  // Sort roots by weight descending
  roots.sort((a, b) => b.weight - a.weight);

  const lines: string[] = [];

  for (const root of roots) {
    lines.push(`### ${root.label}`);
    if (root.description) {
      lines.push(`   ${root.description}`);
    }
    lines.push(`   Abstraction: ${root.abstractionLevel} | Facets: ${root.facets.cognitive}/${root.facets.epistemological}/${root.facets.rhetorical}`);

    const children = byParent.get(root.id) ?? [];
    children.sort((a, b) => b.weight - a.weight);
    renderChildren(children, byParent, lines, 1);
  }

  return lines.join('\n');
}

function renderChildren(
  children: NodeData[],
  byParent: Map<string | null, NodeData[]>,
  lines: string[],
  depth: number,
): void {
  const indent = '  '.repeat(depth);
  for (const child of children) {
    lines.push(`${indent}├─ ${child.label} (${child.abstractionLevel}, w=${child.weight.toFixed(2)})`);
    const grandchildren = byParent.get(child.id) ?? [];
    grandchildren.sort((a, b) => b.weight - a.weight);
    renderChildren(grandchildren, byParent, lines, depth + 1);
  }
}

/**
 * Build a flat weighted list of concepts, sorted by weight descending.
 */
function renderFlatList(nodes: NodeData[]): string {
  const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
  return sorted
    .map((n) => `- **${n.label}** (weight: ${n.weight.toFixed(2)}, type: ${n.type})${n.description ? ` — ${n.description}` : ''}`)
    .join('\n');
}

/**
 * Build the cross-branch relationships section using RELATION_LABELS.
 */
function renderCrossBranchEdges(edges: EdgeData[], nodeMap: Map<string, NodeData>): string {
  const crossEdges = edges.filter((e) => !e.isHierarchical);
  if (crossEdges.length === 0) return '';

  const lines: string[] = ['### Cross-Branch Relationships', ''];
  for (const edge of crossEdges) {
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (!source || !target) continue;

    const formatter = RELATION_LABELS[edge.relation] ?? RELATION_LABELS['custom']!;
    lines.push(`- ${formatter(source.label, target.label)} (strength: ${edge.strength.toFixed(2)})`);
  }

  return lines.join('\n');
}

/**
 * Build the excluded perspectives section from deleted nodes.
 */
function renderExcludedPerspectives(deletedNodes: NodeData[]): string {
  if (deletedNodes.length === 0) return '';

  const lines: string[] = ['### Excluded Perspectives', ''];
  for (const node of deletedNodes) {
    lines.push(`- ~~${node.label}~~ (${node.type})`);
  }

  return lines.join('\n');
}

/**
 * Build the instructions section — hierarchical if tree structure exists,
 * flat weighted guidance otherwise.
 */
function renderInstructions(nodes: NodeData[]): string {
  const hasHierarchy = nodes.some((n) => n.parentId !== null);
  if (hasHierarchy) {
    return ['### Hierarchical Guidance', '', renderTree(nodes)].join('\n');
  }
  return ['### Weighted Concept Guidance', '', renderFlatList(nodes)].join('\n');
}

// ── Main synthesis function ──

/**
 * Synthesize a structured prompt from an edited concept graph.
 *
 * 1. Filters active (non-deleted) nodes and edges
 * 2. Builds concept section (tree if hierarchical, flat weighted list otherwise)
 * 3. Builds cross-branch relationships section using RELATION_LABELS
 * 4. Builds excluded perspectives section from deleted nodes
 * 5. Builds instructions section (hierarchical or flat guidance)
 * 6. Returns markdown-structured prompt
 */
export function synthesizePrompt(originalPrompt: string, nodes: NodeData[], edges: EdgeData[]): string {
  const activeNodes = nodes.filter((n) => !n.isDeleted);
  const deletedNodes = nodes.filter((n) => n.isDeleted);
  const activeEdges = edges.filter((e) => !e.isDeleted);

  const nodeMap = new Map<string, NodeData>();
  for (const node of activeNodes) {
    nodeMap.set(node.id, node);
  }

  const hasHierarchy = activeNodes.some((n) => n.parentId !== null);

  const sections: string[] = [];

  // Header
  sections.push('# Structured Generation Prompt');
  sections.push('');
  sections.push('## Original Prompt');
  sections.push('');
  sections.push(originalPrompt);
  sections.push('');

  // Concept section
  sections.push('## Concept Graph');
  sections.push('');
  if (hasHierarchy) {
    sections.push(renderTree(activeNodes));
  } else {
    sections.push(renderFlatList(activeNodes));
  }
  sections.push('');

  // Cross-branch relationships
  const crossBranch = renderCrossBranchEdges(activeEdges, nodeMap);
  if (crossBranch) {
    sections.push(crossBranch);
    sections.push('');
  }

  // Excluded perspectives
  const excluded = renderExcludedPerspectives(deletedNodes);
  if (excluded) {
    sections.push(excluded);
    sections.push('');
  }

  // Instructions
  sections.push('## Generation Instructions');
  sections.push('');
  sections.push(renderInstructions(activeNodes));
  sections.push('');

  return sections.join('\n');
}
