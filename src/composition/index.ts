/**
 * Liminal Composition Engine
 *
 * Multi-layer composition system for combining outputs from
 * different generators (p5, Tone, Three.js, etc.).
 *
 * @example
 * ```typescript
 * // Create composition
 * const engine = new CompositionEngine();
 * 
 * // Register adapters
 * engine.registerAdapter('p5', p5Adapter);
 * engine.registerAdapter('tone', toneAdapter);
 * 
 * // Add layers
 * const p5Layer = await p5Generator.generateLayer('rainbow circles');
 * const toneLayer = await toneGenerator.generateLayer('ambient drone');
 * 
 * engine.addLayer(p5Layer);
 * engine.addLayer(toneLayer);
 * 
 * // Render
 * engine.setContainer(document.getElementById('canvas'));
 * engine.render();
 * 
 * // Export
 * const html = engine.generateHTML();
 * ```
 */

// Core types (runtime exports — constants, functions)
export {
  // Constants
  DEFAULT_LAYER_CONFIG,
  DEFAULT_GLOBAL_SETTINGS,

  // Factory functions
  createLayer,
  createLayerFromResponse,
  createComposition,
  exportProject,
} from './types.js';

// Core types (type-only exports — interfaces erased at runtime)
export type {
  // String-union types
  DomainType,
  BlendMode,
  MaskMode,
  LayerRole,
  AssetType,

  // Core interfaces
  Layer,
  LayerConfig,
  LayerMetadata,
  LayerMask,
  Composition,
  GlobalSettings,
  AudioSettings,
  CompositionMetadata,
  LiminalProject,
  LiminalProjectV1,
  Asset,
  Animation,
} from './types.js';

// Layer Manager
export { LayerManager, type LayerManagerOptions } from './LayerManager.js';

// Composition Engine
export {
  CompositionEngine,
  StateManager,
  type CompositionEngineOptions,
  type RenderContext,
} from './CompositionEngine.js';

// Adapters
export {
  type LayerAdapter,
  AdapterRegistry,
  adapterRegistry,
} from './adapters/index.js';

// Re-export adapter types separately
export type { Export, Import } from './adapters/index.js';

// Concrete adapters (register as needed)
export { P5Adapter, p5Adapter } from './adapters/P5Adapter.js';
export { ToneAdapter, toneAdapter } from './adapters/ToneAdapter.js';

// Adapter registration utilities
export { registerAllAdapters, allAdapters } from './adapters/registerAdapters.js';

// Composition Analyzer
export {
  CompositionAnalyzer,
  type DomainRecommendation,
  type AnalyzerOptions,
  type KeywordMapping,
  type DependencyRule,
  DEFAULT_KEYWORD_MAPPINGS,
  DOMAIN_DEPENDENCIES,
  DOMAIN_RENDER_ORDER,
} from './CompositionAnalyzer.js';

// Layer Sequencer
export {
  LayerSequencer,
  AbortError,
  type LayerSequencerOptions,
  type SequencerResult,
} from './LayerSequencer.js';

// Prompt Enhancer for cross-layer integration
export {
  PromptEnhancer,
  type EnhancementContext,
  type EnhancedPrompt,
} from './PromptEnhancer.js';

// Blend Mode Utilities
export {
  getCSSBlendMode,
  getCanvasCompositeOp,
  getWebGLBlendFunc,
  applyBlendMode,
} from './utils/blendModes.js';

// Layer Mask System
export {
  LayerMaskManager,
  LayerMaskGroup,
} from './LayerMask.js';

// Keyframe Animation System
export {
  KeyframeAnimation,
  type AnimationOptions,
} from './KeyframeAnimation.js';

// Project Serializer
export {
  ProjectSerializer,
  type ExportOptions,
  type ImportResult,
  type ValidationResult,
} from './ProjectSerializer.js';
