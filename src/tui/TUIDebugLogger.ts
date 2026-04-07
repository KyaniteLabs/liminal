/**
 * TUI Debug Logger - File-based debug logging for runtime inspection
 *
 * Writes timestamped logs to ~/.liminal/logs/tui-debug.log
 * so an external observer (Claude, tail -f) can see what's happening.
 *
 * Enable: LIMINAL_TUI_DEBUG=true env var, or /debug on inside TUI
 */

import fs from 'node:fs';
import path from 'node:path';
import { Logger } from '../utils/Logger.js';

const LOG_DIR = path.join(process.env.HOME || '/tmp', '.liminal', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'tui-debug.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB, then rotate

class TUIDebugLogger {
  private enabled: boolean;
  private stream: fs.WriteStream | null = null;

  constructor() {
    this.enabled = process.env.LIMINAL_TUI_DEBUG === 'true';
  }

  enable(): void {
    this.enabled = true;
    this.ensureStream();
    this.write('LOG', 'Debug logging ENABLED');
  }

  disable(): void {
    this.write('LOG', 'Debug logging DISABLED');
    this.enabled = false;
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Log routing decision */
  route(input: string, target: 'slash' | 'agent' | 'chat', reason: string): void {
    if (!this.enabled) return;
    const preview = input.length > 60 ? input.slice(0, 60) + '...' : input;
    this.write('ROUTE', `"${preview}" → ${target} (${reason})`);
  }

  /** Log LLM request */
  llmRequest(systemPrompt: string, userPrompt: string, opts?: { maxTokens?: number; temperature?: number }): void {
    if (!this.enabled) return;
    this.write('LLM_REQ', [
      `system=${systemPrompt.length}chars, user=${userPrompt.length}chars`,
      opts ? `maxTokens=${opts.maxTokens}, temp=${opts.temperature}` : '',
      `user_preview: ${userPrompt.slice(0, 200).replace(/\n/g, '\\n')}`,
    ].filter(Boolean).join(' | '));
  }

  /** Log LLM response */
  llmResponse(durationMs: number, responseLen: number, preview: string): void {
    if (!this.enabled) return;
    this.write('LLM_RES', `${durationMs}ms, ${responseLen}chars | ${preview.slice(0, 150).replace(/\n/g, '\\n')}`);
  }

  /** Log LLM error */
  llmError(error: string): void {
    if (!this.enabled) return;
    this.write('LLM_ERR', error);
  }

  /** Log provider switch */
  providerSwitch(model: string, baseUrl: string): void {
    if (!this.enabled) return;
    this.write('PROVIDER', `Switched to ${model} @ ${baseUrl}`);
  }

  /** Log streaming events */
  streamEvent(type: 'thinking' | 'content', chars: number): void {
    if (!this.enabled) return;
    this.write('STREAM', `${type} +${chars}chars`);
  }

  /** Generic log */
  log(tag: string, message: string): void {
    if (!this.enabled) return;
    this.write(tag, message);
  }

  /** Get the log file path for external consumers */
  getLogPath(): string {
    return LOG_FILE;
  }

  private ensureStream(): void {
    if (this.stream) return;
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      // Rotate if too large
      try {
        const stat = fs.statSync(LOG_FILE);
        if (stat.size > MAX_LOG_SIZE) {
          const backup = LOG_FILE.replace('.log', `-${Date.now()}.log`);
          fs.renameSync(LOG_FILE, backup);
        }
      } catch {
        // File doesn't exist yet, that's fine
      }
      this.stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    } catch (err) {
      Logger.warn('TUIDebugLogger', `Failed to create log stream: ${(err as Error).message}`);
    }
  }

  private write(tag: string, message: string): void {
    this.ensureStream();
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${tag}] ${message}\n`;
    if (this.stream) {
      this.stream.write(line);
    }
  }
}

/** Singleton */
export const tuiDebug = new TUIDebugLogger();
