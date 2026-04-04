# Liminal Composition System API

> Multi-layer composition system for combining outputs from different generators (p5, Tone, Three.js, etc.)

## Table of Contents

- [Overview](#overview)
- [Core Types](#core-types)
- [CompositionEngine](#compositionengine)
- [LayerManager](#layermanager)
- [Adapters](#adapters)
- [Smart Composition](#smart-composition)
- [Advanced Features](#advanced-features)
- [Examples](#examples)

---

## Overview

The Composition System enables you to combine outputs from multiple Liminal generators into editable, composable projects. Think of it like a Photoshop or After Effects for creative coding — each generator output becomes a layer that can be positioned, animated, and blended with others.

### Key Concepts

#### Layers
A **Layer** represents a single generator output (e.g., a p5.js sketch, a Tone.js audio composition, or a Three.js 3D scene). Each layer contains:
- Generated code
- Configuration (position, opacity, blend mode)
- Metadata about generation
- Enable/lock state

#### Adapters
**Adapters** bridge between Layer objects and their runtime environments. Each domain (p5, three, tone, etc.) has its own adapter that knows how to:
- Render the layer into a container
- Export values for other layers to consume
- Import values from other layers
- Clean up resources

#### Compositions
A **Composition** is a collection of layers with shared global settings (canvas size, frame rate, audio settings). Compositions can be exported to the Liminal project format (`.liminal`) and reimported later.

### When to Use the Composition System

Use the Composition System when you need to:

- **Combine multiple domains**: Create a 3D scene (Three.js) with reactive audio (Tone.js) and post-processing effects (shaders)
- **Build complex projects**: Layer multiple visual elements with proper depth ordering
- **Enable non-destructive editing**: Modify individual layers without regenerating everything
- **Export standalone projects**: Generate HTML files with all layers combined
- **Sync across domains**: Share data (mouse position, audio FFT, time) between layers

---

## Core Types

### `DomainType`

All supported domain types in Liminal:

```typescript
type DomainType =
  | 'p5'        // p5.js 2D/3D canvas
  | 'three'     // Three.js 3D scenes
  | 'shader'    // GLSL fragment/vertex shaders
  | 'tone'      // Tone.js audio synthesis
  | 'music'     // Generic music domain
  | 'strudel'   // Strudel live coding patterns
  | 'hydra'     // Hydra video synthesis
  | 'ascii'     // ASCII art
  | 'remotion'  // Remotion video composition
  | 'video'     // Video playback/processing
  | 'html'      // HTML/DOM content
  | 'textgen'   // Generated text content
  | 'group';    // Layer group container
```

### `Layer`

A single layer in a composition:

```typescript
interface Layer {
  /** Unique identifier */
  id: string;

  /** Domain type (p5, three, tone, etc.) */
  type: DomainType;

  /** The generated code */
  code: string;

  /** Layer configuration (position, blending, etc.) */
  config: LayerConfig;

  /** Metadata about generation */
  metadata: LayerMetadata;

  /** Whether this layer is enabled */
  enabled: boolean;

  /** Whether this layer is locked from editing */
  locked: boolean;

  /** Parent layer ID for grouped layers */
  parentLayerId?: string;

  /** Whether this layer is a group container */
  isGroup?: boolean;

  /** Child layer IDs (if this is a group) */
  children?: string[];

  /** Group name (if this is a group) */
  name?: string;
}
```

### `LayerConfig`

Configuration for how a layer renders:

```typescript
interface LayerConfig {
  /** Stack order (higher = on top) */
  zIndex: number;

  /** Blend mode for compositing */
  blendMode: BlendMode;

  /** Opacity 0-1 */
  opacity: number;

  /** 2D position offset */
  position: { x: number; y: number };

  /** Size multiplier */
  scale: number;
}
```

**Default configuration:**
```typescript
const DEFAULT_LAYER_CONFIG: LayerConfig = {
  zIndex: 0,
  blendMode: 'normal',
  opacity: 1.0,
  position: { x: 0, y: 0 },
  scale: 1.0,
};
```

### `BlendMode`

Supported blend modes for layer compositing:

```typescript
type BlendMode =
  | 'normal'    // Default alpha blending
  | 'multiply'  // Darken by multiplying
  | 'screen'    // Lighten by inverse multiply
  | 'overlay'   // Combine multiply and screen
  | 'darken'    // Keep darker pixels
  | 'lighten'   // Keep lighter pixels
  | 'difference'// Absolute difference
  | 'exclusion';// Lower contrast difference
```

### `Composition`

A complete composition of multiple layers:

```typescript
interface Composition {
  /** Unique identifier */
  id: string;

  /** Layer stack (bottom to top) */
  layers: Layer[];

  /** Global settings shared across all layers */
  globalSettings: GlobalSettings;

  /** Composition metadata */
  metadata: CompositionMetadata;
}
```

### `GlobalSettings`

Global settings for a composition:

```typescript
interface GlobalSettings {
  /** Canvas width */
  width: number;

  /** Canvas height */
  height: number;

  /** Target frame rate */
  frameRate: number;

  /** Background color */
  backgroundColor: string;

  /** Audio settings */
  audio?: AudioSettings;
}

interface AudioSettings {
  /** Sample rate */
  sampleRate: number;

  /** Whether audio is enabled */
  enabled: boolean;

  /** Master volume 0-1 */
  volume: number;
}
```

**Default global settings:**
```typescript
const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  width: 800,
  height: 600,
  frameRate: 60,
  backgroundColor: '#000000',
  audio: {
    sampleRate: 44100,
    enabled: true,
    volume: 0.8,
  },
};
```

### `LayerMetadata`

Metadata about a layer's generation:

```typescript
interface LayerMetadata {
  /** Original prompt used to generate */
  prompt: string;

  /** Generator class name */
  generator: string;

  /** Model used */
  model: string;

  /** When generated */
  generatedAt: string;

  /** LLM thinking/reasoning (if available) */
  thinking?: string;

  /** Whether code was recovered from thinking */
  recoveredFromThinking?: boolean;

  /** Validation result */
  validation?: {
    passed: boolean;
    errors?: string[];
  };

  /** Aesthetic score (if evaluated) */
  aestheticScore?: number;

  /** Arbitrary additional metadata */
  [key: string]: unknown;
}
```

---

## CompositionEngine

The main orchestrator for multi-layer compositions. Renders layers into a unified output, manages cross-layer communication, and exports to various formats.

### Constructor Options

```typescript
interface CompositionEngineOptions {
  /** Container element for rendering */
  container?: HTMLElement;
  
  /** Initial global settings */
  settings?: Partial<GlobalSettings>;
  
  /** Callback when composition changes */
  onChange?: (composition: Composition) => void;
}
```

**Example:**
```typescript
import { CompositionEngine } from 'liminal/composition';

const engine = new CompositionEngine({
  container: document.getElementById('canvas-container'),
  settings: {
    width: 1024,
    height: 768,
    backgroundColor: '#1a1a1a',
  },
  onChange: (composition) => {
    console.log('Composition updated:', composition.layers.length, 'layers');
  },
});
```

### `registerAdapter(type, adapter)`

Register a layer adapter for a domain type.

```typescript
registerAdapter(type: DomainType, adapter: LayerAdapter): void
```

**Example:**
```typescript
import { p5Adapter, toneAdapter } from 'liminal/composition';

engine.registerAdapter('p5', p5Adapter);
engine.registerAdapter('tone', toneAdapter);
```

### `addLayer(layer)`

Add a layer to the composition.

```typescript
addLayer(layer: Layer): void
```

**Example:**
```typescript
import { createLayer } from 'liminal/composition';

const layer = createLayer('p5', code, 'rainbow circles', {
  generator: 'P5Generator',
  model: 'gpt-4',
});

engine.addLayer(layer);
```

### `removeLayer(id)`

Remove a layer by ID.

```typescript
removeLayer(id: string): boolean
```

**Example:**
```typescript
const removed = engine.removeLayer('layer_123');
console.log('Layer removed:', removed);
```

### `getLayers()`

Get all layers (sorted by z-index).

```typescript
getLayers(): Layer[]
```

### `render()`

Render the composition to the container. Must call `setContainer()` first if not provided in constructor.

```typescript
render(): void
```

**Example:**
```typescript
// Set container if not provided in constructor
engine.setContainer(document.getElementById('canvas'));

// Render all layers
engine.render();
```

### `cleanup()`

Clean up all layers and resources. Call this before re-rendering or when disposing.

```typescript
cleanup(): void
```

### `exportProject()` / `importProject()`

Export/import to Liminal project format. **Note:** These methods are deprecated; use `ProjectSerializer` instead.

```typescript
// Deprecated - use ProjectSerializer
exportProject(name: string): LiminalProject
importProject(project: LiminalProject): void
```

**Recommended approach:**
```typescript
import { ProjectSerializer } from 'liminal/composition';

const serializer = new ProjectSerializer();

// Export
const project = serializer.exportProject(engine, { includeAssets: true });

// Import
await serializer.importProject(project, engine);
```

### `generateHTML()`

Generate a standalone HTML file with all layers combined.

```typescript
generateHTML(): string
```

**Example:**
```typescript
const html = engine.generateHTML();

// Download as file
const blob = new Blob([html], { type: 'text/html' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'composition.html';
a.click();
```

### `updateSettings(settings)` / `getSettings()`

Update or retrieve global settings.

```typescript
updateSettings(settings: Partial<GlobalSettings>): void
getSettings(): GlobalSettings
```

### `getLayerManager()` / `getMaskManager()`

Access the layer and mask managers.

```typescript
getLayerManager(): LayerManager
getMaskManager(): LayerMaskManager
```

---

## LayerManager

CRUD operations for composition layers. Manages layer lifecycle: create, edit, move, toggle, delete, duplicate. Also manages layer groups and keyframe animations.

### Constructor Options

```typescript
interface LayerManagerOptions {
  /** Callback when layers change */
  onChange?: (layers: Layer[]) => void;
}
```

### `getLayers()` / `getLayer(id)`

Get all layers or a specific layer by ID.

```typescript
getLayers(): Layer[]
getLayer(id: string): Layer | undefined
```

### `addLayer(layer)`

Add a layer. Auto-assigns z-index if not set.

```typescript
addLayer(layer: Layer): void
```

### `removeLayer(id)`

Remove a layer. If the layer is a group, its children are unparented.

```typescript
removeLayer(id: string): boolean
```

### `updateLayer(id, updates)`

Update a layer's code and metadata.

```typescript
updateLayer(
  id: string,
  updates: Partial<Pick<Layer, 'code' | 'enabled' | 'locked' | 'metadata'>>
): boolean
```

**Example:**
```typescript
layerManager.updateLayer('layer_123', {
  code: newCode,
  enabled: true,
});
```

### `updateLayerConfig(id, config)`

Update a layer's configuration (position, opacity, blend mode, etc.).

```typescript
updateLayerConfig(id: string, config: Partial<LayerConfig>): boolean
```

**Example:**
```typescript
layerManager.updateLayerConfig('layer_123', {
  opacity: 0.5,
  position: { x: 100, y: 50 },
  blendMode: 'multiply',
});
```

### `moveLayer(id, newZIndex)`

Move layer to new z-index position.

```typescript
moveLayer(id: string, newZIndex: number): boolean
```

### `reorderLayers(orderedIds)`

Reorder layers by array of IDs (bottom to top).

```typescript
reorderLayers(orderedIds: string[]): boolean
```

**Example:**
```typescript
// Put background layer at bottom, overlay at top
layerManager.reorderLayers(['background_id', 'middle_id', 'overlay_id']);
```

### `toggleLayer(id)` / `toggleLocked(id)`

Toggle layer enabled or locked state.

```typescript
toggleLayer(id: string): boolean
toggleLocked(id: string): boolean
```

### `duplicateLayer(id)`

Duplicate a layer.

```typescript
duplicateLayer(id: string): Layer | null
```

### `getLayersByType(type)` / `getEnabledLayers()`

Filter layers by type or enabled state.

```typescript
getLayersByType(type: DomainType): Layer[]
getEnabledLayers(): Layer[]
```

### Group Operations

#### `createGroup(name, layerIds)`

Create a group from layer IDs. Returns the created group layer.

```typescript
createGroup(name: string, layerIds: string[]): Layer | null
```

**Example:**
```typescript
const group = layerManager.createGroup('Background Elements', [
  'sky_layer_id',
  'clouds_layer_id',
  'mountains_layer_id',
]);
```

#### `moveToGroup(layerId, groupId)`

Move a layer to a group.

```typescript
moveToGroup(layerId: string, groupId: string): boolean
```

#### `removeFromGroup(layerId)`

Remove a layer from its group.

```typescript
removeFromGroup(layerId: string): boolean
```

#### `toggleGroup(groupId)`

Toggle all layers in a group.

```typescript
toggleGroup(groupId: string): boolean
```

#### `setGroupOpacity(groupId, opacity)`

Set opacity for all layers in a group.

```typescript
setGroupOpacity(groupId: string, opacity: number): boolean
```

#### `flattenGroup(groupId)`

Flatten a group — remove the group and unparent all children.

```typescript
flattenGroup(groupId: string): boolean
```

#### `getGroupLayers(groupId)`

Get all layers that are direct children of a group.

```typescript
getGroupLayers(groupId: string): Layer[]
```

### Animation Operations

#### `createAnimation(layerId, duration, keyframes, options)`

Create a keyframe animation for a layer.

```typescript
createAnimation(
  layerId: string,
  duration: number,
  keyframes: Keyframe[],
  options?: { loop?: boolean; autoplay?: boolean }
): Animation | null
```

**Example:**
```typescript
const animation = layerManager.createAnimation(
  'layer_123',
  5000, // 5 seconds
  [
    { time: 0, properties: { opacity: 0, position: { x: 0, y: 0 } } },
    { time: 0.5, properties: { opacity: 1 }, easing: 'ease-in-out' },
    { time: 1, properties: { position: { x: 100, y: 50 } }, easing: 'ease-out' },
  ],
  { loop: true, autoplay: true }
);
```

#### `getAnimations(layerId)`

Get all animations for a layer.

```typescript
getAnimations(layerId: string): Animation[]
```

#### `playAnimation(animationId)` / `pauseAnimation(animationId)` / `stopAnimation(animationId)`

Control animation playback.

```typescript
playAnimation(animationId: string): boolean
pauseAnimation(animationId: string): boolean
stopAnimation(animationId: string): boolean
```

#### `removeAnimation(animationId)`

Remove an animation by ID.

```typescript
removeAnimation(animationId: string): boolean
```

#### `generateAnimationCSS(animationId)` / `generateAnimationJS(animationId)`

Generate CSS or JavaScript code for an animation.

```typescript
generateAnimationCSS(animationId: string): string | null
generateAnimationJS(animationId: string): string | null
```

---

## Adapters

Adapters bridge between Layer objects and their runtime environments.

### `LayerAdapter` Interface

```typescript
interface LayerAdapter {
  /** 
   * Render this layer into a container.
   * Returns an instance object that can be used for cleanup.
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): unknown;
  
  /**
   * What this layer exports for other layers to use.
   */
  getExports?(layer: Layer): Export[];
  
  /**
   * What this layer needs from other layers.
   */
  getImports?(layer: Layer): Import[];
  
  /**
   * Destroy/cleanup layer instance.
   */
  destroy?(layer: Layer, instance: unknown): void;
  
  /**
   * Validate layer code.
   */
  validate?(layer: Layer): { valid: boolean; errors?: string[] };
  
  /**
   * Generate standalone script for HTML export.
   */
  generateScript?(layer: Layer, settings: GlobalSettings): string;
}
```

### `Export` and `Import`

```typescript
interface Export {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'canvas' | 'audio' | 'object' | 'function';
  getter: () => unknown;
  description?: string;
}

interface Import {
  from: DomainType;
  name: string;
  as: string;
  required?: boolean;
}
```

### Built-in Adapters

Liminal includes 9 built-in adapters:

| Adapter | Domain | Description |
|---------|--------|-------------|
| `p5Adapter` | `p5` | p5.js canvas rendering |
| `threeAdapter` | `three` | Three.js 3D scenes |
| `toneAdapter` | `tone` | Tone.js audio synthesis |
| `shaderAdapter` | `shader` | GLSL shaders |
| `strudelAdapter` | `strudel` | Strudel patterns |
| `hydraAdapter` | `hydra` | Hydra video synthesis |
| `asciiArtAdapter` | `ascii` | ASCII art rendering |
| `htmlAdapter` | `html` | HTML/DOM content |
| `remotionAdapter` | `remotion` | Remotion video |

### Registering Adapters

**Register individually:**
```typescript
import { CompositionEngine, p5Adapter, toneAdapter } from 'liminal/composition';

const engine = new CompositionEngine();
engine.registerAdapter('p5', p5Adapter);
engine.registerAdapter('tone', toneAdapter);
```

**Register all at once:**
```typescript
import { CompositionEngine, registerAllAdapters } from 'liminal/composition';

const engine = new CompositionEngine();
registerAllAdapters(engine);
```

### Creating Custom Adapters

```typescript
import { LayerAdapter, Layer, RenderContext } from 'liminal/composition';

const myCustomAdapter: LayerAdapter = {
  render(layer: Layer, container: HTMLElement, context?: RenderContext) {
    // Create and setup your runtime
    const canvas = document.createElement('canvas');
    canvas.width = context?.settings.width || 800;
    canvas.height = context?.settings.height || 600;
    container.appendChild(canvas);
    
    // Execute the layer code
    const ctx = canvas.getContext('2d')!;
    const draw = new Function('ctx', layer.code);
    draw(ctx);
    
    // Return instance for cleanup
    return { canvas, ctx };
  },
  
  getExports(layer: Layer) {
    return [
      {
        name: 'canvas',
        type: 'canvas',
        getter: () => document.getElementById(layer.id)?.querySelector('canvas'),
      },
    ];
  },
  
  destroy(layer: Layer, instance: unknown) {
    const { canvas } = instance as { canvas: HTMLCanvasElement };
    canvas.remove();
  },
  
  generateScript(layer: Layer, settings: GlobalSettings) {
    return `<script>
  // Generated script for ${layer.id}
  ${layer.code}
</script>`;
  },
};

engine.registerAdapter('custom', myCustomAdapter);
```

### Adapter Registry

```typescript
import { AdapterRegistry, adapterRegistry } from 'liminal/composition';

// Use the global registry
adapterRegistry.register('custom', myAdapter);
const adapter = adapterRegistry.get('p5');
const hasAdapter = adapterRegistry.has('three');
const allTypes = adapterRegistry.getTypes();

// Or create your own registry
const myRegistry = new AdapterRegistry();
```

---

## Smart Composition

### `CompositionAnalyzer`

Analyzes prompts to determine required domains using keyword matching and LLM analysis.

```typescript
import { CompositionAnalyzer } from 'liminal/composition';

const analyzer = new CompositionAnalyzer({
  keywordThreshold: 0.5,
  useLLM: true,
});

const recommendations = await analyzer.analyze(
  'Create a 3D scene with audio reactive visuals'
);
// Returns: [
//   { domain: 'three', confidence: 0.9, reason: 'Matched keywords: 3d, scene', dependencies: [] },
//   { domain: 'tone', confidence: 0.85, reason: 'Detected audio synchronization', dependencies: ['three'] }
// ]
```

**Constructor Options:**
```typescript
interface AnalyzerOptions {
  keywordThreshold?: number;  // Default: 0.5
  useLLM?: boolean;           // Default: true
  llmConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```

### `LayerSequencer`

Sequential layer generation with context passing.

```typescript
import { LayerSequencer } from 'liminal/composition';

const sequencer = new LayerSequencer();

const result = await sequencer.generateLayers(
  'Create a music visualization',
  ['three', 'tone'], // Generate 3D scene first, then audio
  {
    generators: new Map([
      ['three', threeGenerator],
      ['tone', toneGenerator],
    ]),
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    },
    continueOnError: true,
    optimizeOrder: true, // Render base layers first
  }
);

// result.layers - successfully generated layers
// result.errors - any errors that occurred
```

**Parallel Generation:**
```typescript
const result = await sequencer.generateParallel(
  [
    { domain: 'p5', prompt: 'Generative art background' },
    { domain: 'tone', prompt: 'Ambient drone' },
  ],
  { generators }
);
```

### `PromptEnhancer`

Enhances prompts for cross-layer integration.

```typescript
import { PromptEnhancer } from 'liminal/composition';

const enhancer = new PromptEnhancer();

const result = enhancer.enhance({
  existingLayers: [p5Layer, toneLayer],
  targetDomain: 'shader',
  integrationHints: ['Sync visuals to audio BPM'],
});

// result.prompt - complete formatted prompt
// result.context - extracted context from existing layers
// result.instructions - integration instructions
```

---

## Advanced Features

### Layer Groups

Groups allow organizing layers hierarchically with max nesting depth of 3.

```typescript
// Create a group
const backgroundGroup = layerManager.createGroup('Background', [
  skyLayer.id,
  cloudsLayer.id,
]);

// Move layer to group
layerManager.moveToGroup(foregroundLayer.id, backgroundGroup.id);

// Toggle entire group
layerManager.toggleGroup(backgroundGroup.id);

// Flatten group (remove group, keep children)
layerManager.flattenGroup(backgroundGroup.id);
```

### Blend Modes

Apply blend modes to layers:

```typescript
// Set layer blend mode
layerManager.updateLayerConfig('layer_123', {
  blendMode: 'multiply',
});

// Available blend modes utilities
import {
  getCSSBlendMode,
  getCanvasCompositeOp,
  getWebGLBlendFunc,
  applyBlendMode,
} from 'liminal/composition';

// Apply to DOM element
applyBlendMode(element, 'multiply', 'css');

// Apply to Canvas context
applyBlendMode(ctx, 'screen', 'canvas');

// Apply to WebGL context
applyBlendMode(gl, 'overlay', 'webgl');
```

### Keyframe Animation

The animation system supports:

```typescript
// Supported easing functions
type EasingFunction =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'bounce'
  | 'elastic'
  | 'back-in'
  | 'back-out';

// Keyframe structure
interface Keyframe {
  time: number;        // 0-1 (start to end)
  properties: Partial<LayerConfig>;
  easing?: EasingFunction;
}
```

**Direct KeyframeAnimation usage:**
```typescript
import { KeyframeAnimation } from 'liminal/composition';

const animationEngine = new KeyframeAnimation();

const animation = animationEngine.createAnimation(
  'layer_123',
  3000,
  [
    { time: 0, properties: { opacity: 0, scale: 0.5 } },
    { time: 1, properties: { opacity: 1, scale: 1 }, easing: 'elastic' },
  ],
  { loop: true }
);

animationEngine.play(animation);

// Generate standalone code
const css = animationEngine.generateCSS(animation);
const js = animationEngine.generateJS(animation);
```

### Layer Masks

Use one layer as a mask for another:

```typescript
import { LayerMaskManager, LayerMaskGroup } from 'liminal/composition';

const maskManager = engine.getMaskManager();

// Create mask
const mask = maskManager.createMask(
  shapeLayer.id,   // Source layer (the mask)
  contentLayer.id, // Target layer (to be masked)
  'alpha'          // Mode: 'alpha' | 'luminance' | 'inverse-alpha'
);

// Update mask
maskManager.updateMask(mask.id, {
  invert: true,
  feather: 5, // Blur radius in pixels
});

// Apply mask to container
maskManager.applyMask(container, mask, sourceCanvas);

// Generate CSS mask
const cssMask = maskManager.generateCSSMask(mask);

// Batch operations with LayerMaskGroup
const maskGroup = new LayerMaskGroup(maskManager);
maskGroup.maskMultipleLayers(shapeLayer.id, [layer1.id, layer2.id, layer3.id]);
maskGroup.updateAll({ feather: 10 });
```

### Project Serialization

Export and import complete projects:

```typescript
import { ProjectSerializer } from 'liminal/composition';

const serializer = new ProjectSerializer();

// Export to project format
const project = serializer.exportProject(engine, {
  includeAssets: true,
  animations: myAnimations,
});

// Save to file
const json = JSON.stringify(project, null, 2);

// Import from project
const loadedProject = JSON.parse(json);
await serializer.importProject(loadedProject, engine);

// Export to ZIP
const zipBlob = await serializer.exportToZip(project);

// Import from ZIP
const projectFromZip = await serializer.importFromZip(zipBlob);

// Import from URL
const projectFromURL = await serializer.importFromURL('https://example.com/project.liminal');

// Validate project
const validation = serializer.validateProject(project);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

## Examples

### Simple 2-Layer Composition

```typescript
import {
  CompositionEngine,
  createLayer,
  p5Adapter,
  toneAdapter,
  registerAllAdapters,
} from 'liminal/composition';

// Create engine
const engine = new CompositionEngine({
  container: document.getElementById('canvas'),
  settings: { width: 800, height: 600 },
});

// Register adapters
registerAllAdapters(engine);

// Create layers
const visualLayer = createLayer(
  'p5',
  `
    function setup() {
      createCanvas(800, 600);
    }
    function draw() {
      background(20);
      fill(255, 100, 100);
      circle(mouseX, mouseY, 50);
    }
  `,
  'Interactive circles',
  { generator: 'P5Generator', model: 'gpt-4' }
);

const audioLayer = createLayer(
  'tone',
  `
    const synth = new Tone.Synth().toDestination();
    setInterval(() => {
      synth.triggerAttackRelease('C4', '8n');
    }, 500);
  `,
  'Simple synth loop',
  { generator: 'ToneGenerator', model: 'gpt-4' }
);

// Add layers
engine.addLayer(visualLayer);
engine.addLayer(audioLayer);

// Render
engine.render();

// Export HTML
const html = engine.generateHTML();
```

### Multi-Layer with Groups

```typescript
// Create multiple layers
const sky = createLayer('p5', skyCode, 'Sky background');
const clouds = createLayer('p5', cloudsCode, 'Moving clouds');
const mountains = createLayer('p5', mountainsCode, 'Mountain range');
const rain = createLayer('p5', rainCode, 'Rain particles');
const thunder = createLayer('tone', thunderCode, 'Thunder sounds');

// Add to engine
[sky, clouds, mountains, rain, thunder].forEach(l => engine.addLayer(l));

// Create groups
const layerManager = engine.getLayerManager();

const backgroundGroup = layerManager.createGroup('Background', [
  sky.id,
  clouds.id,
  mountains.id,
]);

const weatherGroup = layerManager.createGroup('Weather', [
  rain.id,
  thunder.id,
]);

// Adjust group opacity
layerManager.setGroupOpacity(backgroundGroup.id, 0.8);

// Render
engine.render();
```

### Animated Composition

```typescript
// Create base layer
const baseLayer = createLayer('p5', baseCode, 'Generative background');
engine.addLayer(baseLayer);

// Create animation for the layer
const layerManager = engine.getLayerManager();

const animation = layerManager.createAnimation(
  baseLayer.id,
  10000, // 10 seconds
  [
    {
      time: 0,
      properties: {
        opacity: 0.3,
        position: { x: 0, y: 0 },
        scale: 1,
      },
    },
    {
      time: 0.3,
      properties: {
        opacity: 1,
        scale: 1.1,
      },
      easing: 'ease-in-out',
    },
    {
      time: 0.7,
      properties: {
        position: { x: 50, y: -20 },
        scale: 0.9,
      },
      easing: 'ease-out',
    },
    {
      time: 1,
      properties: {
        opacity: 0.3,
        position: { x: 0, y: 0 },
        scale: 1,
      },
      easing: 'ease-in',
    },
  ],
  { loop: true, autoplay: true }
);

// Control animation
layerManager.playAnimation(animation.id);
layerManager.pauseAnimation(animation.id);

// Generate CSS for export
const css = layerManager.generateAnimationCSS(animation.id);
```

### Cross-Layer Integration with Imports/Exports

```typescript
// p5 layer exports mouse position
const p5Adapter = {
  ...p5Adapter,
  getExports(layer) {
    return [
      {
        name: 'mousePosition',
        type: 'object',
        getter: () => ({ x: window.mouseX, y: window.mouseY }),
      },
    ];
  },
};

// Tone layer imports mouse position
const toneAdapter = {
  ...toneAdapter,
  getImports(layer) {
    return [
      { from: 'p5', name: 'mousePosition', as: 'mouse' },
    ];
  },
  render(layer, container, context) {
    // Access imported values via context.state
    const mousePos = context.state.get('p5.mousePosition');
    
    // Use mouse position to control audio
    const freq = 200 + (mousePos?.x || 0);
    // ... synthesis code
  },
};
```

---

## Type Exports

```typescript
// Core types
export type {
  DomainType,
  BlendMode,
  MaskMode,
  Layer,
  LayerConfig,
  LayerMetadata,
  Composition,
  GlobalSettings,
  AudioSettings,
  CompositionMetadata,
  LiminalProject,
  LiminalProjectV1,
  Asset,
  Animation,
  Keyframe,
  Export,
  Import,
} from 'liminal/composition';

// Options types
export type {
  CompositionEngineOptions,
  RenderContext,
  LayerManagerOptions,
  LayerAdapter,
  AnalyzerOptions,
  DomainRecommendation,
  LayerSequencerOptions,
  SequencerResult,
  EnhancementContext,
  EnhancedPrompt,
  AnimationOptions,
  ExportOptions,
  ImportResult,
  ValidationResult,
} from 'liminal/composition';
```
