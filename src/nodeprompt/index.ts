/**
 * NODEPROMPT module — Spatial Prompt Engineering through Interactive Concept Graphs
 * Barrel file re-exporting all public API.
 *
 * C9 (2026-06-15): removed layout coordinates, fibonacciSphere, SphereLayout,
 * extraction schemas, GraphStore, HistoryStore, gesture types, GestureEngine.
 * Only the synthesis renderer (`synthesizePrompt`) remains live.
 */

// ── Types ──
export type {
  NodeType,
  AbstractionLevel,
  EpistemologicalFacet,
  RhetoricalFacet,
  Vec3,
  SphericalCoord,
  RadialCoord,
  FacetSet,
  NodeData,
  EdgeRelation,
  EdgeData,
  ExtractionConfig,
} from './types/index.js';

export {
  NODE_COLORS,
  DEPTH_COLORS,
  EDGE_COLORS,
  createNodeData,
  computeBranchingFactor,
  allocateBudget,
  allocateLevelBudget,
} from './types/index.js';

// ── Synthesis (the only live path) ──
export {
  synthesizePrompt,
  renderTree,
} from './synthesis/PromptSynthesizer.js';
