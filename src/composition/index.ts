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

// Core types
export {
  // Enums
  DomainType,
  BlendMode,
  
  // Core interfaces
  Layer,
  LayerConfig,
  LayerMetadata,
  Composition,
  GlobalSettings,
  AudioSettings,
  CompositionMetadata,
  LiminalProject,
  
  // Constants
  DEFAULT_LAYER_CONFIG,
  DEFAULT_GLOBAL_SETTINGS,
  
  // Factory functions
  createLayer,
  createLayerFromResponse,
  createComposition,
  exportProject,
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
