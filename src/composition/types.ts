/**
 * Layer-based composition types for Liminal.
 *
 * Enables combining outputs from multiple generators into
 * editable, composable projects.
 */

import type { LLMResponse } from '../llm/LLMClient.js';

/** Domain types supported by Liminal generators */
export type DomainType =
  | 'p5'
  | 'three'
  | 'shader'
  | 'tone'
  | 'music'
  | 'strudel'
  | 'hydra'
  | 'ascii'
  | 'remotion'
  | 'video'
  | 'html'
  | 'textgen'
  | 'group';

/** Blend modes for layer compositing */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'difference'
  | 'exclusion';

/** Semantic role of a layer within a composition */
export type LayerRole = 'background' | 'overlay' | 'mask' | 'standalone';

/** Mask modes for layer masking */
export type MaskMode = 'alpha' | 'luminance' | 'inverse-alpha';

/** Layer mask configuration */
export interface LayerMask {
  /** Unique identifier */
  id: string;

  /** Layer ID used as the mask source */
  sourceLayerId: string;

  /** Layer ID being masked */
  targetLayerId: string;

  /** Mask mode */
  mode: MaskMode;

  /** Whether to invert the mask */
  invert: boolean;

  /** Feather/blur radius in pixels */
  feather: number;
}

/** A single layer in a composition */
export interface Layer {
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

/** Configuration for how a layer renders */
export interface LayerConfig {
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

  /** Semantic role within the composition */
  role: LayerRole;

  /** Whether this layer renders with a transparent background */
  transparentBackground: boolean;
}

/** Metadata about a layer's generation */
export interface LayerMetadata {
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

/** Default layer configuration */
export const DEFAULT_LAYER_CONFIG: LayerConfig = {
  zIndex: 0,
  blendMode: 'normal',
  opacity: 1.0,
  position: { x: 0, y: 0 },
  scale: 1.0,
  role: 'standalone',
  transparentBackground: false,
};

/** A complete composition of multiple layers */
export interface Composition {
  /** Unique identifier */
  id: string;

  /** Layer stack (bottom to top) */
  layers: Layer[];

  /** Global settings shared across all layers */
  globalSettings: GlobalSettings;

  /** Composition metadata */
  metadata: CompositionMetadata;
}

/** Global settings for a composition */
export interface GlobalSettings {
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

/** Audio configuration */
export interface AudioSettings {
  /** Sample rate */
  sampleRate: number;

  /** Whether audio is enabled */
  enabled: boolean;

  /** Master volume 0-1 */
  volume: number;
}

/** Default global settings */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
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

/** Composition metadata */
export interface CompositionMetadata {
  /** Name/title */
  name: string;

  /** Description */
  description?: string;

  /** Created timestamp */
  createdAt: string;

  /** Last modified timestamp */
  modifiedAt: string;

  /** Tags */
  tags: string[];
}

/** Asset types supported in projects */
export type AssetType = 'image' | 'audio' | 'font' | 'data';

/** External asset reference */
export interface Asset {
  /** Unique identifier */
  id: string;

  /** Asset type */
  type: AssetType;

  /** Source URL */
  url: string;

  /** Base64-encoded data for embedded assets */
  data?: string;
}

/** Liminal project file format v2.0 */
export interface LiminalProject {
  /** File format version */
  version: '2.0' | '1.0';

  /** The composition */
  composition: Composition;

  /** Project metadata */
  metadata: {
    created: string;
    modified: string;
    generator?: string;
    version?: string;
  };

  /** Keyframe animations (v2.0) */
  animations?: Animation[];

  /** Layer masks (v2.0) */
  masks?: LayerMask[];

  /** External assets (v2.0) */
  assets?: Asset[];
}

/** Legacy v1.0 project format */
export interface LiminalProjectV1 {
  /** File format version */
  version: '1.0';

  /** The composition */
  composition: Composition;

  /** Project metadata */
  metadata: {
    created: string;
    modified: string;
    generator?: string;
    version?: string;
  };
}

/** Supported easing functions for keyframe animations */
export type EasingFunction =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'bounce'
  | 'elastic'
  | 'back-in'
  | 'back-out';

/** A single keyframe defining layer properties at a specific time */
export interface Keyframe {
  /** Time position 0-1 (start to end) */
  time: number;

  /** Properties to apply at this time */
  properties: Partial<LayerConfig>;

  /** Easing function to use from this keyframe to the next */
  easing?: EasingFunction;
}

/** Animation configuration for a layer */
export interface Animation {
  /** Unique identifier */
  id: string;

  /** Target layer ID */
  layerId: string;

  /** Duration in milliseconds */
  duration: number;

  /** Keyframe definitions */
  keyframes: Keyframe[];

  /** Whether animation should loop */
  loop?: boolean;

  /** Whether animation should start automatically */
  autoplay?: boolean;
}

/** What a layer exports for other layers to consume */
export interface Export {
  /** Export name */
  name: string;

  /** Type */
  type: 'number' | 'string' | 'boolean' | 'canvas' | 'audio' | 'object';

  /** Getter function to retrieve value */
  getter: () => unknown;

  /** Description */
  description?: string;
}

/** What a layer imports from other layers */
export interface Import {
  /** Source domain type */
  from: DomainType;

  /** Export name to import */
  name: string;

  /** Local alias */
  as: string;

  /** Is required */
  required?: boolean;
}

/**
 * Create a Layer from generator output.
 */
export function createLayer(
  type: DomainType,
  code: string,
  prompt: string,
  metadata?: Partial<LayerMetadata>,
  config?: Partial<LayerConfig>
): Layer {
  return {
    id: generateLayerId(),
    type,
    code,
    config: { ...DEFAULT_LAYER_CONFIG, ...config },
    metadata: {
      prompt,
      generator: metadata?.generator || 'unknown',
      model: metadata?.model || 'unknown',
      generatedAt: new Date().toISOString(),
      ...metadata,
    },
    enabled: true,
    locked: false,
  };
}

/**
 * Create a Layer from an LLMResponse.
 */
export function createLayerFromResponse(
  type: DomainType,
  response: LLMResponse,
  prompt: string,
  generator: string,
  model: string
): Layer {
  return createLayer(type, response.code, prompt, {
    generator,
    model,
    thinking: response.thinking,
    recoveredFromThinking: response.recoveredFromThinking,
  });
}

/** Generate unique layer ID */
function generateLayerId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty composition.
 */
export function createComposition(
  name: string,
  settings?: Partial<GlobalSettings>
): Composition {
  const now = new Date().toISOString();
  return {
    id: generateCompositionId(),
    layers: [],
    globalSettings: { ...DEFAULT_GLOBAL_SETTINGS, ...settings },
    metadata: {
      name,
      createdAt: now,
      modifiedAt: now,
      tags: [],
    },
  };
}

/** Generate unique composition ID */
function generateCompositionId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export a composition to Liminal project format.
 */
export function exportProject(composition: Composition): LiminalProject {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    composition,
    metadata: {
      created: composition.metadata.createdAt,
      modified: now,
    },
  };
}
