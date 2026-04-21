/**
 * EventBus — central event bus for all Liminal processes.
 *
 * Every long-running process (RalphLoop, CompostMill, CompostSoup, SwarmOrchestrator,
 * LLMClient, Renderer) emits typed events here. PreviewServer streams these to the
 * GUI via SSE for real-time visualization.
 */

import { EventEmitter } from 'node:events';
import { sanitizeTerminalText } from '../tui/sanitizeTerminalText.js';
import { Logger } from '../utils/Logger.js';

// ── Event schema ──

export interface BusEvent {
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ── Typed event payloads ──

export interface ProcessStartData {
  process: string;
  stage?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessEndData {
  process: string;
  success: boolean;
  durationMs?: number;
  reason?: string;
  iterations?: number;
  finalScore?: number;
}

export interface ProcessProgressData {
  process: string;
  current: number;
  total: number;
  stage: string;
  message?: string;
}

export interface LLMRequestData {
  provider: string;
  model: string;
  /** Opaque request ID for correlating request/response events */
  requestId?: string;
}

export interface LLMResponseData {
  provider: string;
  model: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  cached?: boolean;
  domain?: string;
  reasoningTraceId?: string;
  thinkingSource?: string;
  reasoningQuality?: number;
  reasoningLength?: number;
  detectedPatterns?: string[];
  recoveredFromThinking?: boolean;
}

export interface CompostStageData {
  stage: string;
  message: string;
}

export interface CompostCollisionData {
  fragmentA: string;
  fragmentB: string;
  strategy: string;
  domains: string[];
}

export interface CompostScoreData {
  fragmentId: string;
  domain: string;
  total: number;
  dimensions?: Record<string, number>;
}

export interface CompostSeedData {
  seedId: string;
  score: number;
  source: string;
  domains: string[];
}

export interface LoopIterationData {
  iteration: number;
  maxIterations?: number;
  score: number;
  promiseDetected: boolean;
  durationMs?: number;
}

export interface LoopEvaluationData {
  iteration: number;
  overallScore: number;
  technicalScore?: number;
  aestheticScore?: number;
  noveltyScore?: number;
}

export interface SwarmRoundData {
  round: number;
  totalRounds: number;
  outputs: Record<string, unknown>;
  votes: Record<string, unknown>;
  winner: string | null;
  converged: boolean;
  vocabularySize?: number;
  timestamp?: number;
}

// ── Event types ──

export const EventTypes = {
  PROCESS_START: 'process:start',
  PROCESS_END: 'process:end',
  PROCESS_PROGRESS: 'process:progress',
  LLM_REQUEST: 'llm:request',
  LLM_RESPONSE: 'llm:response',
  COMPOST_STAGE: 'compost:stage',
  COMPOST_COLLISION: 'compost:collision',   // TuiDebugger handles — no emitter wired yet
  COMPOST_SCORE: 'compost:score',
  COMPOST_SEED: 'compost:seed',
  LOOP_ITERATION: 'loop:iteration',
  LOOP_EVALUATION: 'loop:evaluation',
  SWARM_ROUND: 'swarm:round',
  // Planned but not yet emitted — no producer wired:
  RENDER_SCREENSHOT: 'render:screenshot',
  EXPORT_PROGRESS: 'export:progress',
  GIT_COMMIT: 'git:commit',
  GIT_BRANCH: 'git:branch',
  GIT_INIT: 'git:init',
} as const;

// ── Singleton EventBus ──

class Bus extends EventEmitter {
  private static MAX_LISTENERS = 100;
  /** When true, suppress stdout writes to avoid corrupting Ink TUI rendering. */
  private static _tuiMode = false;
  /** Lock for TUI mode changes to prevent race conditions. */
  private static _tuiModeLock = false;
  /** Map to track wrapped listeners for safe removal */
  private listenerMap = new Map<(event: BusEvent) => void, (event: BusEvent) => void>();

  constructor() {
    super();
    this.setMaxListeners(Bus.MAX_LISTENERS);
  }

  /** 
   * Enable TUI mode — routes event logs to stderr instead of stdout.
   * Uses simple lock to prevent race conditions in concurrent toggles.
   */
  static enableTuiMode(): void { 
    if (!Bus._tuiModeLock) {
      Bus._tuiModeLock = true;
      Bus._tuiMode = true; 
      Bus._tuiModeLock = false;
    }
  }
  /** 
   * Disable TUI mode — event logs go to stdout again.
   * Uses simple lock to prevent race conditions in concurrent toggles.
   */
  static disableTuiMode(): void { 
    if (!Bus._tuiModeLock) {
      Bus._tuiModeLock = true;
      Bus._tuiMode = false; 
      Bus._tuiModeLock = false;
    }
  }
  static isTuiMode(): boolean { return Bus._tuiMode; }

  /** Emit a typed event to all listeners (and log to console). */
  emit(eventType: string, source: string, data: Record<string, unknown>): boolean;
  emit(event: BusEvent): boolean;
  emit(arg1: string | BusEvent, arg2?: string, arg3?: Record<string, unknown>): boolean {
    let event: BusEvent;
    if (typeof arg1 === 'string') {
      event = {
        type: arg1,
        source: arg2 ?? 'unknown',
        data: arg3 ?? {},
        timestamp: new Date().toISOString(),
      };
    } else {
      event = arg1;
    }

    // Log to console (replaces scattered console.log calls)
    this.logToConsole(event);

    try {
      return super.emit('event', event);
    } catch (err) {
      Logger.error('EventBus', 'Error emitting event:', err);
      return false;
    }
  }

  /** Subscribe to all events. */
  onEvent(listener: (event: BusEvent) => void): this {
    if (!listener || typeof listener !== 'function') {
      Logger.error('EventBus', 'Attempted to register null/undefined listener');
      return this;
    }
    
    const wrappedListener = (event: BusEvent) => {
      try {
        listener(event);
      } catch (err) {
        Logger.error('EventBus', 'Handler failed:', err);
      }
    };
    
    this.listenerMap.set(listener, wrappedListener);
    return super.on('event', wrappedListener);
  }

  /** Remove event listener. */
  offEvent(listener: (event: BusEvent) => void): this {
    if (!listener) {
      return this;
    }
    
    const wrappedListener = this.listenerMap.get(listener);
    if (wrappedListener) {
      this.listenerMap.delete(listener);
      return super.off('event', wrappedListener);
    }
    
    // Fallback: try to remove the original listener directly
    return super.off('event', listener);
  }

  // ── TUI mode wrappers (delegate to statics) ──

  /** Enable TUI mode — suppress stdout writes to protect Ink rendering. */
  enableTuiMode(): void { Bus.enableTuiMode(); }
  /** Disable TUI mode — event logs go to stdout again. */
  disableTuiMode(): void { Bus.disableTuiMode(); }
  /** Check if TUI mode is active. */
  isTuiMode(): boolean { return Bus.isTuiMode(); }

  /** Get recent events (ring buffer for late SSE clients). */
  private recentEvents: BusEvent[] = [];
  private recentEventsHead = 0;
  private static readonly MAX_RECENT = 200;

  /**
   * Add event to ring buffer.
   * Uses circular buffer pattern to avoid race conditions in push/shift.
   */
  addRecentEvent(event: BusEvent): void {
    const maxSize = Bus.MAX_RECENT;
    const currentSize = this.recentEvents.length;
    
    if (currentSize < maxSize) {
      // Buffer not full yet, just append
      this.recentEvents.push(event);
    } else {
      // Buffer full, overwrite oldest (circular)
      this.recentEvents[this.recentEventsHead] = event;
      this.recentEventsHead = (this.recentEventsHead + 1) % maxSize;
    }
  }

  /**
   * Get recent events in chronological order.
   * Returns a copy to prevent external mutation.
   */
  getRecentEvents(): BusEvent[] {
    const maxSize = Bus.MAX_RECENT;
    const size = this.recentEvents.length;
    
    if (size === 0) return [];
    
    // If buffer is not full, just return copy
    if (size < maxSize) {
      return [...this.recentEvents];
    }
    
    // Buffer is full, reorder to chronological
    const result: BusEvent[] = [];
    for (let i = 0; i < maxSize; i++) {
      const idx = (this.recentEventsHead + i) % maxSize;
      result.push(this.recentEvents[idx]);
    }
    return result;
  }

  private logToConsole(event: BusEvent): void {
    // Store for recent buffer
    this.addRecentEvent(event);

    // Suppress noisy events from console output
    if (event.type === EventTypes.COMPOST_SCORE) return;

    // Test mode should stay quiet by default.
    if (process.env.VITEST || process.env.NODE_ENV === 'test') return;

    // In TUI mode, suppress stdout writes entirely — Ink owns the terminal.
    // TuiDebugger captures events to file for tail -f inspection.
    if (Bus.isTuiMode()) return;

    const ts = event.timestamp.split('T')[1]?.slice(0, 12) ?? event.timestamp;
    const src = event.source.padEnd(12);
    const type = event.type.padEnd(20);

    const colorCode = this.getColorForType(event.type);
    const msg = sanitizeTerminalText(`\x1b[${colorCode}m[${ts}]\x1b[0m \x1b[2m${src}\x1b[0m ${type}`, { maxLength: 160, singleLine: true });

    if (event.type === EventTypes.PROCESS_PROGRESS) {
      const d = this.asProcessProgressData(event.data);
      if (d) {
        const bar = this.progressBar(d.current, d.total, 20);
        process.stdout.write(`${sanitizeTerminalText(`${msg} ${bar} ${d.current}/${d.total} ${d.stage}`, { maxLength: 180, singleLine: true })}\n`);
      }
    } else if (event.type === EventTypes.LLM_RESPONSE) {
      const d = this.asLLMResponseData(event.data);
      if (d) {
        const status = d.success ? 'ok' : `err: ${d.error}`;
        process.stdout.write(`${sanitizeTerminalText(`${msg} ${d.provider}/${d.model} ${d.latencyMs}ms ${status}`, { maxLength: 180, singleLine: true })}\n`);
      }
    } else if (event.type === EventTypes.LOOP_ITERATION) {
      const d = this.asLoopIterationData(event.data);
      if (d) {
        process.stdout.write(`${sanitizeTerminalText(`${msg} iter=${d.iteration} score=${d.score.toFixed(2)}${d.promiseDetected ? ' PROMISE' : ''}`, { maxLength: 180, singleLine: true })}\n`);
      }
    } else {
      // Generic: show a summary message from data
      const summary = (event.data as Record<string, unknown>).message ?? '';
      if (summary) {
        process.stdout.write(`${sanitizeTerminalText(`${msg} ${String(summary)}`, { maxLength: 180, singleLine: true })}\n`);
      }
    }
  }

  private getColorForType(type: string): string {
    if (type.startsWith('process:')) return '36'; // cyan
    if (type.startsWith('llm:')) return '33';     // yellow
    if (type.startsWith('compost:')) return '32';  // green
    if (type.startsWith('loop:')) return '34';     // blue
    if (type.startsWith('swarm:')) return '35';    // magenta
    return '37'; // white
  }

  private progressBar(current: number, total: number, width: number): string {
    const pct = total > 0 ? current / total : 0;
    const filled = Math.round(pct * width);
    return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
  }

  // Type guard functions for safe data casting
  private asProcessProgressData(data: Record<string, unknown>): ProcessProgressData | null {
    if (
      typeof data.process === 'string' &&
      typeof data.current === 'number' &&
      typeof data.total === 'number' &&
      typeof data.stage === 'string'
    ) {
      return {
        process: data.process,
        current: data.current,
        total: data.total,
        stage: data.stage,
      };
    }
    return null;
  }

  private asLLMResponseData(data: Record<string, unknown>): LLMResponseData | null {
    if (
      typeof data.provider === 'string' &&
      typeof data.model === 'string' &&
      typeof data.success === 'boolean' &&
      typeof data.latencyMs === 'number'
    ) {
      return {
        provider: data.provider,
        model: data.model,
        success: data.success,
        latencyMs: data.latencyMs,
      };
    }
    return null;
  }

  private asLoopIterationData(data: Record<string, unknown>): LoopIterationData | null {
    if (
      typeof data.iteration === 'number' &&
      typeof data.score === 'number' &&
      typeof data.promiseDetected === 'boolean'
    ) {
      return {
        iteration: data.iteration,
        score: data.score,
        promiseDetected: data.promiseDetected,
      };
    }
    return null;
  }

}

/** Singleton EventBus instance. Import and use across the codebase. */
export const eventBus = new Bus();
export default eventBus;
