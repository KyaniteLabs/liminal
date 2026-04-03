/**
 * Deprecated collaboration classes - compatibility shims
 *
 * These classes have been removed as part of Fix 8: Consolidate Triple Redundancy.
 * Use CollaborationEngine (which routes to SwarmOrchestrator) instead.
 */

import type { DeepCollaborationConfig, DeepCollaborationResult, CollaborativeConfig, CollaborativeResult, PhaseUpdate } from './types.js';
import type { Domain } from '../types/domains.js';

const DEPRECATION_MESSAGE = `
[DEPRECATED] DeepCollaboration has been removed as part of Fix 8: Consolidate Triple Redundancy.

Use CollaborationEngine instead, which routes all collaboration through SwarmOrchestrator:

  import { CollaborationEngine } from './collab/index.js';
  
  const engine = new CollaborationEngine({
    callLLM: yourLLMCaller,
    swarmConfig: { mode: 'hybrid', maxRounds: 4 }
  });
  
  const result = await engine.run(prompt);

For more details, see: docs/CONSOLIDATION.md
`;

const COLLAB_CLIENT_DEPRECATION = `
[DEPRECATED] CollaborativeClient has been removed as part of Fix 8: Consolidate Triple Redundancy.

Use CollaborationEngine instead, which routes all collaboration through SwarmOrchestrator:

  import { CollaborationEngine } from './collab/index.js';
  
  const engine = new CollaborationEngine({
    callLLM: yourLLMCaller,
    swarmConfig: { mode: 'hybrid', maxRounds: 3 }
  });
  
  const result = await engine.run(prompt);

For more details, see: docs/CONSOLIDATION.md
`;

/**
 * @deprecated Use CollaborationEngine instead. Throws an error with migration instructions.
 */
export class DeepCollaboration {
  constructor(_config: DeepCollaborationConfig) {
    throw new Error(DEPRECATION_MESSAGE);
  }

  async generate(
    _prompt: string,
    _domain?: Domain,
    _systemPrompt?: string,
    _phaseCallback?: (update: PhaseUpdate) => void
  ): Promise<string> {
    throw new Error(DEPRECATION_MESSAGE);
  }

  async generateDeepCollaboration(
    _prompt: string,
    _domain?: Domain,
    _systemPrompt?: string,
    _phaseCallback?: (update: PhaseUpdate) => void
  ): Promise<DeepCollaborationResult> {
    throw new Error(DEPRECATION_MESSAGE);
  }
}

/**
 * @deprecated Use CollaborationEngine instead. Throws an error with migration instructions.
 */
export class CollaborativeClient {
  constructor(_config: CollaborativeConfig) {
    throw new Error(COLLAB_CLIENT_DEPRECATION);
  }

  async generate(
    _prompt: string,
    _domain?: Domain,
    _systemPrompt?: string,
    _progressCallback?: (update: PhaseUpdate) => void
  ): Promise<string> {
    throw new Error(COLLAB_CLIENT_DEPRECATION);
  }

  async generateCollaborative(
    _prompt: string,
    _domain?: Domain,
    _systemPrompt?: string,
    _progressCallback?: (update: PhaseUpdate) => void
  ): Promise<CollaborativeResult> {
    throw new Error(COLLAB_CLIENT_DEPRECATION);
  }
}

// Export as DeprecatedCollaboration namespace
export const DeprecatedCollaboration = {
  DeepCollaboration,
  CollaborativeClient,
};
