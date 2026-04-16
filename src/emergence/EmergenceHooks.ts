/**
 * EmergenceHooks — Phase 13E integration module
 *
 * Orchestrates archive write-through for every creative run.
 * Called after generation, remix, compost promotion, dream, or branch
 * to extract descriptors, track lineage, attempt archive placement,
 * and persist everything through LiminalFS.
 *
 * Usage:
 *   const hooks = new EmergenceHooks(liminalFs);
 *   const result = await hooks.onCreativeRun({ output, score, ... });
 */

import { BehaviorDescriptorExtractor } from './BehaviorDescriptorExtractor.js';
import { LineageTracker } from './LineageTracker.js';
import { ArchivePlacement } from './ArchivePlacement.js';
import { ArchiveEntriesFSAdapter } from '../fs/adapters/ArchiveEntries.js';
import type { LiminalFS } from '../fs/LiminalFS.js';
import type {
  BehaviorDescriptor,
  LineageRecord,
  EmergenceSignals,
  PlacementResult,
  Provenance,
} from './types.js';
import { Logger } from '../utils/Logger.js';

export interface CreativeRunInput {
  /** The generated output (code, art, etc.) */
  output: string;
  /** Quality score from Evaluation Fabric (0–1) */
  qualityScore: number;
  /** How this artifact was produced */
  provenance: Provenance;
  /** Parent artifact IDs (for remix/branch/dream) */
  parentIds?: string[];
  /** Seed used for generation */
  seed?: string;
  /** Run parameters */
  runParams?: Record<string, unknown>;
  /** Run ID from LiminalFS */
  runId?: string;
  /** Optional metadata for descriptor extraction */
  metadata?: Record<string, unknown>;
}

export interface CreativeRunResult {
  descriptor: BehaviorDescriptor;
  lineage: LineageRecord;
  signals: EmergenceSignals;
  placement: PlacementResult;
}

export class EmergenceHooks {
  private readonly extractor: BehaviorDescriptorExtractor;
  private readonly lineageTracker: LineageTracker;
  private readonly archive: ArchivePlacement;
  private readonly fsAdapter: ArchiveEntriesFSAdapter;

  constructor(
    liminalFs: LiminalFS,
    archiveConfig?: {
      binsPerAxis?: number;
      nearEliteCapacity?: number;
      minQuality?: number;
    },
  ) {
    this.extractor = new BehaviorDescriptorExtractor();
    this.lineageTracker = new LineageTracker();
    this.archive = new ArchivePlacement({
      binsPerAxis: archiveConfig?.binsPerAxis,
      nearEliteCapacity: archiveConfig?.nearEliteCapacity,
      minQuality: archiveConfig?.minQuality,
    });
    this.fsAdapter = new ArchiveEntriesFSAdapter(liminalFs);
  }

  /**
   * Main hook — call after every creative run.
   * Extracts descriptor, records lineage, attempts archive placement,
   * and persists to LiminalFS.
   */
  async onCreativeRun(input: CreativeRunInput): Promise<CreativeRunResult> {
    // 1. Extract behavior descriptor
    const descriptor = this.extractor.extract(input.output, input.metadata);

    // 2. Record lineage
    const lineage = await this.lineageTracker.record({
      parentIds: input.parentIds,
      provenance: input.provenance,
      seed: input.seed,
      runParams: input.runParams,
      runId: input.runId,
    });

    // 3. Compute emergence signals (v1: heuristic from descriptor + quality)
    const signals = this.computeSignals(descriptor, input.qualityScore);

    // 4. Attempt archive placement
    const placeholderRef = {
      uri: `liminal://artifact/${lineage.artifactId}`,
      kind: 'generated-code' as const,
    };

    const placement = this.archive.place({
      artifactRef: placeholderRef,
      descriptor,
      lineage,
      qualityScore: input.qualityScore,
      signals,
    });

    // 5. Persist to LiminalFS if accepted
    if (placement.accepted) {
      const entry = placement.outcome === 'new-cell'
        ? this.archive.getElite(placement.cellId)
        : this.archive.getCell(placement.cellId)?.elite;

      if (entry) {
        this.fsAdapter.writeArchiveEntry(entry);
      }
    }

    Logger.info('EmergenceHooks',
      `${input.provenance} → ${lineage.artifactId} | q=${input.qualityScore.toFixed(2)} | cell=${placement.cellId} | ${placement.outcome}`,
    );

    return { descriptor, lineage, signals, placement };
  }

  /** Get the archive for direct querying (used by CLI and Cortex). */
  getArchive(): ArchivePlacement {
    return this.archive;
  }

  /** Get the lineage tracker for ancestry queries. */
  getLineageTracker(): LineageTracker {
    return this.lineageTracker;
  }

  /** Get the descriptor extractor. */
  getExtractor(): BehaviorDescriptorExtractor {
    return this.extractor;
  }

  /**
   * v1 signal computation — heuristic from descriptor + quality.
   * Phase 14 will replace this with EmergenceCritic ensemble.
   */
  private computeSignals(descriptor: BehaviorDescriptor, qualityScore: number): EmergenceSignals {
    const values = new Map(descriptor.values.map(v => [v.axis, v.value]));

    const orderChaos = values.get('order-chaos') ?? 0.5;
    const sparseDense = values.get('sparse-dense') ?? 0.5;
    const symmetryAsymmetry = values.get('symmetry-asymmetry') ?? 0.5;
    const smoothBursty = values.get('smooth-bursty') ?? 0.5;
    const staticEvolving = values.get('static-evolving') ?? 0.5;
    const harmonicDissonant = values.get('harmonic-dissonant') ?? 0.5;

    // Novelty: high when away from the center of descriptor space
    const novelty = this.distanceFromCenter(descriptor.values);

    // Structure: high when ordered + dense + symmetric
    const structure = ((1 - orderChaos) * 0.4) + (sparseDense * 0.3) + ((1 - symmetryAsymmetry) * 0.3);

    // Temporal richness: high when evolving + bursty
    const temporalRichness = (staticEvolving * 0.5) + (smoothBursty * 0.5);

    // Perturbation resilience: proxy from quality + structure
    const perturbationResilience = (qualityScore * 0.6) + (structure * 0.4);

    // Fertility: high when novel + high quality + diverse descriptors
    const descriptorVariance = this.variance(descriptor.values.map(v => v.value));
    const fertility = (novelty * 0.3) + (qualityScore * 0.3) + (Math.min(1, descriptorVariance * 4) * 0.2) + (temporalRichness * 0.2);

    // Aesthetic: quality score + balance of harmony
    const aesthetic = (qualityScore * 0.7) + ((1 - Math.abs(harmonicDissonant - 0.5) * 2) * 0.3);

    return {
      novelty: Math.min(1, Math.max(0, novelty)),
      structure: Math.min(1, Math.max(0, structure)),
      temporalRichness: Math.min(1, Math.max(0, temporalRichness)),
      perturbationResilience: Math.min(1, Math.max(0, perturbationResilience)),
      fertility: Math.min(1, Math.max(0, fertility)),
      aesthetic: Math.min(1, Math.max(0, aesthetic)),
    };
  }

  private distanceFromCenter(values: Array<{ value: number }>): number {
    if (values.length === 0) return 0.5;
    const sumSq = values.reduce((sum, v) => sum + (v.value - 0.5) ** 2, 0);
    const maxDist = Math.sqrt(values.length * 0.25);
    return Math.sqrt(sumSq) / maxDist;
  }

  private variance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }
}
