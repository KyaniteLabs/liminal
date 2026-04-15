export interface EntropyResult {
  seed: number;
  phrase: string;
  quality: 'harvested' | 'degraded' | 'emergency';
  source: 'metabolic' | 'genesis' | 'fallback';
  hashChain: string[];
}

export interface CompressionConfig {
  rounds?: number;
}

export interface HarvestInput {
  eventsJson: string;
  fragmentsText: string;
  telemetryJson: string;
}

export interface EntropyHarvesterDeps {
  eventStore: { getRecent(count: number): unknown[] };
  heap: { listFiles(): Promise<string[]> };
  telemetry: { getSummary(): { successRate: number; avgDurationMs: number; totalTasks: number; totalViolations: number } };
  getTopSeeds?: (n: number) => Promise<{ id: string; content: string; score: number }[]>;
}

export interface MetabolicEntropyEngineConfig extends EntropyHarvesterDeps {
  compressor?: { compress(input: string, rounds?: number): Omit<EntropyResult, 'quality' | 'source'> };
}
