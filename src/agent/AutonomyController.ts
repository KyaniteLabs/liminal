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
  private defaultLevel: AutonomyLevel = 'assist';
  private sessionLevels = new Map<string, AutonomyLevel>();

  /**
   * Resolve the effective level for a given session.
   * Falls back to the default level if session has no override.
   */
  private resolveLevel(sessionId?: string): AutonomyLevel {
    if (sessionId) return this.sessionLevels.get(sessionId) ?? this.defaultLevel;
    return this.defaultLevel;
  }

  /**
   * Get the current autonomy config.
   * @param sessionId - optional session to look up; uses default if omitted
   */
  getConfig(sessionId?: string): AutonomyConfig {
    return AUTONOMY_LEVELS[this.resolveLevel(sessionId)];
  }

  /**
   * Get the current default level string (for backward compat / tests).
   */
  get level(): AutonomyLevel {
    return this.defaultLevel;
  }

  /**
   * Set the autonomy level.
   *
   * @param level - one of 'assist', 'co-create', 'autopilot'
   * @param sessionId - optional session scope; if provided, only affects that session
   * @returns the new config, or undefined if level string is invalid
   */
  setLevel(level: string, sessionId?: string): AutonomyConfig | undefined {
    if (!AUTONOMY_LEVELS[level as AutonomyLevel]) return undefined;
    if (sessionId) {
      this.sessionLevels.set(sessionId, level as AutonomyLevel);
    } else {
      this.defaultLevel = level as AutonomyLevel;
    }
    return AUTONOMY_LEVELS[level as AutonomyLevel];
  }

  /**
   * Check if a given action type requires user review at the current level.
   *
   * @param actionKind - 'creative' for LLM chat/generation, 'engineering' for task delegation
   * @param sessionId - optional session to look up; uses default if omitted
   */
  requiresReview(actionKind: 'creative' | 'engineering', sessionId?: string): boolean {
    const level = this.resolveLevel(sessionId);
    switch (level) {
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
