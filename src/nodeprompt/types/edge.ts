/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 */

export type EdgeRelation =
  | 'causal'
  | 'contrast'
  | 'amplify'
  | 'suppress'
  | 'parallel'
  | 'dependency'
  | 'parent-child'
  | 'cross-link'
  | 'custom';

export interface EdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: EdgeRelation;
  strength: number;            // 0–1
  isUserCreated: boolean;
  isDeleted: boolean;
  isHierarchical: boolean;
  extractionPass: number;      // Which extraction pass created this edge
  label?: string;
}

// ── Visual constants (used by GUI phase) ──

export const EDGE_COLORS: Record<EdgeRelation, string> = {
  causal:       '#2c2c2c',
  contrast:     '#6b4040',
  amplify:      '#4a6050',
  suppress:     '#5a4460',
  parallel:     '#3d5167',
  dependency:   '#6b5344',
  'parent-child': '#888888',
  'cross-link':   '#555555',
  custom:       '#3d3d3d',
};
