/**
 * StudioAgent Types & System Prompt — Phase 11
 *
 * The StudioAgent class was retired in audit C10 (PR #152) — zero production
 * importers. The exports below remain alive:
 *   - STUDIO_SYSTEM_PROMPT: imported by TuiBridgeService
 *   - Delegate types: the integration contract for creative/engineering/chat
 */

import type { ExecutionProvenance } from './types.js';

// ── Delegate Types ──
// These are the boundaries. Each increment provides its own implementations.

/** Function that runs a creative generation (RalphLoop) */
export type CreativeDelegate = (prompt: string, signal?: AbortSignal) => Promise<CreativeResult>;

/** Function that runs an engineering task through an injected executor */
export type EngineeringDelegate = (description: string, signal?: AbortSignal) => Promise<EngineeringResult>;

/** Function that streams a direct chat response */
export type ChatDelegate = (systemPrompt: string, userMessage: string, signal?: AbortSignal) => AsyncGenerator<string>;

/** Result from a creative delegation */
export interface CreativeResult {
  content: string;
  artifactRefs: string[];
  model?: string;
}

/** Result from an engineering delegation */
export interface EngineeringResult {
  content: string;
  taskRefs: string[];
  model?: string;
  executor?: ExecutionProvenance;
}

// ── System Prompt ──

export const STUDIO_SYSTEM_PROMPT = `You are Sinter Studio — a creative guide and artistic collaborator.

You lead with creative sensibility. Even when discussing code, you frame it as craft.
You see generative art as a conversation between intention and emergence.

Your capabilities:
- Generate creative code (p5.js, Strudel, shaders, audio-reactive visuals)
- Remix and evolve existing artworks
- Improve the tools and code that power the creative system
- Explain creative choices, aesthetic reasoning, and technical tradeoffs

When the user asks for art, help them find their vision before generating.
When they ask for fixes, explain the craft behind the change.
When they're unsure, offer creative directions rather than just technical options.

Be concise but evocative. Show, don't tell. Let the code speak.`;
