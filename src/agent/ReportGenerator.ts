/**
 * ReportGenerator — Phase 12 Increment 5
 *
 * Generates session reports from SessionGraph data.
 * Produces both Markdown (human-readable) and JSON (machine-readable) formats.
 *
 * Reports include:
 *   - Session metadata (ID, duration, turn count)
 *   - Delegation breakdown (creative vs engineering vs chat)
 *   - Top intents and delegation targets
 *   - Artifact and task references
 *   - Performance metrics (avg response time, total duration)
 */

import type { SessionGraph } from './SessionGraph.js';
import type { SessionManifest, SessionTurnRecord } from './SessionGraph.js';

export interface SessionReport {
  manifest: SessionManifest;
  delegationBreakdown: Record<string, number>;
  topIntents: Array<{ intent: string; count: number }>;
  artifactRefs: string[];
  taskRefs: string[];
  avgDurationMs: number;
  totalDurationMs: number;
  format: 'markdown' | 'json';
  content: string;
}

export class ReportGenerator {
  /**
   * Generate a report from a SessionGraph instance.
   */
  generate(graph: SessionGraph, format: 'markdown' | 'json' = 'markdown'): SessionReport {
    const manifest = graph.getManifest();
    const turns = graph.getTurns();

    const delegationBreakdown = this.computeDelegationBreakdown(turns);
    const topIntents = this.computeTopIntents(turns);
    const artifactRefs = graph.getAllArtifactRefs();
    const taskRefs = graph.getAllTaskRefs();
    const { avgDurationMs, totalDurationMs } = this.computeTiming(turns);

    const baseReport = {
      manifest,
      delegationBreakdown,
      topIntents,
      artifactRefs,
      taskRefs,
      avgDurationMs,
      totalDurationMs,
    };

    const content = format === 'markdown'
      ? this.renderMarkdown(baseReport)
      : this.renderJSON(baseReport);

    return { ...baseReport, format, content };
  }

  private computeDelegationBreakdown(turns: SessionTurnRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const turn of turns) {
      const target = turn.delegatedTo || 'unknown';
      counts[target] = (counts[target] || 0) + 1;
    }
    return counts;
  }

  private computeTopIntents(turns: SessionTurnRecord[]): Array<{ intent: string; count: number }> {
    const counts: Record<string, number> = {};
    for (const turn of turns) {
      const intent = turn.intent || 'unknown';
      counts[intent] = (counts[intent] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private computeTiming(turns: SessionTurnRecord[]): { avgDurationMs: number; totalDurationMs: number } {
    if (turns.length === 0) return { avgDurationMs: 0, totalDurationMs: 0 };
    const totalMs = turns.reduce((sum, t) => sum + t.durationMs, 0);
    return { avgDurationMs: Math.round(totalMs / turns.length), totalDurationMs: totalMs };
  }

  private renderMarkdown(report: Omit<SessionReport, 'format' | 'content'>): string {
    const lines: string[] = [
      `# Session Report`,
      ``,
      `**Session:** ${report.manifest.sessionId}`,
      `**Created:** ${report.manifest.createdAt}`,
      `**Updated:** ${report.manifest.updatedAt}`,
      `**Turns:** ${report.manifest.turnCount}`,
      `**Duration:** ${this.formatDuration(report.totalDurationMs)}`,
      `**Avg response:** ${this.formatDuration(report.avgDurationMs)}`,
      ``,
      `## Delegation Breakdown`,
      ``,
    ];

    for (const [target, count] of Object.entries(report.delegationBreakdown)) {
      lines.push(`- **${target}**: ${count} turn${count !== 1 ? 's' : ''}`);
    }

    if (report.topIntents.length > 0) {
      lines.push('', '## Top Intents', '');
      for (const { intent, count } of report.topIntents) {
        lines.push(`- ${intent}: ${count}`);
      }
    }

    if (report.artifactRefs.length > 0) {
      lines.push('', '## Artifacts', '');
      for (const ref of report.artifactRefs) {
        lines.push(`- ${ref}`);
      }
    }

    if (report.taskRefs.length > 0) {
      lines.push('', '## Tasks', '');
      for (const ref of report.taskRefs) {
        lines.push(`- ${ref}`);
      }
    }

    return lines.join('\n');
  }

  private renderJSON(report: Omit<SessionReport, 'format' | 'content'>): string {
    return JSON.stringify(report, null, 2);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}
