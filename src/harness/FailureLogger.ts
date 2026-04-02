/**
 * FailureLogger - Captures all failures for Meta-Harness learning
 * 
 * Every failure is logged with rich context for pattern detection.
 * Now integrated with ReasoningCapture for mining reasoning traces.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { reasoningCapture, type DetectedPattern, type ReasoningQuality } from '../llm/ReasoningCapture.js';

export interface FailureRecord {
  id?: string;
  timestamp: string;
  sessionId: string;
  model: string;
  domain: string;
  prompt: string;
  code?: string;
  error: string;
  errorType: 'timeout' | 'validation' | 'generation' | 'runtime' | 'other';
  validationErrors?: string[];
  thinking?: string;
  reasoning?: string;
  duration: number;
  iteration?: number;
  codeLength?: number;
  /** Detected reasoning patterns from failure analysis */
  reasoningPatterns?: DetectedPattern[];
  /** Reasoning quality metrics */
  reasoningQuality?: ReasoningQuality;
  /** Link to full reasoning trace */
  reasoningTraceId?: string;
}

export class FailureLogger {
  private logDir: string;
  private sessionId: string;

  constructor() {
    this.logDir = join(homedir(), '.liminal', 'failures');
    this.sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(failure: Omit<FailureRecord, 'timestamp' | 'sessionId' | 'id' | 'reasoningPatterns' | 'reasoningQuality' | 'reasoningTraceId'> & { rawOutput?: string }): void {
    // Capture reasoning trace if raw output provided
    let reasoningTraceId: string | undefined;
    let reasoningPatterns: DetectedPattern[] | undefined;
    let reasoningQuality: ReasoningQuality | undefined;

    if (failure.rawOutput) {
      const trace = reasoningCapture.capture({
        model: failure.model,
        prompt: failure.prompt,
        rawOutput: failure.rawOutput,
        outcome: failure.errorType === 'timeout' ? 'timeout' : 'failure',
        error: failure.error,
        duration: failure.duration,
        iteration: failure.iteration || 1,
      });
      
      reasoningTraceId = trace.id;
      reasoningPatterns = trace.patterns;
      reasoningQuality = trace.quality;
    }

    const record: FailureRecord = {
      ...failure,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      reasoningTraceId,
      reasoningPatterns,
      reasoningQuality,
    };

    const filename = `${record.id}.json`;
    const filepath = join(this.logDir, filename);

    writeFileSync(filepath, JSON.stringify(record, null, 2));
    
    // Log with reasoning insight if available
    if (reasoningPatterns && reasoningPatterns.length > 0) {
      const patternNames = reasoningPatterns.map(p => p.type).join(', ');
      console.log(`[Meta-Harness] Failure logged: ${filepath} (patterns: ${patternNames})`);
    } else {
      console.log(`[Meta-Harness] Failure logged: ${filepath}`);
    }
  }

  getRecentFailures(count: number = 100): FailureRecord[] {
    if (!existsSync(this.logDir)) return [];
    
    const files = readdirSync(this.logDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, count);
    
    return files.map(f => {
      const content = readFileSync(join(this.logDir, f), 'utf-8');
      return JSON.parse(content) as FailureRecord;
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const failureLogger = new FailureLogger();
