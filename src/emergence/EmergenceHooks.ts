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
import { EmergenceCritic } from './EmergenceCritic.js';
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
  private readonly critic: EmergenceCritic;
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
    this.critic = new EmergenceCritic();
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

    // 3. Compute emergence signals via EmergenceCritic ensemble
    const signals = this.computeSignals(descriptor, input.qualityScore, input.output);

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
   * Signal computation via EmergenceCritic ensemble.
   * Uses quick evaluation for high-throughput creative runs.
   */
  private computeSignals(descriptor: BehaviorDescriptor, qualityScore: number, output: string): EmergenceSignals {
    const archive = this.archive.getAllElites();
    const result = this.critic.evaluateQuick({
      descriptor,
      qualityScore,
      archive,
      output,
    });
    return result.signals;
  }

  /** Get the EmergenceCritic for direct evaluation. */
  getCritic(): EmergenceCritic {
    return this.critic;
  }
}
