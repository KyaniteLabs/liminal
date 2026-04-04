/**
 * Layer Adapter Interface and Registry
 *
 * Adapters bridge between Layer objects and their runtime environments.
 * Each domain (p5, three, tone, etc.) has its own adapter.
 */

import type { Layer, DomainType, GlobalSettings } from '../types.js';
import type { RenderContext } from '../CompositionEngine.js';

/** What a layer exports for other layers to consume */
export interface Export {
  /** Export name */
  name: string;
  
  /** Type */
  type: 'number' | 'string' | 'boolean' | 'canvas' | 'audio' | 'object' | 'function';
  
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

/** Layer adapter interface */
export interface LayerAdapter {
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

/**
 * Adapter registry - singleton for managing adapters.
 */
export class AdapterRegistry {
  private adapters = new Map<DomainType, LayerAdapter>();
  
  /**
   * Register an adapter for a domain type.
   */
  register(type: DomainType, adapter: LayerAdapter): void {
    this.adapters.set(type, adapter);
  }
  
  /**
   * Get adapter for a domain type.
   */
  get(type: DomainType): LayerAdapter | undefined {
    return this.adapters.get(type);
  }
  
  /**
   * Check if adapter exists for a domain type.
   */
  has(type: DomainType): boolean {
    return this.adapters.has(type);
  }
  
  /**
   * Get all registered domain types.
   */
  getTypes(): DomainType[] {
    return Array.from(this.adapters.keys());
  }
}

// Export adapters
export { ASCIIArtAdapter, asciiArtAdapter } from './ASCIIArtAdapter.js';
export { StrudelAdapter, strudelAdapter } from './StrudelAdapter.js';
export { ShaderAdapter, shaderAdapter } from './ShaderAdapter.js';
export { ThreeAdapter, threeAdapter } from './ThreeAdapter.js';
export { HTMLAdapter, htmlAdapter } from './HTMLAdapter.js';
export { RemotionAdapter, remotionAdapter } from './RemotionAdapter.js';
export { HydraAdapter, hydraAdapter } from './HydraAdapter.js';
export { P5Adapter, p5Adapter } from './P5Adapter.js';
export { ToneAdapter, toneAdapter } from './ToneAdapter.js';

/** Global adapter registry instance */
export const adapterRegistry = new AdapterRegistry();

// Re-export registration utilities
export { registerAllAdapters, allAdapters } from './registerAdapters.js';
