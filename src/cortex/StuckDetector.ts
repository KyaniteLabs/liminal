/**
 * StuckDetector — Phase 13, Increment 4
 *
 * Analyzes active processes against class-based duration thresholds
 * to detect stuck workers and suggest recovery actions.
 */

import type { ActiveProcess, StuckWorker } from './types.js';

type ProcessClass = 'leaf' | 'wiring' | 'harness-quality' | 'orchestrator' | 'unknown';

const THRESHOLDS_MS: Record<ProcessClass, number> = {
  leaf: 2 * 60 * 1000,           // 2 minutes
  wiring: 5 * 60 * 1000,         // 5 minutes
  'harness-quality': 10 * 60 * 1000, // 10 minutes
  orchestrator: 15 * 60 * 1000,  // 15 minutes
  unknown: 5 * 60 * 1000,        // 5 minutes default
};

export class StuckDetector {
  detect(processes: ActiveProcess[], now: string): StuckWorker[] {
    const nowMs = new Date(now).getTime();
    const stuck: StuckWorker[] = [];

    for (const proc of processes) {
      const startedMs = new Date(proc.startedAt).getTime();
      if (isNaN(startedMs) || isNaN(nowMs)) continue;

      const durationMs = nowMs - startedMs;
      const cls = this.classifyProcess(proc.name);
      const thresholdMs = THRESHOLDS_MS[cls];

      if (durationMs > thresholdMs) {
        stuck.push({
          processName: proc.name,
          durationMs,
          thresholdMs,
          suggestedRecovery: this.suggestRecovery(cls),
        });
      }
    }

    return stuck;
  }

  classifyProcess(name: string): ProcessClass {
    const lower = name.toLowerCase();
    if (lower.includes('orchestrator') || lower.includes('loop') || lower.includes('cortex')) {
      return 'orchestrator';
    }
    if (lower.includes('harness') || lower.includes('quality') || lower.includes('evaluate')) {
      return 'harness-quality';
    }
    if (lower.includes('wiring') || lower.includes('wire') || lower.includes('bridge') || lower.includes('connect')) {
      return 'wiring';
    }
    if (lower.includes('leaf') || lower.includes('task') || lower.includes('generate') || lower.includes('render')) {
      return 'leaf';
    }
    return 'unknown';
  }

  private suggestRecovery(cls: ProcessClass): string {
    switch (cls) {
      case 'leaf':
        return 'Retry the leaf task with fresh inputs';
      case 'wiring':
        return 'Check connection health and restart bridge';
      case 'harness-quality':
        return 'Re-run quality evaluation with adjusted thresholds';
      case 'orchestrator':
        return 'Restart the orchestrator loop with backoff';
      default:
        return 'Investigate and retry the stuck process';
    }
  }
}
