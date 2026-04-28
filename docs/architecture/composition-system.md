# Composition System Architecture

> Multi-layer composition system for combining outputs from different generators (p5, Tone, Three.js, etc.)

## Table of Contents

- [System Overview](#system-overview)
- [Layer Architecture](#layer-architecture)
- [Adapter Pattern](#adapter-pattern)
- [Cross-Layer Communication](#cross-layer-communication)
- [Rendering Pipeline](#rendering-pipeline)
- [Smart Composition](#smart-composition)
- [Serialization](#serialization)
- [Extension Points](#extension-points)

---

## System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LIMINAL COMPOSITION SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    COMPOSITION ENGINE                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ LayerManager│  │StateManager │  │    LayerMaskManager     │  │   │
│  │  │  (CRUD)     │  │(Shared State│  │    (Mask Application)   │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │   │
│  │         │                │                                       │   │
│  │         └────────────────┼───────────────────────────────────────┘   │
│  │                          │                                           │
│  │  ┌───────────────────────┴───────────────────────────────────────┐  │
│  │  │                    ADAPTER REGISTRY                            │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │  │
│  │  │  │  P5    │ │  Tone  │ │ Three  │ │ Shader │ │  ...   │       │  │
│  │  │  │Adapter │ │Adapter │ │Adapter │ │Adapter │ │Adapter │       │  │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │  │
│  │  └────────────────────────────────────────────────────────────────┘  │
│  └────────────────────────────────────────────────────────────────────┘
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    SMART COMPOSITION LAYER                          │ │
│  │  ┌────────────────┐  ┌───────────────┐  ┌────────────────────────┐ │ │
│  │  │CompositionAnalyzer│ │LayerSequencer │  │   PromptEnhancer       │ │ │
│  │  │  (Domain Recs)   │  │  (Ordering)   │  │  (Context Injection)   │ │ │
│  │  └────────────────┘  └───────────────┘  └────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      SERIALIZATION LAYER                            │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │              ProjectSerializer (v2.0 Format)                 │  │ │
│  │  │   • JSON Export/Import  • ZIP Archive  • Asset Embedding     │  │ │
│  │  │   • v1.0 Migration      • Validation   • URL Loading         │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Design Philosophy

The composition system follows these core principles:

1. **Layer-Based Architecture**: Every creative output is a layer that can be stacked, blended, and composed
2. **Domain Agnostic**: Unified interface across all generator types (visual, audio, video, text)
3. **Cross-Domain Communication**: Layers can export values and import from other layers
4. **Runtime Composability**: Layers are composed at runtime, not code-generation time
5. **Editable & Serializable**: Compositions can be saved, loaded, and modified

### Key Abstractions

| Abstraction | Description | File |
|------------|-------------|------|
| `Layer` | Single creative unit with code, config, and metadata | `types.ts` |
| `Composition` | Collection of layers with global settings | `types.ts` |
| `LayerAdapter` | Interface for rendering layers in their native environment | `adapters/index.ts` |
| `StateManager` | Shared state registry for cross-layer communication | `CompositionEngine.ts` |
| `CompositionEngine` | Orchestrates rendering and layer management | `CompositionEngine.ts` |

---

## Layer Architecture

### What is a Layer

A Layer is the fundamental unit of composition:

```typescript
interface Layer {
  id: string;                    // Unique identifier
  type: DomainType;              // 'p5', 'three', 'tone', etc.
  code: string;                  // Generated code
  config: LayerConfig;           // Position, blend mode, opacity
  metadata: LayerMetadata;       // Generation info, prompt, model
  enabled: boolean;              // Visible/active
  locked: boolean;               // Prevent editing
  parentLayerId?: string;        // For nested groups
  isGroup?: boolean;             // Is this a group container?
  children?: string[];           // Child layer IDs
}
```

### Layer Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  CREATE  │───►│ CONFIGURE│───►│  RENDER  │───►│  UPDATE  │───►│ DESTROY  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
      │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼
  Generator    Set z-index,   Adapter.render()  Code edits    Adapter.destroy()
  produces     blend mode,    creates native    Toggle        cleanup resources
  code         opacity        instance          visibility
```

### Layer Configuration

```typescript
interface LayerConfig {
  zIndex: number;                // Stack order (higher = on top)
  blendMode: BlendMode;          // 'normal', 'multiply', 'screen', etc.
  opacity: number;               // 0.0 - 1.0
  position: { x: number; y: number };  // 2D offset
  scale: number;                 // Size multiplier
}

// Default configuration
const DEFAULT_LAYER_CONFIG: LayerConfig = {
  zIndex: 0,
  blendMode: 'normal',
  opacity: 1.0,
  position: { x: 0, y: 0 },
  scale: 1.0,
};
```

### Layer Groups

Layers can be organized into nested groups (max depth: 3):

```typescript
// Create a group
const group = layerManager.createGroup('Background Group', [layer1Id, layer2Id]);

// Move layer to group
layerManager.moveToGroup(layerId, groupId);

// Group operations
layerManager.toggleGroup(groupId);        // Enable/disable all
layerManager.setGroupOpacity(groupId, 0.5);
layerManager.flattenGroup(groupId);       // Remove group, keep children
```

### Layer Metadata

```typescript
interface LayerMetadata {
  prompt: string;                // Original generation prompt
  generator: string;             // Generator class name
  model: string;                 // LLM model used
  generatedAt: string;           // ISO timestamp
  thinking?: string;             // LLM reasoning (if available)
  recoveredFromThinking?: boolean;
  validation?: {                 // Validation results
    passed: boolean;
    errors?: string[];
  };
  aestheticScore?: number;       // If evaluated
}
```

---

## Adapter Pattern

### Why Adapters

Each creative domain (p5.js, Three.js, Tone.js, etc.) has its own:
- Runtime environment
- Rendering context
- API conventions
- State management

**Adapters bridge the gap** between the unified Layer interface and domain-specific implementations.

### Adapter Interface

```typescript
interface LayerAdapter {
  // Core: Render layer into container
  render(layer: Layer, container: HTMLElement, context?: RenderContext): unknown;
  
  // Optional: Export values for other layers
  getExports?(layer: Layer): Export[];
  
  // Optional: Import values from other layers
  getImports?(layer: Layer): Import[];
  
  // Optional: Cleanup resources
  destroy?(layer: Layer, instance: unknown): void;
  
  // Optional: Validate layer code
  validate?(layer: Layer): { valid: boolean; errors?: string[] };
  
  // Optional: Generate standalone script for HTML export
  generateScript?(layer: Layer, settings: GlobalSettings): string;
}
```

### How Adapters Bridge Domains

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPOSITION ENGINE                           │
│                                                                  │
│   Layer (generic)          ┌─────────────┐        Runtime        │
│   ┌──────────────┐         │   P5Adapter │       ┌─────────┐     │
│   │ type: 'p5'   │────────►│  • render() │──────►│  p5.js  │     │
│   │ code: "..."  │         │  • getExports      │ instance│     │
│   │ config: {...}│         │  • destroy()       └─────────┘     │
│   └──────────────┘         └─────────────┘                       │
│                                                                  │
│   Layer (generic)          ┌─────────────┐        Runtime        │
│   ┌──────────────┐         │  ToneAdapter│       ┌─────────┐     │
│   │ type: 'tone' │────────►│  • render() │──────►│ Tone.js │     │
│   │ code: "..."  │         │  • getExports      │ instance│     │
│   │ config: {...}│         │  • destroy()       └─────────┘     │
│   └──────────────┘         └─────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Built-in Adapters

| Adapter | Domain | Exports | Imports |
|---------|--------|---------|---------|
| `P5Adapter` | p5.js | mouseX/Y, frameCount, canvas | - |
| `ToneAdapter` | Tone.js | isPlaying, bpm, currentTime | p5.mouseX/Y |
| `ThreeAdapter` | Three.js | scene, camera, renderer | - |
| `ShaderAdapter` | GLSL | time, resolution | p5.canvas |
| `HydraAdapter` | Hydra | video output | - |
| `StrudelAdapter` | Strudel | patterns, bpm | - |
| `ASCIIArtAdapter` | ASCII | text output | p5.canvas |
| `HTMLAdapter` | HTML/DOM | element references | - |
| `RemotionAdapter` | *(removed)* | frame, duration | Replaced by Revideo + HyperFrames |

### Creating Custom Adapters

```typescript
import { LayerAdapter, Export, Import } from '../composition/adapters/index.js';
import { Layer, GlobalSettings } from '../composition/types.js';

class MyCustomAdapter implements LayerAdapter {
  private instances = new Map<string, MyRuntimeInstance>();

  render(layer: Layer, container: HTMLElement, context?: RenderContext): MyRuntimeInstance {
    // 1. Create domain-specific instance
    const instance = new MyRuntimeInstance();
    
    // 2. Execute layer code
    instance.execute(layer.code);
    
    // 3. Apply configuration (opacity, blend mode)
    container.style.opacity = String(layer.config.opacity);
    
    // 4. Store for exports/destroy
    this.instances.set(layer.id, instance);
    
    return instance;
  }

  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'customValue',
        type: 'number',
        getter: () => instance.getCurrentValue(),
        description: 'Current runtime value',
      },
    ];
  }

  getImports(): Import[] {
    // Declare what this adapter can consume from other layers
    return [
      { from: 'p5', name: 'mouseX', as: 'inputX' },
      { from: 'tone', name: 'bpm', as: 'tempo' },
    ];
  }

  destroy(layer: Layer): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      instance.cleanup();
      this.instances.delete(layer.id);
    }
  }

  generateScript(layer: Layer, settings: GlobalSettings): string {
    // Return HTML/JS for standalone export
    return `<script>
      // Your domain library loading
      // Layer code execution
    </script>`;
  }
}

// Register adapter
const engine = new CompositionEngine();
engine.registerAdapter('mycustom', new MyCustomAdapter());
```

---

## Cross-Layer Communication

### StateManager

The `StateManager` provides a pub/sub mechanism for sharing values between layers:

```typescript
export class StateManager {
  // Register a getter function for a key
  register(key: string, getter: () => unknown): void;
  
  // Get current value
  get<T>(key: string): T | undefined;
  
  // Subscribe to changes
  subscribe(key: string, callback: (value: unknown) => void): () => void;
}
```

### Exports/Imports Pattern

```typescript
// Adapter declares what it exports
getExports(layer: Layer): Export[] {
  return [
    {
      name: 'mouseX',
      type: 'number',
      getter: () => this.p5Instance.mouseX,
    },
    {
      name: 'canvas',
      type: 'canvas',
      getter: () => this.p5Instance.canvas,
    },
  ];
}

// Another adapter declares what it imports
getImports(): Import[] {
  return [
    { from: 'p5', name: 'mouseX', as: 'modulationX' },
    { from: 'p5', name: 'canvas', as: 'textureSource' },
  ];
}
```

### Real-time Updates Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME UPDATE FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer A (p5)                   StateManager            Layer B      │
│  ┌──────────────┐              ┌──────────────┐        ┌──────────┐  │
│  │ Mouse moves  │─────────────►│ Registers:   │        │ Shader   │  │
│  │ mouseX = 100 │              │ "p5.mouseX"  │        │ wants    │  │
│  └──────────────┘              │ getter       │        │ mouseX   │  │
│                                └──────┬───────┘        └────┬─────┘  │
│                                       │                      │        │
│                                       │ get("p5.mouseX")    │        │
│                                       │◄─────────────────────┤        │
│                                       │                      │        │
│                                       │ Returns: 100         │        │
│                                       │─────────────────────►│        │
│                                       │                      │        │
│                                       │                      ▼        │
│                                       │              Updates uniform   │
│                                       │              shader mouseX     │
└─────────────────────────────────────────────────────────────────────┘
```

### Example: p5 Mouse → Tone Frequency

```typescript
// P5 Layer exports mouse position
// (automatic via P5Adapter)

// Tone Layer imports mouse values
class ToneAdapter {
  getImports(): Import[] {
    return [
      { from: 'p5', name: 'mouseX', as: 'modulationX' },
      { from: 'p5', name: 'mouseY', as: 'modulationY' },
    ];
  }

  render(layer: Layer, container: HTMLElement, context?: RenderContext) {
    // Access imported values via state
    const imports = context?.state.get<Record<string, unknown>>(
      `__imports_${layer.id}`
    );
    
    if (imports) {
      const mouseX = imports.modulationX as number;
      const mouseY = imports.modulationY as number;
      
      // Map to frequency
      const frequency = 200 + (mouseX / window.innerWidth) * 800;
      synth.frequency.value = frequency;
    }
  }
}
```

---

## Rendering Pipeline

### Layer Ordering (z-index)

Layers are rendered in z-index order (lowest to highest):

```typescript
// Get enabled layers sorted by z-index
const layers = layerManager.getEnabledLayers()
  .sort((a, b) => a.config.zIndex - b.config.zIndex);

// Render in order
for (const layer of layers) {
  const adapter = this.adapters.get(layer.type);
  adapter.render(layer, container, context);
}
```

### Blend Modes

Supported blend modes across different rendering contexts:

| Liminal Mode | CSS | Canvas | WebGL |
|--------------|-----|--------|-------|
| `normal` | `normal` | `source-over` | `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` |
| `multiply` | `multiply` | `multiply` | `DST_COLOR, ZERO` |
| `screen` | `screen` | `screen` | `ONE, ONE_MINUS_SRC_COLOR` |
| `overlay` | `overlay` | `overlay` | Approximation |
| `darken` | `darken` | `darken` | `ONE, ONE` |
| `lighten` | `lighten` | `lighten` | `ONE, ONE` |
| `difference` | `difference` | `difference` | `ONE, ONE` |
| `exclusion` | `exclusion` | `exclusion` | `ONE, ONE` |

```typescript
import { applyBlendMode } from './utils/blendModes.js';

// Apply to CSS element
applyBlendMode(element, 'multiply', 'css');

// Apply to Canvas 2D context
applyBlendMode(ctx, 'screen', 'canvas');

// Apply to WebGL context
applyBlendMode(gl, 'overlay', 'webgl');
```

### Mask Application

Three mask modes are supported:

```typescript
type MaskMode = 'alpha' | 'luminance' | 'inverse-alpha';

interface LayerMask {
  id: string;
  sourceLayerId: string;    // Layer used as mask
  targetLayerId: string;    // Layer being masked
  mode: MaskMode;
  invert: boolean;
  feather: number;          // Blur radius
}
```

```typescript
// Create a mask
const mask = maskManager.createMask(
  'source-layer-id',    // Use this layer's output as mask
  'target-layer-id',    // Apply mask to this layer
  'alpha'               // Mask mode
);

// Update mask properties
maskManager.updateMask(mask.id, { feather: 5, invert: true });

// Apply mask during rendering
maskManager.applyMask(container, mask, sourceCanvas);
```

### Performance Considerations

1. **Layer Culling**: Disabled layers are skipped during render
2. **Blend Mode Batch**: Group layers by blend mode when possible
3. **Canvas Reuse**: Adapters should reuse canvas elements
4. **Destroy Cleanup**: Always call `adapter.destroy()` to free resources
5. **Z-index Optimization**: Fewer z-index changes = fewer layer promotions

---

## Smart Composition

### CompositionAnalyzer Algorithm

The analyzer determines which domains are needed for a prompt:

```
┌─────────────────────────────────────────────────────────────────────┐
│                 COMPOSITION ANALYZER FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input: "Create a 3D scene with ambient audio"                       │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────┐                        │
│  │  1. KEYWORD MATCHING                    │                        │
│  │     • "3D" → three (confidence: 0.9)    │                        │
│  │     • "scene" → three (confidence: 0.7) │                        │
│  │     • "audio" → tone (confidence: 0.85) │                        │
│  └─────────────────────────────────────────┘                        │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────┐                        │
│  │  2. DEPENDENCY RESOLUTION               │                        │
│  │     • tone depends on: ['three']        │                        │
│  │     • Reason: Audio syncs with visuals  │                        │
│  └─────────────────────────────────────────┘                        │
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────┐                        │
│  │  3. RENDER ORDER SORT                   │                        │
│  │     1. three (base layer)               │                        │
│  │     2. tone (dependent layer)           │                        │
│  └─────────────────────────────────────────┘                        │
│                        │                                             │
│                        ▼                                             │
│  Output: [{domain: 'three', confidence: 0.9, ...},                 │
│           {domain: 'tone', confidence: 0.85, ...}]                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

```typescript
const analyzer = new CompositionAnalyzer();
const recommendations = await analyzer.analyze('Create a 3D scene with audio');

// Returns:
// [
//   { domain: 'three', confidence: 0.9, dependencies: [] },
//   { domain: 'tone', confidence: 0.85, dependencies: ['three'] }
// ]
```

### LayerSequencer Flow

Generates layers in optimal order with context passing:

```typescript
const sequencer = new LayerSequencer();

const result = await sequencer.generateLayers(
  'Create interactive art',
  ['p5', 'tone'],        // Domains to generate
  {
    generators,           // Map of domain → generator
    onProgress: (done, total) => console.log(`${done}/${total}`),
    continueOnError: true,
    optimizeOrder: true,  // Sort by dependency order
  }
);

// result.layers: Generated layers in render order
// result.errors: Any errors that occurred
```

### Prompt Enhancement

The `PromptEnhancer` adds context from existing layers:

```typescript
const enhancer = new PromptEnhancer();

const enhanced = enhancer.enhance({
  existingLayers: [p5Layer, toneLayer],
  targetDomain: 'shader',
  integrationHints: ['Sync to audio BPM'],
});

// enhanced.prompt - Full prompt with context
// enhanced.context - Extracted layer summaries
// enhanced.instructions - Integration guidance
```

---

## Serialization

### Project Format v2.0

```typescript
interface LiminalProject {
  version: '2.0';
  composition: Composition;
  metadata: {
    created: string;
    modified: string;
    generator?: string;
    version?: string;
  };
  animations?: Animation[];      // v2.0: Keyframe animations
  masks?: LayerMask[];           // v2.0: Layer masks
  assets?: Asset[];              // v2.0: External assets
}

interface Asset {
  id: string;
  type: 'image' | 'audio' | 'font' | 'data';
  url: string;
  data?: string;                 // Base64-encoded for embedding
}
```

### Backward Compatibility

```typescript
// v1.0 format (legacy)
interface LiminalProjectV1 {
  version: '1.0';
  composition: Composition;
  metadata: { ... };
}

// Automatic migration
const serializer = new ProjectSerializer();
const v2Project = serializer.migrateV1ToV2(v1Project);
// Adds empty: animations, masks, assets
```

### ZIP Structure

```
my-project.liminal.zip
├── project.json           # Main project file
├── assets/
│   ├── asset-1.png        # Images
│   ├── asset-2.mp3        # Audio
│   ├── asset-3.woff2      # Fonts
│   └── asset-4.json       # Data
└── README.md              # Optional description
```

```typescript
// Export to ZIP
const zipBlob = await serializer.exportToZip(project);

// Import from ZIP
const project = await serializer.importFromZip(zipBlob);

// Import from URL
const project = await serializer.importFromURL('https://example.com/project.liminal');
```

---

## Extension Points

### Custom Adapters

See [Adapter Pattern](#adapter-pattern) section for full example.

### Custom Blend Modes

Extend the blend mode utilities:

```typescript
// utils/customBlendModes.ts
import { BlendMode } from '../composition/types.js';

export const CUSTOM_BLEND_MODES = ['color-dodge', 'hard-light'] as const;
export type CustomBlendMode = typeof CUSTOM_BLEND_MODES[number];

export function getCustomCSSBlendMode(mode: CustomBlendMode): string {
  return mode;
}

export function getCustomCanvasCompositeOp(mode: CustomBlendMode): string {
  const mapping: Record<CustomBlendMode, string> = {
    'color-dodge': 'color-dodge',
    'hard-light': 'hard-light',
  };
  return mapping[mode];
}
```

### Custom Easing Functions

Extend the keyframe animation system:

```typescript
// Extend KeyframeAnimation
class CustomKeyframeAnimation extends KeyframeAnimation {
  applyEasing(t: number, easing: EasingFunction | 'custom-bounce'): number {
    if (easing === 'custom-bounce') {
      return this.customBounce(t);
    }
    return super.applyEasing(t, easing as EasingFunction);
  }

  private customBounce(t: number): number {
    // Your custom easing formula
    return Math.sin(t * Math.PI) * (1 - t) + t;
  }
}
```

### Hooks and Middleware

The composition system supports lifecycle hooks:

```typescript
interface CompositionHooks {
  // Called before rendering a layer
  beforeRender?: (layer: Layer, context: RenderContext) => void;
  
  // Called after rendering a layer
  afterRender?: (layer: Layer, instance: unknown, context: RenderContext) => void;
  
  // Called when layer state changes
  onLayerChange?: (layer: Layer) => void;
  
  // Called during export
  onExport?: (project: LiminalProject) => LiminalProject;
}

// Usage
const engine = new CompositionEngine({
  onChange: (composition) => {
    // React to composition changes
    console.log('Composition updated:', composition.layers.length, 'layers');
  },
});
```

### Middleware Pattern

```typescript
// Create middleware for layer transformation
type LayerMiddleware = (layer: Layer) => Layer;

const addLoggingMiddleware: LayerMiddleware = (layer) => {
  console.log(`Processing layer: ${layer.id} (${layer.type})`);
  return layer;
};

const optimizeCodeMiddleware: LayerMiddleware = (layer) => {
  // Apply code optimizations
  return {
    ...layer,
    code: optimize(layer.code),
  };
};

// Apply middleware chain
const processLayer = (layer: Layer): Layer => {
  return [addLoggingMiddleware, optimizeCodeMiddleware]
    .reduce((acc, middleware) => middleware(acc), layer);
};
```

---

## Quick Reference

### Common Tasks

```typescript
// Create and register a layer
const layer = createLayer('p5', code, prompt, { generator: 'P5Generator' });
engine.addLayer(layer);

// Update layer config
layerManager.updateLayerConfig(layer.id, { 
  opacity: 0.5, 
  blendMode: 'multiply' 
});

// Export standalone HTML
const html = engine.generateHTML();
fs.writeFileSync('output.html', html);

// Save project
const serializer = new ProjectSerializer();
const project = serializer.exportProject(engine);
fs.writeFileSync('project.liminal', JSON.stringify(project, null, 2));
```

### File Organization

```
src/composition/
├── index.ts                    # Main exports
├── types.ts                    # Core type definitions
├── CompositionEngine.ts        # Main orchestrator
├── LayerManager.ts             # Layer CRUD operations
├── LayerMask.ts                # Mask system
├── KeyframeAnimation.ts        # Animation system
├── CompositionAnalyzer.ts      # Domain detection
├── LayerSequencer.ts           # Sequential generation
├── PromptEnhancer.ts           # Context enhancement
├── ProjectSerializer.ts        # Import/Export
├── adapters/
│   ├── index.ts                # Adapter interface & registry
│   ├── registerAdapters.ts     # Auto-registration
│   ├── P5Adapter.ts            # p5.js adapter
│   ├── ToneAdapter.ts          # Tone.js adapter
│   └── ...                     # Other adapters
└── utils/
    └── blendModes.ts           # Blend mode mappings
```
