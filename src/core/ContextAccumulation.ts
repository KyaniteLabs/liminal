/**
 * ContextAccumulation - Manages state history and context accumulation
 *
 * Instance-based: each ContextAccumulation has its own isolated history.
 * A static `default` instance is provided for backward compatibility with
 * existing static method calls (RalphLoop.getState, reset, isRunning, getProgress).
 *
 * Key behavior:
 * - save(state) adds state to history
 * - load() returns most recent state or null
 * - getHistory() returns all saved states (with truncation)
 * - clear() resets all state
 */

export interface IterationContext {
  iteration: number;
  prompt: string;
  usedPrompt: string;
  code: string;
  evaluation: { score: number; issues: string[]; [key: string]: unknown };
  timestamp: string;
  maxIterations?: number;
}

export type State = IterationContext;

import fs from 'fs';
import path from 'path';
import { safeJsonParse, PersistedLoopStateSchema } from '../security/JsonSchemas.js';

export interface PersistedLoopState {
  bestFitness: number;
  iterationsSinceLastImprovement: number;
  budgetUsed: number;
  totalIterations: number;
  savedAt: string;
}

export class ContextAccumulation {
  private history: State[] = [];
  private static readonly MAX_HISTORY_SIZE = 50;

  /** Default shared instance for backward compatibility. */
  static readonly default = new ContextAccumulation();

  /**
   * Save state to history
   * @param state - The state object to save
   */
  save(state: State): void {
    this.history.push(state);

    // Truncate history if exceeds max size
    if (this.history.length > ContextAccumulation.MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-ContextAccumulation.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Load most recent state
   * @returns Most recent state or null if no state exists
   */
  load(): State | null {
    if (this.history.length === 0) {
      return null;
    }

    const mostRecent = this.history[this.history.length - 1];

    // Return a deep copy to prevent external mutations
    return structuredClone(mostRecent);
  }

  /**
   * Get full history of all saved states
   * @returns Array of all saved states (copy of internal history)
   */
  getHistory(): State[] {
    return this.history.map(state => structuredClone(state));
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Persist loop state to a JSON file.
   * Useful for resuming sessions across restarts.
   */
  saveState(filePath: string, state: PersistedLoopState): void {
    const data = JSON.stringify(state, null, 2);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data, 'utf-8');
  }

  /**
   * Load previously persisted loop state from a JSON file.
   * Returns null if the file doesn't exist or can't be parsed.
   */
  loadState(filePath: string): PersistedLoopState | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return safeJsonParse(raw, PersistedLoopStateSchema, 'ContextAccumulation');
    } catch (err) {
      console.warn('Failed to load loop state:', err);
      return null;
    }
  }

  // ---- Static backward-compat wrappers (delegate to default instance) ----

  /** @deprecated Use instance methods or ContextAccumulation.default */
  static save(state: State): void {
    ContextAccumulation.default.save(state);
  }

  /** @deprecated Use instance methods or ContextAccumulation.default */
  static load(): State | null {
    return ContextAccumulation.default.load();
  }

  /** @deprecated Use instance methods or ContextAccumulation.default */
  static getHistory(): State[] {
    return ContextAccumulation.default.getHistory();
  }

  /** @deprecated Use instance methods or ContextAccumulation.default */
  static clear(): void {
    ContextAccumulation.default.clear();
  }
}
