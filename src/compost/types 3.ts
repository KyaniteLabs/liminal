/**
 * Compost Mill type definitions.
 */

import type { LIRToken } from '../core/lir/types.js';

/** Digest schedule mode. */
export type DigestSchedule = 'manual' | 'daily' | 'weekly';

/** @deprecated Provider mode is no longer used - use baseUrl directly */
type LLMProviderMode = 'local' | 'cloud' | 'auto';

/** Fragment extraction layer. */
export type FragmentLayer = 'semantic' | 'structured' | 'raw';

/** LLM provider configuration - model agnostic */
export interface LLMProviderConfig {
  /** @deprecated Provider mode is no longer used - use baseUrl directly */
  provider?: LLMProviderMode;
  /** Base URL for the LLM API endpoint */
  baseUrl?: string;
  /** Model name to use */
  model?: string;
  /** API key (if required) */
  apiKey?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** 
   * API style - affects request/response format
   * - 'openai': Standard OpenAI chat completions
   * - 'ollama': Ollama native API
   * - 'anthropic': Anthropic Claude API
   */
  apiStyle?: 'openai' | 'ollama' | 'anthropic';
  /** @deprecated Use baseUrl instead */
  localBaseUrl?: string;
  /** @deprecated Use model instead */
  localModel?: string;
  /** @deprecated Use baseUrl instead */
  cloudBaseUrl?: string;
  /** @deprecated Use apiKey env var directly */
  cloudApiKeyEnvVar?: string;
  /** @deprecated Use model instead */
  cloudModel?: string;
  /** @deprecated Use timeoutMs instead */
  localTimeoutMs?: number;
}

/** Full Compost Mill configuration. */
export interface CompostConfig {
  heapDir: string;
  maxHeapSizeBytes: number;
  digestDir: string;
  seedDir: string;
  digestSchedule: DigestSchedule;
  digestDayOfWeek: number;
  soupEnabled: boolean;
  soupPopulationSize: number;
  soupMaxStepsPerCycle: number;
  soupSeedPromotionThreshold: number;
  soupCycleIntervalMs: number;
  llm: LLMProviderConfig;
  seedPromotionThreshold: number;
  maxSeedsPerDigest: number;
  nuggetRetentionDays: number;
  /** LIR (Large Input Reduction) module configuration. */
  lirEnabled: boolean;
  lirSummaryBudget: number;
  lirBatchSize: number;
  lirMaxSymbolsPerFile: number;
  /** Fitness weights for multi-axis evaluation (novelty/quality/technical/diversity). */
  fitnessWeights?: Partial<import('../evolution/FitnessCombiner.js').FitnessWeights>;
  /** MAP-Elites grid dimensions (default: [10, 10]). */
  mapElitesDims?: number[];
}

/** File-level metadata extracted from the structured layer. */
export interface FragmentMetadata {
  fileType: string;
  timestamp: string;
  hash: string;
  size: number;
  extractedAt: string;
  /** Domain-specific metadata fields. */
  dimensions?: { width: number; height: number };
  format?: string;
  sampleRate?: number;
  bitrate?: number;
  duration?: number;
  channels?: number;
  bpm?: number;
  musicalKey?: string;
  gps?: { lat: number; lon: number };
  aspectRatio?: string;
  exposure?: number;
  iso?: number;
  vertexCount?: number;
  loc?: number;
  language?: string;
}

/** A shredded fragment from the compost heap. */
export interface CompostFragment {
  id: string;
  source: string;
  domain: string;
  layer: FragmentLayer;
  content: string;
  metadata: FragmentMetadata;
  tags: string[];
  score?: number;
}

/** Multi-dimensional fragment score. */
export interface FragmentScore {
  total: number;
  novelty: number;
  density: number;
  crossDomain: number;
  metadataRarity: number;
  connectionStrength: number;
}

/** A promoted seed in the seed bank. */
export interface Seed {
  id: string;
  content: string;
  score: number;
  source: {
    fragments: string[];
    collisionType: string;
    domains: string[];
  };
  promotedAt: string;
  usedBy: string[];
  useCount: number;
  /** Optional LIR token associated with this seed. */
  lir?: LIRToken;
}

/** Persistent soup loop state. */
export interface SoupState {
  population: CompostFragment[];
  generation: number;
  bestSeed: CompostFragment | null;
  totalSeedsPromoted: number;
  domainHeatmap: Record<string, number>;
  lastCycleAt: string;
}

/** Result of a cross-domain collision. */
export interface CollisionResult {
  fragmentA: CompostFragment;
  fragmentB: CompostFragment;
  strategy: string;
  mergedContent: string;
  score?: number;
}

/** Raw byte extraction data. */
export interface RawByteData {
  headerHex: string;
  tailHex: string;
  sha256: string;
  size: number;
  hexChunks: string[];
  base64: string | null;
}

/** Result of extracting a single file through all layers. */
export interface ExtractionResult {
  filePath: string;
  semantic: string | null;
  metadata: FragmentMetadata;
  rawBytes: RawByteData;
  /** Optional LIR tokens extracted from the file. */
  lir?: LIRToken[];
}

/** Digest statistics for a single digestion run. */
export interface DigestStats {
  filesProcessed: number;
  totalBytes: number;
  domains: string[];
  fragmentCount: number;
  collisionCount: number;
  seedsPromoted: number;
  soupCycles: number;
  durationMs: number;
}

/** Result returned by CompostMill.digest(). */
export interface DigestResult {
  stats: DigestStats;
  seeds: Seed[];
  digestPath: string;
}

/** Current mill status. */
export interface MillStatus {
  heapSize: number;
  heapFileCount: number;
  seedCount: number;
  soupRunning: boolean;
  soupGeneration: number;
  lastDigestAt: string | null;
}

/** Semantic extraction input. */
export interface SemanticInput {
  content: string;
  filePath: string;
  fileType: string;
}

/** Collision pair for the collision engine. */
export interface CollisionPair {
  a: CompostFragment;
  b: CompostFragment;
  strategy: string;
}
