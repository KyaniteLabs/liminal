/**
 * LoopConfig - Configuration types and normalization for RalphLoop
 *
 * Extracted from RalphLoop.ts. Contains all interfaces, types,
 * defaults, and the normalizeOptions function.
 */

import { MapElites } from '../evolution/MapElites.js';
import { NoveltyArchive } from '../evolution/NoveltyArchive.js';
import type { EvaluationStrategy } from './ScoringEngine.js';
import type { SafetyConfig } from './SafetyGuardrails.js';
import type { CollaborationMode } from '../collab/CollaborationEngine.js';
import type { DeepCollaborationConfig, CollaborativeConfig } from '../collab/types.js';
import { Domain } from '../types/domains.js';
import type { SwarmConfig, SwarmMode } from '../swarm/types.js';
import type { SwarmOptions } from '../types/options/SwarmOptions.js';
import { type DebugOptions, normalizeDebugOptions } from '../types/options/DebugOptions.js';
import { type RenderOptions, normalizeRenderOptions } from '../types/options/RenderOptions.js';

export const DEFAULT_MAX_ITERATIONS = 20;
export const DEFAULT_TIMEOUT_MINUTES = 30;
export const DEFAULT_MIN_QUALITY_SCORE = 0.7;

export interface LoopOptions {
  maxIterations?: number;
  timeoutMinutes?: number;
  galleryDir?: string;
  project?: string;
  tolerateErrors?: boolean;
  minQualityScore?: number;
  /** Domain-specific minimum quality scores - override minQualityScore for specific domains */
  domainQualityThresholds?: Record<string, number>;
  /** 'p5' (default) or 'organism' (generateMusicToVisual + saveOrganism per iteration) */
  mode?: 'p5' | 'organism';
  /** Optional traits for organism mode (bpm, palette) */
  traits?: { bpm?: number; palette?: string };
  /** Optional seed code for iteration 1: "improve this toward [prompt]" */
  seedCode?: string;
  /** Optional seed template name or content for iteration 1 */
  seedTemplate?: string;
  /** Max characters of context to inject (truncation). PRD: Context bloat. */
  maxContextLength?: number;
  /** Include only last K iterations in context (default: all in history up to maxContextLength) */
  lastKIterations?: number;
  /** Optional evaluation criteria (e.g. ["aesthetic", "technical", "novelty"]). When provided, passed to ScoringEngine.score(). */
  evaluationCriteria?: string[];
  /** Evaluation strategy to use (default: 'detailed') */
  evaluationStrategy?: EvaluationStrategy;
  /** Progress callback: called after each iteration with iteration number, score, promiseDetected, code, timestamp */
  onProgress?: (data: { iteration: number; score: number; promiseDetected: boolean; code: string; timestamp: string }) => void;
  /** Optional AbortSignal to stop the loop (checked at start of each iteration) */
  signal?: AbortSignal;
  /** When set (e.g. 2), every N-th iteration is a merge step: take two from history, produce proposed, call onMergeStep. */
  mergeEveryN?: number;
  /** Called when a merge step runs: (codeA, codeB, proposed) from last two in history. */
  onMergeStep?: (data: { codeA: string; codeB: string; proposed: string }) => void;
  /** Enable MAP-Elites quality-diversity optimization */
  useMapElites?: boolean;
  /** MAP-Elites grid dimensions (default [10, 10]) */
  mapElitesDims?: [number, number];
  /** Safety guardrails configuration */
  safetyConfig?: SafetyConfig;
  /** Break loop if no fitness improvement for this many iterations (default 7, 0 = disabled) */
  stagnationThreshold?: number;
  /** Enable deep collaboration (multi-model specialized roles) */
  useDeepCollab?: boolean;
  /** Enable simple 2-model collaboration */
  useCollab?: boolean;
  /** Use CollaborationEngine instead of raw DeepCollaboration/CollaborativeClient */
  collabMode?: CollaborationMode;
  /** Configuration for collaboration (merged with defaults) */
  collabConfig?: Partial<DeepCollaborationConfig & CollaborativeConfig>;
  /** Domain for collaboration quality assessment (default: 'p5') */
  collabDomain?: Domain;
  /** Enable swarm generation (7-persona Ollama swarm) */
  /** @deprecated Use swarm.enabled instead */
  useSwarm?: boolean;
  /** Configuration for the swarm */
  /** @deprecated Use swarm.config instead */
  swarmConfig?: Partial<SwarmConfig>;
  /** Swarm generative mode (default: 'hybrid') */
  /** @deprecated Use swarm.mode instead */
  swarmMode?: SwarmMode;
  /** New nested swarm options (preferred over deprecated flat properties) */
  swarm?: SwarmOptions;
  /** Enable archive learning — store high-quality outputs for few-shot improvement */
  useArchiveLearning?: boolean;
  /** Path for quality archive JSON (default: ~/.liminal/archive/quality_archive.json) */
  archivePath?: string;
  /** Enable aesthetic model — predict quality based on behavior vectors */
  useAestheticModel?: boolean;
  /** Auto-feed quality outputs to compost heap and trigger digest when full */
  autoCompost?: boolean;
  /** Enable chat mode - provides callbacks for real-time UI updates */
  chatMode?: boolean;
  /** Callback called after each iteration with full iteration context */
  onIteration?: (iteration: IterationContext) => void;
  /** Callback called with thought strings during generation for chat display */
  onThought?: (thought: string) => void;
  /** Callback called with suggestions during generation */
  onSuggestion?: (suggestion: any) => void;
  /** Guidance engine for proactive suggestions during generation */
  guidanceEngine?: any;
  /** Enable aesthetic guardrails in the quality gate */
  useAestheticGuardrails?: boolean;
  /** Enable intuition-based quality scoring from compressed experience */
  useIntuition?: boolean;
  /** Configuration for aesthetic critics */
  aestheticConfig?: { preset?: string; strictness?: 'lenient' | 'moderate' | 'strict'; constraints?: Record<string, unknown> };
  /** Audio-derived visual parameters for prompt injection */
  visualMappingParams?: Record<string, unknown>;
  /** Path to audio file for voice-driven visual mapping. Analyzed by AudioAnalyzer to produce visualMappingParams. */
  voiceFile?: string;
  /** Enable voice-driven visual mapping (microphone input, not file-based). Requires voiceFile OR runtime audio capture. */
  voice?: boolean;
  /** Enable LIR-based evaluation — parses generated code into structured tokens for critics and evaluator */
  lirEnabled?: boolean;
  /** Disable iteration extension (for testing). When true, maxIteration is strictly enforced. */
  _disableIterationExtension?: boolean;
  /** Debug and diagnostics configuration */
  debug?: DebugOptions;
  /** Render options for canvas output, recording, and preview server */
  render?: RenderOptions;
  /** Number of candidates to generate per iteration (Best-of-N). Default: 1 (disabled) */
  numCandidates?: number;
  /** Enable render-based scoring - renders code in headless browser and scores visual/audio output */
  useRenderScoring?: boolean;
  /** Options for render-based scoring pipeline */
  renderScoringOptions?: import('../render/RenderAndScorePipeline.js').PipelineOptions;
}

export interface LoopResult {
  code: string;
  iterations: number;
  completed: boolean;
  reason: string;
  timestamp: string;
  duration: number;
  finalScore: number;
  project?: string;
  thinking?: string;
  model?: string;
}

export interface IterationContext {
  iteration: number;
  prompt: string;
  usedPrompt: string;
  code: string;
  evaluation: { score: number; issues: string[]; [key: string]: unknown };
  timestamp: string;
  maxIterations?: number;
  /** Best-of-N: which candidate index was selected (0 = first, if N=1 this is always 0) */
  selectedCandidateIndex?: number;
  /** Best-of-N: total number of candidates generated this iteration */
  numCandidatesGenerated?: number;
}

export interface NormalizedLoopOptions extends LoopOptions {
  maxIterations: number;
  timeoutMinutes: number;
  galleryDir: string;
  project: string;
  tolerateErrors: boolean;
  minQualityScore: number;
  domainQualityThresholds: Record<string, number>;
  useMapElites: boolean;
  mapElitesDims: [number, number];
  safetyConfig: SafetyConfig | undefined;
  _mapElites?: MapElites;
  _noveltyArchive?: NoveltyArchive;
  useDeepCollab: boolean;
  useCollab: boolean;
  collabConfig: Partial<DeepCollaborationConfig & CollaborativeConfig>;
  collabDomain: Domain;
  useSwarm: boolean;
  swarmConfig: Partial<SwarmConfig>;
  swarmMode: SwarmMode;
  chatMode: boolean;
  onIteration?: (iteration: IterationContext) => void;
  onThought?: (thought: string) => void;
  onSuggestion?: (suggestion: any) => void;
  guidanceEngine?: any;
  useAestheticGuardrails: boolean;
  useIntuition: boolean;
  aestheticConfig: Record<string, unknown>;
  visualMappingParams?: Record<string, unknown>;
  voiceFile?: string;
  voice?: boolean;
  lirEnabled: boolean;
  _disableIterationExtension: boolean;
  debug: Required<DebugOptions>;
  render: Required<NonNullable<RenderOptions>>;
}

/**
 * Normalize loop options with defaults
 */
export function normalizeOptions(options: LoopOptions | null): NormalizedLoopOptions {
  // NOTE: Coverage is enforced at compile time — NormalizedLoopOptions has all-required
  // fields, so TypeScript flags any property missing from the return object.
  return {
    maxIterations: options?.maxIterations || DEFAULT_MAX_ITERATIONS,
    timeoutMinutes: options?.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES,
    galleryDir: options?.galleryDir || 'gallery',
    project: options?.project || `project-${Date.now()}`,
    tolerateErrors: options?.tolerateErrors ?? false,
    minQualityScore: options?.minQualityScore ?? DEFAULT_MIN_QUALITY_SCORE,
    domainQualityThresholds: options?.domainQualityThresholds ?? {
      'ascii': 0.5,    // ASCII art has different quality criteria
      'music': 0.5,    // Music generation is more subjective
      'visual': 0.6,   // Visual art (Hydra) slightly lower threshold
    },
    mode: options?.mode ?? 'p5',
    traits: options?.traits,
    mergeEveryN: options?.mergeEveryN,
    onMergeStep: options?.onMergeStep,
    seedCode: options?.seedCode,
    seedTemplate: options?.seedTemplate,
    maxContextLength: options?.maxContextLength,
    lastKIterations: options?.lastKIterations,
    evaluationCriteria: options?.evaluationCriteria,
    evaluationStrategy: options?.evaluationStrategy,
    onProgress: options?.onProgress,
    signal: options?.signal,
    useMapElites: options?.useMapElites ?? false,
    mapElitesDims: options?.mapElitesDims ?? [10, 10],
    safetyConfig: options?.safetyConfig,
    stagnationThreshold: options?.stagnationThreshold ?? 7,
    useDeepCollab: options?.useDeepCollab ?? false,
    useCollab: options?.useCollab ?? false,
    collabConfig: options?.collabConfig || {},
    collabMode: options?.collabMode,
    collabDomain: options?.collabDomain || Domain.P5,
    useSwarm: options?.useSwarm ?? false,
    swarmConfig: options?.swarmConfig || {},
    swarmMode: options?.swarmMode ?? ('hybrid' as SwarmMode),
    useArchiveLearning: options?.useArchiveLearning ?? false,
    archivePath: options?.archivePath,
    useAestheticModel: options?.useAestheticModel ?? false,
    autoCompost: options?.autoCompost ?? false,
    chatMode: options?.chatMode ?? false,
    onIteration: options?.onIteration,
    onThought: options?.onThought,
    onSuggestion: options?.onSuggestion,
    guidanceEngine: options?.guidanceEngine,
    useAestheticGuardrails: options?.useAestheticGuardrails ?? false,
    useIntuition: options?.useIntuition ?? false,
    aestheticConfig: (options?.aestheticConfig ?? {}) as Record<string, unknown>,
    visualMappingParams: options?.visualMappingParams,
    voiceFile: options?.voiceFile,
    voice: options?.voice,
    lirEnabled: options?.lirEnabled ?? false,
    _disableIterationExtension: options?._disableIterationExtension ?? false,
    _mapElites: options?.useMapElites ? new MapElites(options?.mapElitesDims ?? [10, 10]) : undefined,
    _noveltyArchive: options?.useMapElites ? new NoveltyArchive() : undefined,
    debug: normalizeDebugOptions(options?.debug),
    render: normalizeRenderOptions(options?.render),
    numCandidates: Math.max(1, options?.numCandidates ?? 1),
    useRenderScoring: options?.useRenderScoring ?? false,
    renderScoringOptions: options?.renderScoringOptions ?? {},
  };
}
