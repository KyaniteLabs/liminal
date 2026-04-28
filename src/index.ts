/**
 * Liminal - Creative Coding Agent
 *
 * Main entry point for the creative coding agent with internal Ralph-Wiggum Loop
 * for generating emergent generative art.
 */

// Core Ralph-Wiggum Loop components
import { RalphLoop } from './core/RalphLoop.js';
import { ValidationError } from './errors/ValidationError.js';
import { GenerationError } from './errors/GenerationError.js';
import { CodeValidator } from './core/CodeValidator.js';
import { CreativeEvaluator } from './core/CreativeEvaluator.js';
import { PromiseDetector } from './core/PromiseDetector.js';
import { PromptStore } from './core/PromptStore.js';
import { ContextAccumulation } from './core/ContextAccumulation.js';

// Core shared types
import type { CreativeFragment, FragmentOrigin } from './core/types.js';
import {
  seedToFragment,
  compostFragmentToFragment,
  minedFragmentToFragment,
  scavengerToFragment,
  isFromOrigin,
} from './core/types.js';

import { promptToGeneratorParams } from './utils/promptToGeneratorParams.js';
import { validatePrompt } from './utils/validation.js';
import { P5Generator } from './generators/p5/P5Generator.js';
import { ParticleSystem } from './generators/p5/ParticleSystem.js';
import { CellularAutomata } from './generators/p5/CellularAutomata.js';
import { FlowField } from './generators/p5/FlowField.js';
import { noise2D, noise3D, noiseSeed, flowField } from './generators/p5/Noise.js';

import { P5GeneratorLLM } from './generators/p5/P5GeneratorLLM.js';

// HTML Web Generator & ASCII Art Generator (imported for type exports only)
import type { HTMLGeneratorOptions as _HTMLGeneratorOptions } from './generators/html/HTMLWebGenerator.js';
import type { ASCIIOptions as _ASCIIOptions, ASCIIStyle as _ASCIIStyle } from './generators/ascii/ASCIIArtGenerator.js';

// Rendering and export
import { Renderer } from './render/Renderer.js';
import { PreviewServer } from './render/PreviewServer.js';
import { Exporter, type Project } from './export/Exporter.js';
import { Gallery, type Iteration } from './gallery/Gallery.js';
import { SeedArchive, type SeedMetadata } from './gallery/SeedArchive.js';
import { MapElites } from './evolution/MapElites.js';
import { NoveltyArchive } from './evolution/NoveltyArchive.js';
import { extractBehavior, detectDomain } from './evolution/BehaviorVectors.js';
import { AestheticModel } from './evolution/AestheticModel.js';
import { MetaMode } from './evolution/MetaMode.js';
import { SafetyGuardrails } from './core/SafetyGuardrails.js';
import { FeedbackQueue } from './gallery/FeedbackQueue.js';
import { metaHarness } from './harness/MetaHarnessIntegration.js';
import { validateLLMConfig } from './config/schema.js';
import { generateVisuals } from './generateVisuals.js';
import { generateMusicToVisual } from './musicToVisual/generateMusicToVisual.js';
import { generateMusic } from './music/generateMusic.js';

import fs from 'fs/promises';
import path from 'path';
import { normalizePath, assertSafeSegment } from './utils/normalizePath.js';
import { SERVICE_DEFAULTS } from './constants.js';

export const LIMINAL_VERSION = '2.1.0';

export interface LiminalConfig {
  name: string;
  version: string;
  loop: {
    maxIterations: number;
    timeoutMinutes: number;
    completionPromise: string;
  };
  creative: {
    defaultFramework: 'p5.js';
    evaluationCriteria: string[];
    minQualityScore: number;
  };
  gallery: {
    autoSave: boolean;
    maxHistoryPerProject: number;
  };
  renderer: {
    port: number;
    screenshotOnIteration: boolean;
  };
}

export const defaultConfig: LiminalConfig = {
  name: 'liminal',
  version: LIMINAL_VERSION,
  loop: {
    maxIterations: 20,
    timeoutMinutes: 30,
    completionPromise: 'COMPLETE',
  },
  creative: {
    defaultFramework: 'p5.js',
    evaluationCriteria: ['aesthetic', 'technical', 'novelty'],
    minQualityScore: 0.7,
  },
  gallery: {
    autoSave: true,
    maxHistoryPerProject: 50,
  },
  renderer: {
    port: SERVICE_DEFAULTS.PREVIEW_PORT,
    screenshotOnIteration: true,
  },
};

export function getSourceFileExtension(code: string): 'js' | 'svg' {
  return CodeValidator.detectDomain(code) === 'svg' ? 'svg' : 'js';
}

/**
 * Main run function for Liminal
 *
 * @param prompt - The creative prompt to generate from
 * @param options - Configuration options
 * @returns Result object with code, iterations, metadata
 */
export async function run(prompt: string, options: {
  maxIterations?: number;
  timeoutMinutes?: number;
  output?: string;
  project?: string;
  minQualityScore?: number;
  galleryDir?: string;
  seedCode?: string;
  seedTemplate?: string;
  tolerateErrors?: boolean;
  /** Optional creative options; when provided, evaluationCriteria is passed to RalphLoop and CreativeEvaluator. */
  creativeOptions?: { evaluationCriteria?: string[] };
  /** Progress callback: iteration number, score, promiseDetected, code, timestamp (streaming progress) */
  onProgress?: (data: { iteration: number; score: number; promiseDetected: boolean; code: string; timestamp: string }) => void;
  /** Optional AbortSignal to stop the run (Stop button) */
  signal?: AbortSignal;
  /** Enable swarm generation */
  /** @deprecated Use swarm.enabled instead */
  useSwarm?: boolean;
  /** Swarm generative mode */
  /** @deprecated Use swarm.mode instead */
  swarmMode?: string;
  /** Swarm configuration overrides */
  /** @deprecated Use swarm.config instead */
  swarmConfig?: Record<string, unknown>;
  /** New nested swarm options (preferred) */
  swarm?: import('./types/options/SwarmOptions.js').SwarmOptions;
  /** Enable intuition-based quality scoring dimension */
  useIntuition?: boolean;
} = {}): Promise<{
  code: string;
  iterations: number;
  completed: boolean;
  reason: string;
  timestamp: string;
  duration: number;
  finalScore: number;
  project?: string;
  outputDir: string;
  prompt: string;
  htmlPath?: string;
  sourcePath?: string;
  jsPath?: string;
  zipPath?: string;
  thinking?: string;
  model?: string;
}> {
  const startTime = Date.now();

  const {
    maxIterations = 20,
    timeoutMinutes = 30,
    output = './output',
    project = 'default',
    minQualityScore = 0.7,
    galleryDir = 'gallery',
    seedCode,
    seedTemplate,
    tolerateErrors = false,
    creativeOptions,
    onProgress,
    signal
  } = options;

  const evaluationCriteria = creativeOptions?.evaluationCriteria ?? defaultConfig.creative.evaluationCriteria;

  try {
    // Validate config early
    const rawConfig = {
      baseUrl: process.env.LIMINAL_LLM_BASE_URL,
      apiKey: process.env.LIMINAL_LLM_API_KEY || process.env.OPENAI_API_KEY,
      model: process.env.LIMINAL_LLM_MODEL,
    };
    validateLLMConfig(rawConfig); // Fail fast on bad config

    // Validate input
    validatePrompt(prompt);

    const cwd = process.cwd();
    const outputResolved = normalizePath(cwd, output);
    const galleryDirResolved = normalizePath(cwd, galleryDir);
    assertSafeSegment(project, 'Project name');

    // Create output directory if it doesn't exist
    await fs.mkdir(outputResolved, { recursive: true });

    // Run the Ralph-Wiggum Loop with all sophisticated components
    const loopResult = await RalphLoop.run(prompt, {
      maxIterations,
      timeoutMinutes,
      galleryDir: galleryDirResolved,
      project,
      tolerateErrors,
      minQualityScore,
      seedCode,
      seedTemplate,
      evaluationCriteria,
      onProgress,
      signal,
      swarm: options.swarm,
      // Legacy flat properties (deprecated, use swarm instead)
      useSwarm: options.useSwarm,
      swarmMode: options.swarmMode as import('./swarm/types.js').SwarmMode,
      swarmConfig: options.swarmConfig as Partial<import('./swarm/types.js').SwarmConfig>,
      useIntuition: options.useIntuition,
    });

    // Initialize Exporter
    const exporter = new Exporter();

    // Final validation gate before saving
    const finalValidation = CodeValidator.validate(loopResult.code);
    if (!finalValidation.valid) {
      throw new ValidationError('Generation failed validation', finalValidation.errors, {
          reason: loopResult.reason
        });
    }
    const finalCode = finalValidation.cleanedCode;

    // Export final code as HTML
    const htmlPath = path.join(outputResolved, `${project}-final.html`);
    await exporter.exportHTML(finalCode, htmlPath);

    // Export final source with the right extension for non-JS artifact types.
    const sourcePath = path.join(outputResolved, `${project}-final.${getSourceFileExtension(finalCode)}`);
    if (sourcePath.endsWith('.svg')) {
      await fs.writeFile(sourcePath, finalCode, 'utf-8');
    } else {
      await exporter.exportJS(finalCode, sourcePath);
    }

    // Load project history from gallery for ZIP export
    const gallery = new Gallery(galleryDirResolved);
    let zipPath: string | undefined;

    try {
      const history = await gallery.loadHistory(project);

      // Create project object for ZIP export (p5 code or organism as JSON string)
      const projectData: Project = {
        name: project,
        iterations: history.map((iter, index) => {
          const code = 'code' in iter && iter.code != null
            ? iter.code
            : JSON.stringify({
                type: 'organism',
                musicCode: (iter as { musicCode: string; visualCode: string }).musicCode,
                visualCode: (iter as { musicCode: string; visualCode: string }).visualCode,
              });
          return {
            version: index + 1,
            code,
            timestamp: iter.timestamp
          };
        })
      };

      // Export as ZIP
      zipPath = path.join(outputResolved, `${project}-archive.zip`);
      await exporter.exportZIP(projectData, zipPath);
    } catch (error) {
      // If gallery loading fails, create a simple ZIP with just the final code
      const simpleProject: Project = {
        name: project,
        iterations: [
          {
            version: 1,
            code: loopResult.code,
            timestamp: loopResult.timestamp
          }
        ]
      };

      zipPath = path.join(outputResolved, `${project}-archive.zip`);
      await exporter.exportZIP(simpleProject, zipPath);
    }

    const duration = Date.now() - startTime;

    // Report SUCCESS to Meta-Harness for analysis
    // NOTE: RalphLoop already reports with thinking, but we also report here
    // to ensure the top-level run() result is captured
    if (process.env.NODE_ENV !== 'test') {
      await metaHarness.onGenerationComplete({
        success: true,
        model: loopResult.model || 'local',
        domain: 'unknown', // Generators report their own domain with thinking
        prompt: prompt,
        code: loopResult.code,
        duration: duration,
        thinking: loopResult.thinking,
      });
    }

    return {
      code: loopResult.code,
      iterations: loopResult.iterations,
      completed: loopResult.completed,
      reason: loopResult.reason,
      timestamp: loopResult.timestamp,
      duration,
      finalScore: loopResult.finalScore,
      project: loopResult.project,
      outputDir: outputResolved,
      prompt,
      htmlPath,
      sourcePath,
      jsPath: sourcePath,
      zipPath,
      thinking: loopResult.thinking,
      model: loopResult.model,
    };

  } catch (error) {
    // Report ERROR to Meta-Harness
    if (process.env.NODE_ENV !== 'test') {
      await metaHarness.onGenerationComplete({
        success: false,
        model: 'local',
        domain: 'unknown', // Generators report their own domain with thinking
        prompt: prompt,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
    throw new GenerationError(
        `Liminal run failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unknown',
        {},
        error instanceof Error ? error : undefined
      );
  }
}

/**
 * Convenience function to run Liminal with CLI-style arguments
 *
 * @param args - Command line arguments
 * @returns Result object
 */
export async function runFromArgs(args: {
  prompt: string;
  maxIterations?: number;
  output?: string;
  project?: string;
}) {
  const {
    prompt,
    maxIterations = 20,
    output = './output',
    project = 'default'
  } = args;

  return run(prompt, {
    maxIterations,
    output,
    project
  });
}

/**
 * Main Liminal class - entry point for the creative coding agent
 */
export class Liminal {
  private config: LiminalConfig;

  constructor(config: Partial<LiminalConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  getConfig(): LiminalConfig {
    return this.config;
  }

  /**
   * Run the Ralph-Wiggum Loop with the configured settings
   */
  async run(prompt: string, options?: {
    maxIterations?: number;
    timeoutMinutes?: number;
    output?: string;
    project?: string;
    minQualityScore?: number;
    tolerateErrors?: boolean;
    creativeOptions?: { evaluationCriteria?: string[] };
  }) {
    return run(prompt, {
      ...options,
      maxIterations: options?.maxIterations || this.config.loop.maxIterations,
      timeoutMinutes: options?.timeoutMinutes || this.config.loop.timeoutMinutes,
      minQualityScore: options?.minQualityScore || this.config.creative.minQualityScore,
      creativeOptions: options?.creativeOptions ?? { evaluationCriteria: this.config.creative.evaluationCriteria }
    });
  }
}

// ============================================================================
// CORE COMPONENT EXPORTS - Programmatic Access
// ============================================================================

// Core Ralph-Wiggum Loop Engine
export { RalphLoop };
export { normalizeOptions, DEFAULT_MAX_ITERATIONS, DEFAULT_TIMEOUT_MINUTES, DEFAULT_MIN_QUALITY_SCORE } from './core/LoopConfig.js';
export type { LoopOptions, LoopResult, IterationContext, NormalizedLoopOptions } from './core/LoopConfig.js';

// Options types (Render, Swarm, Debug)
export type { RenderOptions, RecordingOptions, PreviewOptions, CanvasDimensions, RecordingFormat } from './types/options/RenderOptions.js';
export { DEFAULT_RENDER_OPTIONS, normalizeRenderOptions } from './types/options/RenderOptions.js';
export type { SwarmOptions } from './types/options/SwarmOptions.js';
export type { DebugOptions } from './types/options/DebugOptions.js';
import { requestImprovement } from './core/SelfImprovement.js';
export { requestImprovement, type ImprovementContext, type RequestImprovementOptions, type ImprovementGenerator } from './core/SelfImprovement.js';
export type { RequestImprovementState } from './improvement/requestImprovement.js';

// Creative Evaluation and Quality Control
export { CreativeEvaluator };
export { ScoringEngine } from './core/ScoringEngine.js';
export type { ScoringResult, ScoringInput, ScoringStrategy, ScoreDimension, EvaluationResult, EvaluationStrategy, EvaluationContext } from './core/ScoringEngine.js';

// Promise Detection for Loop Termination
export { PromiseDetector };

// Prompt Management
export { PromptStore };

// Context and State Management
export { ContextAccumulation };

// Core shared types and conversions
export type { CreativeFragment, FragmentOrigin };
export { seedToFragment, compostFragmentToFragment, minedFragmentToFragment, scavengerToFragment, isFromOrigin };

// p5.js Generators
export { P5Generator };
export { ParticleSystem };
export { CellularAutomata };
export { FlowField };
export { promptToGeneratorParams };

// Noise utilities
export { noise2D, noise3D, noiseSeed, flowField };

// Rendering and Preview
export { Renderer };
export { PreviewServer };

// Export and Persistence
export { Exporter, type Project };

// Gallery and Seed Management
export { Gallery, type Iteration };
export type { OrganismIteration, GalleryIteration } from './gallery/Gallery.js';
export { SeedArchive, type SeedMetadata };


// Evolution: MAP-Elites, Novelty, Behavior Vectors, Aesthetic Model, Meta Mode
export { MapElites } from './evolution/MapElites.js';
export type { MapElitesCell } from './evolution/MapElites.js';
export { NoveltyArchive } from './evolution/NoveltyArchive.js';
export { extractBehavior, detectDomain } from './evolution/BehaviorVectors.js';
export type { Domain } from './evolution/BehaviorVectors.js';
/** @library Public API — not wired into RalphLoop */
export { AestheticModel } from './evolution/AestheticModel.js';
export type { AestheticDataPoint } from './evolution/AestheticModel.js';
/** @library Public API — not wired into RalphLoop */
export { MetaMode } from './evolution/MetaMode.js';
export type { Experiment } from './evolution/MetaMode.js';
/** @library Public API — creative variation generator */
export { generateFiveVariations } from './evolution/IGA.js';
/** @library Public API — cross-domain technique transfer */
export { crossoverReasoning, combineReasoning } from './evolution/CrossDomainCrossover.js';

// Safety Guardrails
export { SafetyGuardrails } from './core/SafetyGuardrails.js';
export type { SafetyConfig } from './core/SafetyGuardrails.js';

// Feedback Queue
export { FeedbackQueue } from './gallery/FeedbackQueue.js';
export type { Feedback } from './gallery/FeedbackQueue.js';

// Music generation API
export { generateMusic };
export type { GenerateMusicOptions, GenerateMusicResult } from './music/generateMusic.js';

// generateVisuals API (hydra-synth / p5 reactive visuals)
export { generateVisuals, type GenerateVisualsOptions, type GenerateVisualsResult } from './generateVisuals.js';

// Music-to-visual bridge
export {
  generateMusicToVisual,
  type GenerateMusicToVisualOptions,
  type GenerateMusicToVisualResult,
  type AudioInput,
} from './musicToVisual/generateMusicToVisual.js';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Main functions
  run,
  runFromArgs,

  // Main class
  Liminal,

  // Core components
  RalphLoop,
  requestImprovement,
  CreativeEvaluator,
  PromiseDetector,
  PromptStore,
  ContextAccumulation,
  seedToFragment,
  compostFragmentToFragment,
  minedFragmentToFragment,
  scavengerToFragment,
  isFromOrigin,

  // Generators
  P5Generator,
  ParticleSystem,
  CellularAutomata,
  FlowField,
  promptToGeneratorParams,

  // Noise
  noise2D,
  noise3D,
  noiseSeed,
  flowField,

  // Rendering and export
  Renderer,
  PreviewServer,
  Exporter,
  Gallery,
  SeedArchive,

  // Evolution
  MapElites,
  NoveltyArchive,
  extractBehavior,
  detectDomain,
  AestheticModel,
  MetaMode,
  SafetyGuardrails,
  FeedbackQueue,

  // generateVisuals API
  generateVisuals,

  // Music-to-visual bridge
  generateMusicToVisual,

  // Music API
  generateMusic,

  // Configuration
  LIMINAL_VERSION,
  defaultConfig
};

// LLM Generator (Legacy - use P5GeneratorV2 for tier-based)
export { P5GeneratorLLM };
export { LLMError, LLMTimeoutError, LLMRateLimitError, LLMAuthError } from './llm/LLMClient.js';
export type { LLMConfig, LLMResponse } from './llm/LLMClient.js';

// Model Configuration - Harness/Generation Split
export {
  loadModelConfig,
  validateModelConfig,
  formatModelConfig,
  getModelEnvDocs,
  type ModelConfig,
  type SplitModelConfig,
} from './llm/ModelConfig.js';

// Model Tier Detection & Prompt Building
export { 
  detectModelTier, 
  getModelProfile, 
  trimContext, 
  type ModelTier,
  type ModelProfile 
} from './llm/ModelTier.js';
export { PromptBuilder, type PromptContext, type BuiltPrompt } from './llm/PromptBuilder.js';

// Tier-Based Generator Infrastructure
export { 
  TierBasedGenerator, 
  type TierBasedGeneratorOptions 
} from './generators/TierBasedGenerator.js';

// V2 Generators (tier-based)
export { P5GeneratorV2, type P5GeneratorV2Options } from './generators/p5/P5GeneratorV2.js';
export { ShaderGenerator } from './generators/glsl/ShaderGenerator.js';
export { ThreeGenerator } from './generators/three/ThreeGenerator.js';
export { HydraGenerator } from './generators/hydra/HydraGenerator.js';
export { SVGGenerator } from './generators/svg/SVGGenerator.js';
export {
  SVG_MODE_PROFILES,
  inferSVGMode,
  type SVGMode,
  type SVGModeProfile,
} from './generators/svg/SVGModeProfiles.js';
export { sanitizeSVG } from './generators/svg/SVGSanitizer.js';
export { validateSVG, type SVGValidationOptions, type SVGValidationResult } from './generators/svg/SVGValidator.js';
export { StrudelGenerator } from './generators/strudel/StrudelGenerator.js';
export { ToneGenerator } from './generators/tone/ToneGenerator.js';
export { RevideoGenerator } from './generators/revideo/RevideoGenerator.js';
export { HTMLWebGenerator } from './generators/html/HTMLWebGenerator.js';
export { ASCIIArtGenerator } from './generators/ascii/ASCIIArtGenerator.js';
export { TextGenerativeGenerator } from './generators/textgen/TextGenerativeGenerator.js';

export type { PersistedLoopState } from './core/ContextAccumulation.js';



// M9-M11 Guardrails
export { 
  SemanticValidator,
  RuntimeHealthMonitor, 
  AccessibilityGuardrails,
  type SemanticValidationResult,
  type RuntimeHealthResult,
  type AccessibilityResult,
} from './guardrails/index.js';

// Swarm
export { SwarmOrchestrator } from './swarm/SwarmOrchestrator.js';
export { VotingEngine } from './swarm/VotingEngine.js';
export { MiningEngine } from './swarm/MiningEngine.js';
export { DEFAULT_PERSONAS } from './swarm/personas.js';
export { DEFAULT_REFINEMENT_CONSTRAINTS } from './swarm/types.js';
export { SwarmMode } from './swarm/types.js';
export type { SwarmPersona, SwarmConfig, SwarmOutput, Vote, RoundResult, SwarmResult, MinedFragment } from './swarm/types.js';
export type { SwarmOrchestratorOptions } from './swarm/SwarmOrchestrator.js';

// Scavenger
/** @library Public API — not wired into RalphLoop */
export { DNAExtractor } from './scavenger/DNAExtractor.js';
export type { ProjectDNA, ScavengerConfig } from './scavenger/types.js';

// Routing
/** @library Public API — not wired into RalphLoop */
export {
  AB_TEST_RESULTS,
  DOMAIN_ROUTING_DATA,
  OVERALL_FITNESS,
  DOMAIN_KEYWORDS,
} from './routing/index.js';

// Audio pipeline
export { AudioAnalyzer } from './audio/index.js';
export type { AudioFeatures, PitchData, TimbreData, AudioAnalysisResult, VisualMappingParams } from './audio/types.js';

// Aesthetic guardrails
export { AestheticCritic } from './aesthetic/index.js';
export { AestheticStrategy } from './aesthetic/index.js';
export type { DesignConstraints, AestheticViolation, AestheticReport, CriticConfig, AestheticPreset } from './aesthetic/types.js';
export { DEFAULT_DESIGN_CONSTRAINTS, PRESET_PROFILES } from './aesthetic/types.js';

// Collaboration
export { CollaborationEngine } from './collab/CollaborationEngine.js';
export type { CollaborationMode, CollaborationEngineResult, CollaborationEngineConfig } from './collab/CollaborationEngine.js';
export type {
  RoutingDecision,
  RoutingConfig,
  DomainType as RoutingDomainType,
  ModelChoice,
  DomainFitness,
  DomainRoutingConfig,
} from './routing/index.js';

// Learning
/** @library Public API — not wired into RalphLoop */
export { ArchiveLearning } from './learning/index.js';
export { QualityArchive } from './learning/index.js';
export type {
  ArchiveConfig,
  ArchivedItem,
  ArchiveQueryOptions,
  ArchiveEntry,
  QualityArchiveConfig,
} from './learning/index.js';

// Constants
export { SERVICE_DEFAULTS } from './constants.js';
export {
  OPENAI_RECOMMENDED_MODELS_BY_ROLE,
  OPENAI_SMALL_ROLE_POLICY,
  OPENAI_SMALL_ROLE_POLICY_EVIDENCE,
  getOpenAIRolePolicy,
  getRecommendedOpenAIModelsForRole,
  isOpenAIModelRecommendedForRole,
  type OpenAIRolePolicyEntry,
  type OpenAIRolePolicyStatus,
} from './config/OpenAIRolePolicy.js';

// HTML Web Generator & ASCII Art Generator types (classes exported above with tier-based generators)
export type { HTMLGeneratorOptions } from './generators/html/HTMLWebGenerator.js';
export type { ASCIIOptions, ASCIIStyle } from './generators/ascii/ASCIIArtGenerator.js';
export type { TextGenOptions, TextGenForm, TextGenStyle } from './generators/textgen/TextGenerativeGenerator.js';
export type { SVGGeneratorOptions } from './generators/svg/SVGGenerator.js';
// Note: ShaderGenerator, ThreeGenerator, HTMLWebGenerator, ASCIIArtGenerator, TextGenerativeGenerator exported below with TierBasedGenerator

export { LiminalFS } from './fs/index.js';
export type {
  LiminalObjectKind,
  LiminalObjectRef,
  WriteArtifactInput,
  LiminalRunRecord,
} from './fs/index.js';

// Meta-Harness - Failure observation and pattern detection
export {
  failureLogger,
  patternDetector,
  metaHarness,
  harnessMemory,
  HarnessMemory,
  type FailureRecord,
  type Pattern,
  type MetaHarnessStatus,
  type ProviderType,
  type ProviderConfig,
  type HarnessMemoryState,
  type HarnessTask,
  getProviderConfig,
  getActiveProvider,
  getActiveProviderConfig,
  listConfiguredProviders,
  isProviderConfigured,
  detectProviderFromUrl,
  PROVIDER_TEMPLATES,
} from './harness/index.js';

// Embeddings - Semantic search and vector similarity
export {
  EmbeddingService,
  getGlobalEmbeddingService,
  resetGlobalEmbeddingService,
} from './embeddings/index.js';
export type {
  EmbeddingConfig,
  EmbeddingResult,
} from './embeddings/index.js';

// Vector utilities
export {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  dotProduct,
  findKNearestNeighbors,
} from './utils/vectors.js';

// =============================================================================
// COMPOSITION ENGINE - Multi-layer composition system
// =============================================================================

export {
  // Core engine
  CompositionEngine,
  StateManager,
  LayerManager,

  // Constants
  DEFAULT_LAYER_CONFIG,
  DEFAULT_GLOBAL_SETTINGS,

  // Factory functions
  createLayer,
  createLayerFromResponse,
  createComposition,
  exportProject,

  // Adapters
  AdapterRegistry,
  adapterRegistry,
  p5Adapter,
  toneAdapter,
} from './composition/index.js';

export type {
  // String-union types
  DomainType,
  BlendMode,
  MaskMode,
  AssetType,

  // Core interfaces
  Layer,
  LayerConfig,
  LayerMetadata,
  Composition,
  GlobalSettings,
  AudioSettings,
  CompositionMetadata,
  LiminalProject,
  Export,
  Import,

  // Engine option types
  CompositionEngineOptions,
  RenderContext,
  LayerManagerOptions,
  LayerAdapter,
} from './composition/index.js';
