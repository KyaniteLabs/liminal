/**
 * TuiDebugger — Verbose debug capture for the TUI.
 *
 * Subscribes to EventBus events, stores them in a ring buffer,
 * writes to a timestamped log file in ~/.liminal/debug/, and
 * provides formatted output for the TUI's DebugPanel.
 *
 * NEVER writes to stdout (that would corrupt Ink's rendering).
 * Uses stderr for critical alerts only, file for everything else.
 *
 * Enable via:
 *   - LIMINAL_VERBOSE=1 env var (auto-enables on startup)
 *   - /debug on command in the TUI
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { eventBus, type BusEvent } from '../core/EventBus.js';
import { Logger } from '../utils/Logger.js';

const LIMINAL_HOME = path.join(os.homedir(), '.liminal');
const DEBUG_DIR = path.join(LIMINAL_HOME, 'debug');
const RING_BUFFER_SIZE = 200;
const FLUSH_INTERVAL_MS = 500; // flush file buffer every 500ms

export interface DebugEntry {
  timestamp: string;
  source: string;
  type: string;
  summary: string;
  data: Record<string, unknown>;
}

class TuiDebugger {
  private ring: DebugEntry[] = [];
  private fileStream: fs.WriteStream | null = null;
  private logPath: string | null = null;
  private _enabled = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pendingLines: string[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor() {
    // Auto-enable if env var is set
    if (process.env.LIMINAL_VERBOSE === '1' || process.env.LIMINAL_LOG_LEVEL === 'debug') {
      this.enable();
      return;
    }
    // Explicit disable via env var overrides config
    if (process.env.LIMINAL_VERBOSE === '0' || process.env.LIMINAL_LOG_LEVEL === 'off') {
      return;
    }
    // Also check ~/.liminal/config.json for debug.verbose
    try {
      const configPath = path.join(LIMINAL_HOME, 'config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw);
        if (config.debug?.verbose || config.debug?.logLevel === 'debug') {
          this.enable();
        }
      }
    } catch {
      // Config read failure — don't crash, just skip auto-enable
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get logFilePath(): string | null {
    return this.logPath;
  }

  /** Enable debug capture. Idempotent — calling twice is safe. */
  enable(): void {
    if (this._enabled) return;
    this._enabled = true;

    // Ensure debug directory exists
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }

    // Open timestamped log file
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    this.logPath = path.join(DEBUG_DIR, `tui-${ts}.log`);
    this.fileStream = fs.createWriteStream(this.logPath, { flags: 'a' });
    this.writeFileHeader();

    // Subscribe to EventBus
    const handler = (event: BusEvent): void => this.captureEvent(event);
    eventBus.onEvent(handler);
    this.unsubscribe = () => eventBus.offEvent(handler);

    // Periodic flush of pending lines
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Also capture Logger output by intercepting
    this.captureLog('TuiDebugger', 'Debug mode enabled. Log file: ' + this.logPath);
    Logger.info('TuiDebugger', 'Verbose debug mode enabled');
  }

  /** Disable debug capture. Flushes and closes the log file. */
  disable(): void {
    if (!this._enabled) return;
    this._enabled = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.flush();
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }

    Logger.info('TuiDebugger', 'Debug mode disabled');
  }

  /** Toggle debug mode on/off. Returns new state. */
  toggle(): boolean {
    if (this._enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this._enabled;
  }

  /** Get the last N entries from the ring buffer. */
  getEntries(count = 50): DebugEntry[] {
    return this.ring.slice(-count);
  }

  /** Get formatted lines for the DebugPanel. */
  getFormattedLines(count = 20): string[] {
    return this.ring.slice(-count).map(entry => {
      const ts = entry.timestamp.split('T')[1]?.slice(0, 12) ?? '';
      const src = entry.source.slice(0, 10).padEnd(10);
      return `${ts} ${src} ${entry.type.padEnd(20)} ${entry.summary}`;
    });
  }

  /** Manually add a debug log entry (for non-EventBus sources). */
  captureLog(source: string, message: string): void {
    if (!this._enabled) return;
    const entry: DebugEntry = {
      timestamp: new Date().toISOString(),
      source,
      type: 'debug:log',
      summary: message.slice(0, 120),
      data: { message },
    };
    this.pushEntry(entry);
  }

  // ── Private ──

  private captureEvent(event: BusEvent): void {
    if (!this._enabled) return;

    const summary = this.summarizeEvent(event);
    const entry: DebugEntry = {
      timestamp: event.timestamp,
      source: event.source,
      type: event.type,
      summary,
      data: event.data,
    };
    this.pushEntry(entry);
  }

  private pushEntry(entry: DebugEntry): void {
    this.ring.push(entry);
    if (this.ring.length > RING_BUFFER_SIZE) {
      this.ring.shift();
    }

    // Queue for file write
    const line = this.formatFileLine(entry);
    this.pendingLines.push(line);
  }

  private summarizeEvent(event: BusEvent): string {
    const d = event.data;
    switch (event.type) {
      case 'llm:request':
        return `${d.provider ?? '?'}/${d.model ?? '?'} prompt=${String(d.promptPreview ?? '').slice(0, 60)}`;
      case 'llm:response': {
        const status = d.success ? 'ok' : `ERR: ${d.error}`;
        return `${d.provider ?? '?'}/${d.model ?? '?'} ${d.latencyMs}ms ${status}`;
      }
      case 'process:start':
        return `${d.process} stage=${d.stage ?? 'n/a'}`;
      case 'process:end':
        return `${d.process} success=${d.success} ${d.durationMs}ms`;
      case 'process:progress':
        return `${d.current}/${d.total} ${d.stage}`;
      case 'loop:iteration':
        return `iter=${d.iteration} score=${typeof d.score === 'number' ? d.score.toFixed(2) : '?'}${d.promiseDetected ? ' PROMISE' : ''}`;
      case 'loop:evaluation':
        return `iter=${d.iteration} overall=${d.overallScore}`;
      case 'compost:stage':
        return `${d.stage} ${d.message ?? ''}`;
      case 'compost:collision':
        return `${d.fragmentA} x ${d.fragmentB} via ${d.strategy}`;
      case 'compost:seed':
        return `seed=${d.seedId} score=${d.score} from=${d.source}`;
      case 'swarm:round':
        return `round=${d.round}/${d.totalRounds} winner=${d.winner ?? 'none'} converged=${d.converged}`;
      default:
        return String(d.message ?? JSON.stringify(d).slice(0, 80));
    }
  }

  private formatFileLine(entry: DebugEntry): string {
    const ts = entry.timestamp;
    const level = entry.type.startsWith('llm') ? 'LLM' :
                  entry.type.startsWith('process') ? 'PROC' :
                  entry.type.startsWith('loop') ? 'LOOP' :
                  entry.type.startsWith('compost') ? 'COMP' :
                  entry.type.startsWith('swarm') ? 'SWRM' :
                  'DBUG';
    return `[${ts}] [${level}] [${entry.source}] ${entry.type} | ${entry.summary} | ${JSON.stringify(entry.data).slice(0, 200)}`;
  }

  private writeFileHeader(): void {
    if (!this.fileStream) return;
    const header = [
      '='.repeat(80),
      `Liminal TUI Debug Log`,
      `Started: ${new Date().toISOString()}`,
      `PID: ${process.pid}`,
      `Node: ${process.version}`,
      `Platform: ${process.platform} ${process.arch}`,
      `Verbose: ${process.env.LIMINAL_VERBOSE ?? '0'}`,
      `LogLevel: ${process.env.LIMINAL_LOG_LEVEL ?? 'warn'}`,
      '='.repeat(80),
      '',
    ].join('\n');
    this.fileStream.write(header);
  }

  private flush(): void {
    if (!this.fileStream || this.pendingLines.length === 0) return;
    const batch = this.pendingLines.splice(0);
    this.fileStream.write(batch.join('\n') + '\n');
  }
}

/** Singleton debugger instance. */
export const tuiDebugger = new TuiDebugger();
export default tuiDebugger;
