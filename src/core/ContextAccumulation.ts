/**
 * ContextAccumulation - Manages state history and context accumulation
 *
 * Instance-based: each ContextAccumulation has its own isolated history.
 * Uses AsyncLocalStorage for per-async-context instances to prevent
 * race conditions when multiple RalphLoop instances run concurrently.
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
  stageTimings?: Array<{ label: 'Generate' | 'Evaluate'; durationMs: number }>;
}

export type State = IterationContext;

import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { safeJsonParse, PersistedLoopStateSchema } from '../security/JsonSchemas.js';
import { ensureDir } from '../utils/fs.js';
import { Logger } from '../utils/Logger.js';
import { Result, ok, err } from 'neverthrow';
import { PersistenceError } from '../errors/PersistenceError.js';

export interface PersistedLoopState {
  bestFitness: number;
  iterationsSinceLastImprovement: number;
  budgetUsed: number;
  totalIterations: number;
  savedAt: string;
}

/**
 * AsyncLocalStorage for per-async-context ContextAccumulation instances.
 * This prevents race conditions when multiple loops run concurrently.
 */
const contextStorage = new AsyncLocalStorage<ContextAccumulation>();

export class ContextAccumulation {
  private history: State[] = [];
  private static readonly MAX_HISTORY_SIZE = 50;
  private static readonly defaultInstance = new ContextAccumulation();

  /** 
   * Get the current context instance for this async context.
   * Falls back to the shared legacy instance if none exists in the current async context.
   */
  private static getCurrentInstance(): ContextAccumulation {
    const existing = contextStorage.getStore();
    if (existing) {
      return existing;
    }
    return ContextAccumulation.defaultInstance;
  }

  /**
   * Run a function with an isolated ContextAccumulation instance.
   * Use this to ensure concurrent loops don't share state.
   * 
   * @example
   * ```typescript
   * await ContextAccumulation.runWithContext(async () => {
   *   // All ContextAccumulation operations in this block are isolated
   *   await RalphLoop.run(prompt, options);
   * });
   * ```
   */
  static async runWithContext<T>(fn: () => Promise<T>): Promise<T> {
    const context = new ContextAccumulation();
    return contextStorage.run(context, fn);
  }

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
   * @throws Error if serialization or write fails
   */
  saveState(filePath: string, state: PersistedLoopState): void {
    try {
      const data = JSON.stringify(state, null, 2);
      ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, data, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save loop state: ${message}`);
    }
  }

  /**
   * Load previously persisted loop state from a JSON file.
   * Returns Result — callers must explicitly handle load failures.
   */
  loadState(filePath: string): Result<PersistedLoopState, PersistenceError> {
    if (!fs.existsSync(filePath)) {
      return err(new PersistenceError('Loop state file does not exist', { retryable: false }));
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = safeJsonParse(raw, PersistedLoopStateSchema, 'ContextAccumulation');
      if (!parsed) {
        return err(new PersistenceError('Loop state file contains invalid JSON', { retryable: false }));
      }
      return ok(parsed);
    } catch (error) {
      Logger.warn('ContextAccumulation', 'Failed to load loop state:', error);
      return err(new PersistenceError('Failed to load loop state', {
        cause: error instanceof Error ? error : new Error(String(error)),
        retryable: true,
      }));
    }
  }

  // ---- Static backward-compat wrappers (delegate to async context instance) ----

  /** 
   * Save state to the current async context's history.
   * Each concurrent loop gets its own isolated history.
   */
  static save(state: State): void {
    ContextAccumulation.getCurrentInstance().save(state);
  }

  /** 
   * Load most recent state from the current async context.
   * Returns null if no state exists in this context.
   */
  static load(): State | null {
    return ContextAccumulation.getCurrentInstance().load();
  }

  /** 
   * Get full history from the current async context.
   * History is isolated per concurrent loop.
   */
  static getHistory(): State[] {
    return ContextAccumulation.getCurrentInstance().getHistory();
  }

  /** 
   * Clear history for the current async context.
   * Only affects this loop's state, not other concurrent loops.
   */
  static clear(): void {
    ContextAccumulation.getCurrentInstance().clear();
  }
}
