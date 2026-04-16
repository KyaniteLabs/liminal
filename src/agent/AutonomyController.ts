/**
 * AutonomyController — Phase 12 Increment 5
 *
 * Approval gating per autonomy level:
 *   - assist:    all actions require user review
 *   - co-create: creative (LLM chat) auto-approved, engineering requires review
 *   - autopilot: all actions auto-approved
 *
 * Designed as a decision layer between StudioAgent delegation and execution.
 * The TuiBridgeService checks requiresReview() before emitting action events.
 */

export type AutonomyLevel = 'assist' | 'co-create' | 'autopilot';

export interface AutonomyConfig {
  level: AutonomyLevel;
  label: string;
  description: string;
}

export const AUTONOMY_LEVELS: Record<AutonomyLevel, AutonomyConfig> = {
  assist: {
    level: 'assist',
    label: 'Assist',
    description: 'All actions require your review before execution',
  },
  'co-create': {
    level: 'co-create',
    label: 'Co-Create',
    description: 'Creative actions auto-approved; engineering needs review',
  },
  autopilot: {
    level: 'autopilot',
    label: 'Autopilot',
    description: 'All actions auto-approved — use with caution',
  },
};

export class AutonomyController {
  private currentLevel: AutonomyLevel = 'assist';

  /**
   * Get the current autonomy config.
   */
  getConfig(): AutonomyConfig {
    return AUTONOMY_LEVELS[this.currentLevel];
  }

  /**
   * Get the current level string.
   */
  get level(): AutonomyLevel {
    return this.currentLevel;
  }

  /**
   * Set the autonomy level. Returns the new config, or undefined if invalid.
   */
  setLevel(level: string): AutonomyConfig | undefined {
    if (!AUTONOMY_LEVELS[level as AutonomyLevel]) return undefined;
    this.currentLevel = level as AutonomyLevel;
    return this.getConfig();
  }

  /**
   * Check if a given action type requires user review at the current level.
   *
   * @param actionKind - 'creative' for LLM chat/generation, 'engineering' for task delegation
   */
  requiresReview(actionKind: 'creative' | 'engineering'): boolean {
    switch (this.currentLevel) {
      case 'assist':
        return true; // Everything requires review
      case 'co-create':
        return actionKind === 'engineering'; // Creative auto, engineering needs review
      case 'autopilot':
        return false; // Nothing requires review
    }
  }

  /**
   * List all available autonomy levels.
   */
  listLevels(): AutonomyConfig[] {
    return Object.values(AUTONOMY_LEVELS);
  }
}
