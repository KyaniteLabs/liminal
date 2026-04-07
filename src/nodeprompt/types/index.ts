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
} from './node.js';

export {
  NODE_COLORS,
  DEPTH_COLORS,
  createNodeData,
} from './node.js';

export type {
  EdgeRelation,
  EdgeData,
} from './edge.js';

export {
  EDGE_COLORS,
} from './edge.js';

export type {
  ExtractionConfig,
} from './extraction.js';

export {
  computeBranchingFactor,
  allocateBudget,
  allocateLevelBudget,
} from './extraction.js';
