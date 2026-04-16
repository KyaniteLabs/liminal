/**
 * DemoScenarioRunner — Phase 16
 *
 * Runs a canned demo scenario that showcases the creative Codex workflow:
 * generate → evaluate → steer taste → branch/dream → improve → output.
 * Works with fixture data so it runs without LLM or external deps.
 */

import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../emergence/types.js';
import { GardenPolicy } from '../autonomy/GardenPolicy.js';
import { ChallengeGenerator } from '../autonomy/ChallengeGenerator.js';

export interface DemoStep {
  step: number;
  label: string;
  description: string;
  data: Record<string, unknown>;
}

export interface DemoResult {
  scenarioName: string;
  steps: DemoStep[];
  totalSteps: number;
  passed: boolean;
  durationMs: number;
}

const AXES: DescriptorAxis[] = ['order-chaos', 'sparse-dense', 'symmetry-asymmetry'];

function makeEntry(id: string, quality: number, novelty: number, fertility: number): ArchiveEntry {
  return {
    id,
    artifactRef: { uri: `demo://${id}`, kind: 'generated-code' },
    descriptor: {
      values: [
        { axis: 'order-chaos' as const, value: Math.random() },
        { axis: 'sparse-dense' as const, value: Math.random() },
      ],
      source: 'demo',
      extractedAt: new Date().toISOString(),
    },
    lineage: {
      artifactId: id,
      parentIds: [],
      provenance: 'fresh-generation',
      createdAt: new Date().toISOString(),
    },
    qualityScore: quality,
    signals: { novelty, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

function makeCell(cellId: string, elite?: ArchiveEntry): ArchiveCell {
  return {
    cellId,
    coordinates: [
      { axis: 'order-chaos' as const, value: Math.random() },
      { axis: 'sparse-dense' as const, value: Math.random() },
    ],
    elite,
    nearElites: [],
    capacity: 5,
  };
}

export class DemoScenarioRunner {
  /**
   * Run the canonical creative-codex demo scenario.
   */
  runCreativeCodex(): DemoResult {
    const start = Date.now();
    const steps: DemoStep[] = [];
    let stepNum = 0;

    // Step 1: Generate initial family
    const entries = [
      makeEntry('demo-1', 0.6, 0.8, 0.5),
      makeEntry('demo-2', 0.4, 0.7, 0.3),
      makeEntry('demo-3', 0.7, 0.6, 0.6),
    ];
    steps.push({
      step: ++stepNum,
      label: 'Generate family',
      description: 'Generated 3 creative artifacts with varying quality',
      data: { count: entries.length, avgQuality: entries.reduce((s, e) => s + e.qualityScore, 0) / entries.length },
    });

    // Step 2: Evaluate
    const cells = entries.map((e, i) => makeCell(`cell-${i}`, e));
    steps.push({
      step: ++stepNum,
      label: 'Evaluate & archive',
      description: 'Placed artifacts into archive cells',
      data: { cells: cells.length },
    });

    // Step 3: Garden policy decisions
    const policy = new GardenPolicy();
    const decisions = policy.decide(cells, AXES);
    steps.push({
      step: ++stepNum,
      label: 'Garden policy',
      description: 'Garden decided on next actions',
      data: { actions: decisions.map(d => d.action), priorities: decisions.map(d => d.priority) },
    });

    // Step 4: Generate challenges
    const challenger = new ChallengeGenerator();
    const challenges = challenger.generate(cells, AXES);
    steps.push({
      step: ++stepNum,
      label: 'Generate challenges',
      description: 'Created creative challenges for exploration',
      data: { challenges: challenges.map(c => ({ title: c.title, difficulty: c.difficulty })) },
    });

    // Step 5: Simulate taste steering
    const userPreferred = entries[0]; // user prefers the highest quality
    steps.push({
      step: ++stepNum,
      label: 'Steer taste',
      description: `User preferred artifact ${userPreferred.id}`,
      data: { preferredId: userPreferred.id, quality: userPreferred.qualityScore },
    });

    // Step 6: Branch and dream
    const dreamEntry = makeEntry('dream-1', 0.75, 0.9, 0.8);
    cells.push(makeCell('cell-dream', dreamEntry));
    steps.push({
      step: ++stepNum,
      label: 'Branch & dream',
      description: 'Dreamed new artifact from fertile lineage',
      data: { dreamedId: dreamEntry.id, quality: dreamEntry.qualityScore, novelty: dreamEntry.signals.novelty },
    });

    // Step 7: Improve weak critic
    steps.push({
      step: ++stepNum,
      label: 'Self-improve',
      description: 'Detected weak critic blind spot, scheduled improvement',
      data: { improvement: 'critic-blind-spot', severity: 0.5 },
    });

    // Step 8: Output family improved
    const finalAvg = cells.reduce((s, c) => s + (c.elite?.qualityScore ?? 0), 0) / cells.length;
    steps.push({
      step: ++stepNum,
      label: 'Output family improved',
      description: 'Creative output family quality improved through the loop',
      data: { finalAvgQuality: finalAvg, totalArtifacts: cells.filter(c => c.elite).length },
    });

    return {
      scenarioName: 'creative-codex',
      steps,
      totalSteps: steps.length,
      passed: steps.length === 8 && finalAvg > 0.4,
      durationMs: Date.now() - start,
    };
  }
}
