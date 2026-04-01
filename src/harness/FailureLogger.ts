/**
 * FailureLogger - Captures all failures for Meta-Harness learning
 * 
 * Every failure is logged with rich context for pattern detection
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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

  log(failure: Omit<FailureRecord, 'timestamp' | 'sessionId' | 'id'>): void {
    const record: FailureRecord = {
      ...failure,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    };

    const filename = `${record.id}.json`;
    const filepath = join(this.logDir, filename);

    writeFileSync(filepath, JSON.stringify(record, null, 2));
    
    console.log(`[Meta-Harness] Failure logged: ${filepath}`);
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
