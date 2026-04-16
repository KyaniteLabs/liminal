/**
 * ModeRegistry — Phase 12
 *
 * Per-session mode storage with event emission.
 * Lives in the TuiBridgeService composition root.
 *
 * Design: simple Map<sessionId, ModeConfig> with an optional
 * callback for emitting mode change events to the TUI bridge.
 * No filesystem persistence — modes are session-scoped.
 * SessionGraph can snapshot the current mode if needed.
 */

import type { ModeConfig, ProductMode } from './ProductMode.js';

/** Callback when a session's mode changes */
export type ModeChangeCallback = (sessionId: string, config: ModeConfig) => void;

export class ModeRegistry {
  private readonly modes = new Map<string, ModeConfig>();
  private readonly onModeChange?: ModeChangeCallback;

  constructor(deps?: { onModeChange?: ModeChangeCallback }) {
    this.onModeChange = deps?.onModeChange;
  }

  /**
   * Get the active mode config for a session.
   * Returns undefined if no mode has been set (falls back to default routing).
   */
  getMode(sessionId: string): ModeConfig | undefined {
    return this.modes.get(sessionId);
  }

  /**
   * Set the product mode for a session.
   * Fires the onModeChange callback if the mode actually changed.
   */
  setMode(sessionId: string, mode: ProductMode, profile?: string, autonomy?: string): ModeConfig {
    const prev = this.modes.get(sessionId);
    const config: ModeConfig = {
      mode,
      profile: profile as ModeConfig['profile'],
      autonomy: autonomy as ModeConfig['autonomy'],
    };

    // Only emit if mode actually changed
    if (!prev || prev.mode !== mode || prev.profile !== config.profile || prev.autonomy !== config.autonomy) {
      this.modes.set(sessionId, config);
      this.onModeChange?.(sessionId, config);
    } else {
      this.modes.set(sessionId, config);
    }

    return config;
  }

  /**
   * Clear mode state when a session ends.
   */
  clear(sessionId: string): void {
    this.modes.delete(sessionId);
  }

  /**
   * List all session IDs that have an active mode.
   */
  activeSessions(): string[] {
    return [...this.modes.keys()];
  }
}
