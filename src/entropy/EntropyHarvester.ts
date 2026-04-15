import type { EntropyHarvesterDeps } from './types.js';

export class EntropyHarvester {
  constructor(private deps: EntropyHarvesterDeps) {}

  async gather(): Promise<string> {
    const events = this.deps.eventStore.getRecent(20);
    const eventsJson = JSON.stringify(events);

    let fragmentsText = '';
    try {
      const heapFiles = await this.deps.heap.listFiles();
      fragmentsText += heapFiles.slice(0, 10).join('\n');
    } catch {
      // heap may not be available
    }

    try {
      const seeds = await this.deps.getTopSeeds?.(3);
      if (seeds && seeds.length > 0) {
        fragmentsText += '\n' + seeds.map(s => `[${s.id}:${s.score.toFixed(2)}] ${s.content.slice(0, 200)}`).join('\n');
      }
    } catch {
      // seeds may not be available
    }

    const summary = this.deps.telemetry.getSummary();
    const telemetryJson = JSON.stringify({
      successRate: summary.successRate,
      avgDurationMs: summary.avgDurationMs,
      totalTasks: summary.totalTasks,
      totalViolations: summary.totalViolations,
    });

    return `[EVENTS]${eventsJson}[/EVENTS][FRAGMENTS]${fragmentsText}[/FRAGMENTS][TELEMETRY]${telemetryJson}[/TELEMETRY]`;
  }

  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    this.deps.getTopSeeds = fn;
  }
}
