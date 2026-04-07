/**
 * NODEPROMPT module — Spatial Prompt Engineering through Interactive Concept Graphs
 * Barrel file re-exporting all public API.
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

// ── Layout ──
export {
  sphericalToCartesian,
  cartesianToSpherical,
  radialToCartesian,
  radialToSpherical,
  vec3ToSpherical,
} from './layout/coordinates.js';

export { fibonacciSphere } from './layout/fibonacciSphere.js';

export {
  mapNodesToSphere,
  mapHierarchicalToSphere,
} from './layout/SphereLayout.js';

export type {
  HierarchicalRawNode,
  RawEdge,
} from './layout/SphereLayout.js';

// ── Extraction ──
export {
  NODE_TYPES,
  EDGE_RELATIONS,
  ExtractedNodeSchema,
  ExtractedEdgeSchema,
  ExtractionResultSchema,
  EXTRACTION_TOOL,
  SCAFFOLD_TOOL,
  FILL_TOOL,
  VALIDATE_TOOL,
  buildHierarchicalTool,
} from './extraction/schemas.js';

export type {
  ExtractedNode,
  ExtractedEdge,
  ExtractionResult,
  LLMToolDefinition,
  ScaffoldNode,
  FillNode,
  PatchNode,
} from './extraction/schemas.js';

// ── Synthesis ──
export {
  synthesizePrompt,
  renderTree,
} from './synthesis/PromptSynthesizer.js';

// ── Store ──
export { GraphStore } from './store/GraphStore.js';
export type { ViewMode } from './store/GraphStore.js';

export { HistoryStore } from './store/HistoryStore.js';
export type { HistoryEntry } from './store/HistoryStore.js';

// ── Gesture ──
export { GestureEngine } from './gesture/GestureEngine.js';
export type { GestureState } from './gesture/gestureTypes.js';
export { createDefaultGestureState } from './gesture/gestureTypes.js';
