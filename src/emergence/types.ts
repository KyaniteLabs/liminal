/**
 * Emergence types — Phase 13E
 *
 * Core interfaces for the quality-diversity archive, behavior descriptors,
 * lineage tracking, and emergence signals. These form the foundation for
 * Liminal's transition from "best candidate wins" to creative search.
 */

import type { LiminalObjectRef } from '../fs/types.js';

// ── Behavior Descriptors ──

/** Named axis in behavior descriptor space. Each axis is a continuous 0–1 scale. */
export type DescriptorAxis =
  | 'order-chaos'       // structured ↔ stochastic
  | 'sparse-dense'      // minimal ↔ maximal
  | 'symmetry-asymmetry'
  | 'smooth-bursty'     // gradual ↔ sudden transitions
  | 'static-evolving'   // fixed ↔ time-varying
  | 'harmonic-dissonant';

/** A single behavior descriptor value on a named axis. */
export interface DescriptorValue {
  axis: DescriptorAxis;
  value: number; // 0–1
}

/** Full behavior descriptor vector for an artifact. */
export interface BehaviorDescriptor {
  values: DescriptorValue[];
  /** Which extractor produced this (e.g., 'heuristic-v1', 'llm-v1') */
  source: string;
  extractedAt: string;
}

// ── Lineage ──

/** How an artifact was produced. */
export type Provenance =
  | 'fresh-generation'
  | 'remix'
  | 'compost-promotion'
  | 'dream-recombination'
  | 'branch'
  | 'mutation'
  | 'perturbation-probe';

/** Record of an artifact's creative ancestry. */
export interface LineageRecord {
  artifactId: string;
  /** Parent artifact IDs (empty for fresh generation) */
  parentIds: string[];
  provenance: Provenance;
  /** Seed / params used to produce this artifact */
  seed?: string;
  params?: Record<string, unknown>;
  /** The run that produced this artifact */
  runId?: string;
  createdAt: string;
}

// ── Archive ──

/** A cell in the quality-diversity archive, addressed by descriptor coordinates. */
export interface ArchiveCell {
  /** Composite key from descriptor axis values (e.g., 'order-chaos:0.3|sparse-dense:0.7') */
  cellId: string;
  /** Descriptor coordinates defining this cell's boundaries */
  coordinates: DescriptorValue[];
  /** The current elite artifact ref in this cell */
  elite?: ArchiveEntry;
  /** Near-elite artifacts kept for diversity */
  nearElites: ArchiveEntry[];
  /** Max occupants per cell */
  capacity: number;
}

/** An artifact entry stored in the archive. */
export interface ArchiveEntry {
  id: string;
  /** Ref to the actual artifact in LiminalFS */
  artifactRef: LiminalObjectRef;
  /** Behavior descriptor vector */
  descriptor: BehaviorDescriptor;
  /** Lineage metadata */
  lineage: LineageRecord;
  /** Quality score from Evaluation Fabric (0–1) */
  qualityScore: number;
  /** Emergence signal scores */
  signals: EmergenceSignals;
  /** User preference data (if any) */
  preference?: PreferenceRecord;
  /** ISO timestamp when added to archive */
  archivedAt: string;
}

// ── Emergence Signals ──

/** Multi-axis emergence evaluation. Kept as separate signals, not collapsed to scalar early. */
export interface EmergenceSignals {
  /** How novel vs. archive history (0 = duplicate, 1 = totally novel) */
  novelty: number;
  /** Multi-scale structure richness (0 = flat, 1 = rich fractal structure) */
  structure: number;
  /** Temporal phase richness (0 = monotone, 1 = rich phase changes) */
  temporalRichness: number;
  /** Resilience to perturbation (0 = brittle, 1 = robust emergence) */
  perturbationResilience: number;
  /** How many strong descendants this could produce (0 = dead-end, 1 = highly fertile) */
  fertility: number;
  /** Aesthetic value from critics (0 = poor, 1 = excellent) */
  aesthetic: number;
}

// ── Preference ──

/** Types of user preference actions. */
export type PreferenceAction =
  | 'pin'
  | 'favorite'
  | 'branch'
  | 'compost'
  | 'more-like-this'
  | 'less-like-this'
  | 'pairwise-a'
  | 'pairwise-b'
  | 'reject';

/** A single preference event captured from user interaction. */
export interface PreferenceRecord {
  action: PreferenceAction;
  artifactId: string;
  /** For pairwise: the other artifact in the comparison */
  comparedTo?: string;
  /** Session this action occurred in */
  sessionId?: string;
  /** ISO timestamp */
  capturedAt: string;
}

// ── Archive Placement ──

/** Result of attempting to place an artifact into the archive. */
export interface PlacementResult {
  accepted: boolean;
  cellId: string;
  /** 'new-cell' = created new cell, 'replaced-elite' = beat current elite, 'near-elite' = added to near-elites, 'rejected' = not good enough */
  outcome: 'new-cell' | 'replaced-elite' | 'near-elite' | 'rejected';
  /** The artifact that was displaced (if any) */
  displaced?: ArchiveEntry;
}

// ── Cortex Replay ──

/** Types of tasks Cortex can schedule for creative search. */
export type CreativeTaskType =
  | 'fresh-exploration'
  | 'replay-promising'
  | 'branch-from-pinned'
  | 'compost-resurrection'
  | 'dream-recombination'
  | 'perturbation-probe';

/** Budget allocation between replay and fresh exploration. */
export interface ReplayBudget {
  /** Fraction of budget for replay/branch tasks (0–1, rest is fresh exploration) */
  replayRatio: number;
  /** Total actions allowed per cycle */
  actionsPerCycle: number;
  /** Max consecutive replay tasks before forcing exploration */
  maxConsecutiveReplay: number;
}

/** A promising state selected for replay or branching. */
export interface PromisingState {
  entry: ArchiveEntry;
  /** Why this was selected */
  reason: 'high-fertility' | 'user-pinned' | 'unexplored-niche' | 'stagnant-lineage';
  /** Score indicating how promising (0–1) */
  promiseScore: number;
}
