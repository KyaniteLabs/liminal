/**
 * ProductMode — Phase 12
 *
 * Typed product modes that bias StudioAgent routing.
 * Each mode shifts the delegation target for user inputs:
 *   ask    → preserve intent; conversational input becomes inspection
 *   make   → bias toward creative generation (ralph-loop)
 *   remix  → force creative with remix signal
 *   improve → bias toward hybrid (creative + verification)
 *
 * ModeAwareRouter wraps IntentRouter and applies mode-based overrides
 * before the agent makes delegation decisions.
 */

import type { IntentClassification } from './types.js';
import type { IntentRouter } from './IntentRouter.js';

// ── Types ──

/** The four product modes a user can switch between */
export type ProductMode = 'ask' | 'make' | 'remix' | 'improve';

/** How much autonomy the agent has for this session */
export type AutonomyLevel = 'assist' | 'co-create' | 'autopilot';

/** Workspace profile influences default mode and skill filtering */
export type WorkspaceProfile = 'creative' | 'engineering' | 'hybrid';

/** Full mode configuration for a session */
export interface ModeConfig {
  /** Active product mode */
  mode: ProductMode;
  /** Workspace profile (influences skill filtering) */
  profile?: WorkspaceProfile;
  /** Autonomy level (influences approval gating) */
  autonomy?: AutonomyLevel;
}

/** All available modes with labels for TUI display */
export const PRODUCT_MODES: Record<ProductMode, { label: string; description: string }> = {
  ask: {
    label: 'Ask',
    description: 'Operator Q&A — inspect through the harness instead of chat-only',
  },
  make: {
    label: 'Make',
    description: 'Creative generation — bias toward making art and code',
  },
  remix: {
    label: 'Remix',
    description: 'Creative remix — evolve and transform existing work',
  },
  improve: {
    label: 'Improve',
    description: 'Hybrid mode — generate and verify quality',
  },
};

// ── ModeAwareRouter ──

/**
 * Wraps IntentRouter and applies mode-based routing bias.
 *
 * Composition over inheritance: the base router handles keyword detection,
 * this layer applies mode overrides on top of its classification.
 */
export class ModeAwareRouter {
  constructor(
    private readonly baseRouter: IntentRouter,
    private readonly getActiveMode: () => ModeConfig | undefined,
  ) {}

  /**
   * Classify input with mode-based biasing.
   *
   * The base router classifies via keywords first.
   * Then the active mode may override the intent:
   *   ask    → preserves detected intent; direct input becomes engineering inspection
   *   make   → upgrades 'direct' to 'creative'
   *   remix  → forces 'creative' with topic hint
   *   improve → forces 'hybrid'
   */
  classify(input: string): IntentClassification {
    const base = this.baseRouter.classify(input);
    const modeConfig = this.getActiveMode();

    if (!modeConfig) return base;

    switch (modeConfig.mode) {
      case 'ask':
        if (base.intent !== 'direct') return base;
        return {
          intent: 'engineering',
          confidence: 'medium',
          topic: base.topic ?? 'inspect',
          input,
        };

      case 'make':
        // Upgrade direct inputs to creative; keep other classifications
        if (base.intent === 'direct') {
          return {
            intent: 'creative',
            confidence: 'medium',
            topic: base.topic ?? 'generate',
            input,
          };
        }
        return base;

      case 'remix':
        // Force creative path with remix topic
        return {
          intent: 'creative',
          confidence: 'high',
          topic: base.topic ?? 'remix',
          input,
        };

      case 'improve':
        // Force hybrid for quality improvement
        return {
          intent: 'hybrid',
          confidence: 'high',
          topic: base.topic ?? 'improve',
          input,
        };
    }
  }
}
