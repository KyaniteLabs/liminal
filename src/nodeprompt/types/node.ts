/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 */

// ── Node type taxonomy ──

export type NodeType =
  | 'concept'
  | 'nuance'
  | 'mood'
  | 'philosophy'
  | 'abstraction'
  | 'context';

export type AbstractionLevel =
  | 'superordinate'   // D=0-1: highest abstraction (Rosch superordinate)
  | 'basic'           // D=2: cognitive sweet spot (Rosch basic level)
  | 'subordinate'     // D=3-4: concrete details (Rosch subordinate)
  | 'instance';       // D=5: specific examples

export type EpistemologicalFacet =
  | 'empirical' | 'theoretical' | 'normative' | 'methodological';

export type RhetoricalFacet =
  | 'thesis' | 'antithesis' | 'evidence' | 'qualifier' | 'warrant';

// ── Geometry types ──

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SphericalCoord {
  theta: number;
  phi: number;
}

export interface RadialCoord {
  angle: number;
  depth: number;
}

// ── Faceted classification (Ranganathan) ──

export interface FacetSet {
  cognitive: NodeType;
  epistemological: EpistemologicalFacet;
  rhetorical: RhetoricalFacet;
}

// ── Core node type ──

export interface NodeData {
  id: string;
  label: string;
  type: NodeType;
  weight: number;              // 0–1 importance
  description: string;

  // Hierarchy
  depth: number;               // 0=root, 1=theme, 2=basic, 3+=detail
  abstractionLevel: AbstractionLevel;
  facets: FacetSet;

  // Spatial coordinates
  sphereCoord: SphericalCoord;
  radialCoord: RadialCoord;
  position: Vec3;

  // Tree structure
  parentId: string | null;
  children: string[];

  // State flags
  isUserCreated: boolean;
  isDeleted: boolean;
}

// ── Visual constants (used by GUI phase) ──

export const NODE_COLORS: Record<NodeType, string> = {
  concept:     '#2c2c2c',
  nuance:      '#6b5344',
  mood:        '#5a4460',
  philosophy:  '#3d5167',
  abstraction: '#6b4040',
  context:     '#4a6050',
};

export const DEPTH_COLORS: Record<number, string> = {
  0: '#1a1a1a',
  1: '#3d3d3d',
  2: '#5a5a5a',
  3: '#787878',
  4: '#969696',
};

// ── Safe construction with defaults ──

export function createNodeData(
  partial: Partial<NodeData> & { id: string; label: string; type: NodeType },
): NodeData {
  return {
    weight: 0.5,
    description: '',
    depth: 0,
    abstractionLevel: 'basic',
    facets: {
      cognitive: partial.type,
      epistemological: 'theoretical',
      rhetorical: 'thesis',
    },
    sphereCoord: { theta: 0, phi: 0 },
    radialCoord: { angle: 0, depth: 0 },
    position: { x: 0, y: 0, z: 0 },
    parentId: null,
    children: [],
    isUserCreated: false,
    isDeleted: false,
    ...partial,
  };
}
