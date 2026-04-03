/**
 * Collaboration layer - Multi-model collaboration for maximum quality
 *
 * Consolidated to use only SwarmOrchestrator as THE collaboration system.
 * DeepCollaboration and CollaborativeClient have been removed as part of
 * Fix 8: Consolidate Triple Redundancy.
 */

// Main collaboration engine (routes to SwarmOrchestrator)
export { CollaborationEngine } from './CollaborationEngine.js';
export type {
  CollaborationMode,
  CollaborationEngineResult,
  CollaborationEngineConfig,
  PhaseUpdate,
} from './CollaborationEngine.js';

// Types (kept for backward compatibility where needed)
export type {
  CollaborationRole,
  CollaborationPhase,
  DeepCollaborationConfig,
  DeepCollaborationResult,
  PhaseResult,
  Analysis,
  Synthesis,
  CollaborativeConfig,
  CollaborativeResult,
  CollaborationRound,
  PhaseUpdate as LegacyPhaseUpdate,
  DomainType,
} from './types.js';

// Legacy exports (deprecated, will be removed in future version)
// These now throw errors directing users to use CollaborationEngine instead
export { DeprecatedCollaboration } from './DeprecatedCollaboration.js';
