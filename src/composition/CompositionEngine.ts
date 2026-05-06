/**
 * CompositionEngine - Orchestrates multi-layer compositions.
 *
 * Renders layers into a unified output, manages cross-layer communication,
 * and exports to various formats.
 */

import { Layer, Composition, DomainType, GlobalSettings, DEFAULT_GLOBAL_SETTINGS, LiminalProject, Animation, LayerMask } from './types.js';
import { LayerManager } from './LayerManager.js';
import { LayerAdapter, Import } from './adapters/index.js';
import { LayerMaskManager } from './LayerMask.js';
import { getCSSBlendMode } from './utils/blendModes.js';
import { Logger } from '../utils/Logger.js';
import { ProjectSerializer } from './ProjectSerializer.js';

export interface CompositionEngineOptions {
  /** Container element for rendering */
  container?: HTMLElement;
  
  /** Initial global settings */
  settings?: Partial<GlobalSettings>;
  
  /** Callback when composition changes */
  onChange?: (composition: Composition) => void;
}

export interface RenderContext {
  /** Shared state manager for cross-layer communication */
  state: StateManager;
  
  /** Container element */
  container: HTMLElement;
  
  /** Global settings */
  settings: GlobalSettings;
  
  /** Active layer instances */
  layerInstances: Map<string, unknown>;
}

/**
 * Manages shared state between layers.
 */
export class StateManager {
  private state = new Map<string, () => unknown>();
  private subscribers = new Map<string, Set<(value: unknown) => void>>();

  /**
   * Register a value getter for a key.
   */
  register(key: string, getter: () => unknown): void {
    this.state.set(key, getter);
  }

  /**
   * Get a value by key.
   */
  get<T>(key: string): T | undefined {
    const getter = this.state.get(key);
    return getter ? (getter() as T) : undefined;
  }

  /**
   * Subscribe to value changes.
   */
  subscribe(key: string, callback: (value: unknown) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Clear all state.
   */
  clear(): void {
    this.state.clear();
    this.subscribers.clear();
  }
}

export class CompositionEngine {
  private layerManager: LayerManager;
  private maskManager: LayerMaskManager;
  private adapters = new Map<DomainType, LayerAdapter>();
  private settings: GlobalSettings;
  private container?: HTMLElement;
  private onChange?: (composition: Composition) => void;
  private renderContext?: RenderContext;

  constructor(options?: CompositionEngineOptions) {
    this.settings = { ...DEFAULT_GLOBAL_SETTINGS, ...options?.settings };
    this.container = options?.container;
    this.onChange = options?.onChange;
    
    this.layerManager = new LayerManager({
      onChange: () => this.handleLayersChange(),
    });
    
    this.maskManager = new LayerMaskManager();
  }

  /**
   * Register a layer adapter for a domain type.
   */
  registerAdapter(type: DomainType, adapter: LayerAdapter): void {
    this.adapters.set(type, adapter);
  }

  /**
   * Get the layer manager.
   */
  getLayerManager(): LayerManager {
    return this.layerManager;
  }

  /**
   * Get the mask manager.
   */
  getMaskManager(): LayerMaskManager {
    return this.maskManager;
  }

  /**
   * Add a layer to the composition.
   */
  addLayer(layer: Layer): void {
    this.layerManager.addLayer(layer);
  }

  /**
   * Remove a layer.
   */
  removeLayer(id: string): boolean {
    return this.layerManager.removeLayer(id);
  }

  /**
   * Get all layers.
   */
  getLayers(): Layer[] {
    return this.layerManager.getLayers();
  }

  /**
   * Update global settings.
   */
  updateSettings(settings: Partial<GlobalSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.handleLayersChange();
  }

  /**
   * Get current settings.
   */
  getSettings(): GlobalSettings {
    return { ...this.settings };
  }

  /**
   * Set the render container.
   */
  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * Render the composition to the container.
   */
  render(): void {
    if (!this.container) {
      throw new Error('CompositionEngine: No container set. Call setContainer() first.');
    }

    // Clean up previous render
    this.cleanup();

    // Create render context
    const stateManager = new StateManager();
    const layerInstances = new Map<string, unknown>();
    
    this.renderContext = {
      state: stateManager,
      container: this.container,
      settings: this.settings,
      layerInstances,
    };

    // Clear container
    this.container.innerHTML = '';
    
    // Set up container styles for layering
    this.container.style.position = 'relative';
    this.container.style.width = `${this.settings.width}px`;
    this.container.style.height = `${this.settings.height}px`;
    this.container.style.backgroundColor = this.settings.backgroundColor;
    this.container.style.overflow = 'hidden';

    // Get enabled layers sorted by z-index
    const layers = this.layerManager.getEnabledLayers()
      .sort((a, b) => a.config.zIndex - b.config.zIndex);

    // First pass: set up exports from all layers
    for (const layer of layers) {
      const adapter = this.adapters.get(layer.type);
      if (!adapter) {
        Logger.warn('CompositionEngine', `No adapter registered for layer type: ${layer.type}`);
        continue;
      }

      const exports = adapter.getExports?.(layer) || [];
      for (const exp of exports) {
        const key = `${layer.type}.${exp.name}`;
        stateManager.register(key, exp.getter);
      }
    }

    // Second pass: render layers
    for (const layer of layers) {
      const adapter = this.adapters.get(layer.type);
      if (!adapter) continue;

      // Create layer container
      const layerContainer = document.createElement('div');
      layerContainer.style.position = 'absolute';
      layerContainer.style.top = '0';
      layerContainer.style.left = '0';
      layerContainer.style.width = '100%';
      layerContainer.style.height = '100%';
      layerContainer.style.zIndex = String(layer.config.zIndex);
      layerContainer.style.opacity = String(layer.config.opacity);
      layerContainer.style.transform = `translate(${layer.config.position.x}px, ${layer.config.position.y}px) scale(${layer.config.scale})`;
      layerContainer.style.pointerEvents = layer.type === 'p5' || layer.type === 'three' ? 'auto' : 'none';

      // Apply blend mode
      if (layer.config.blendMode !== 'normal') {
        layerContainer.style.mixBlendMode = getCSSBlendMode(layer.config.blendMode);
      }

      // Apply transparent background
      if (layer.config.transparentBackground) {
        layerContainer.style.background = 'transparent';
      }
      
      this.container.appendChild(layerContainer);

      // Set up imports
      const imports = adapter.getImports?.(layer) || [];
      this.setupImports(layer, imports, stateManager);

      // Render layer
      try {
        const instance = adapter.render(layer, layerContainer, this.renderContext);
        layerInstances.set(layer.id, instance);
      } catch (error) {
        Logger.error('CompositionEngine', `Error rendering layer ${layer.id}:`, error);
      }
    }
  }

  /**
   * Clean up all layers and resources.
   */
  cleanup(): void {
    if (!this.renderContext) return;

    // Destroy layer instances
    for (const [layerId, instance] of this.renderContext.layerInstances) {
      const layer = this.layerManager.getLayer(layerId);
      if (layer) {
        const adapter = this.adapters.get(layer.type);
        adapter?.destroy?.(layer, instance);
      }
    }

    // Clear state
    this.renderContext.state.clear();
    this.renderContext.layerInstances.clear();
    this.renderContext = undefined;
  }

  /**
   * Export composition to Liminal project format.
   * @deprecated Use ProjectSerializer.exportProject() instead
   */
  exportProject(name: string): LiminalProject {
    const serializer = new ProjectSerializer();
    const project = serializer.exportProject(this, { includeAssets: true });
    if (name.trim().length > 0) {
      project.composition.metadata.name = name;
    }
    return project;
  }

  /**
   * Import from Liminal project format.
   * @deprecated Use ProjectSerializer.importProject() instead
   */
  async importProject(project: LiminalProject): Promise<void> {
    const serializer = new ProjectSerializer();
    await serializer.importProject(project, this);
  }

  /**
   * Get all animations from the keyframe animation system.
   * Delegates to LayerManager which tracks animations per layer.
   */
  getAnimations(): Animation[] {
    return this.layerManager.exportAnimations();
  }

  /**
   * Get all masks from the mask manager.
   */
  getMasks(): LayerMask[] {
    return this.maskManager.getAllMasks();
  }

  /**
   * Export layers for serialization.
   */
  exportLayers(): Layer[] {
    return this.layerManager.exportLayers();
  }

  /**
   * Import layers from serialized data.
   */
  importLayers(layers: Layer[]): void {
    this.layerManager.importLayers(layers);
  }

  /**
   * Generate standalone HTML file.
   */
  generateHTML(): string {
    const layers = this.layerManager.getEnabledLayers()
      .sort((a, b) => a.config.zIndex - b.config.zIndex);

    const layerScripts = layers.map(layer => {
      const adapter = this.adapters.get(layer.type);
      if (!adapter?.generateScript) return '';
      return adapter.generateScript(layer, this.settings);
    }).filter(Boolean).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liminal Composition</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      background: ${this.settings.backgroundColor};
    }
    #composition {
      position: relative;
      width: ${this.settings.width}px;
      height: ${this.settings.height}px;
    }
    .layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="composition"></div>
  
${layerScripts}
</body>
</html>`;
  }

  private setupImports(layer: Layer, imports: Import[], stateManager: StateManager): void {
    // Create a proxy object that layers can use to access imports
    const importProxy: Record<string, unknown> = {};
    
    for (const imp of imports) {
      const key = `${imp.from}.${imp.name}`;
      Object.defineProperty(importProxy, imp.as, {
        get: () => stateManager.get(key),
        enumerable: true,
      });
    }

    // Store proxy for the layer to use during rendering
    if (this.renderContext) {
      this.renderContext.state.register(`__imports_${layer.id}`, () => importProxy);
    }
  }

  private handleLayersChange(): void {
    this.onChange?.(this.getComposition());
  }

  private getComposition(): Composition {
    return {
      id: `comp_${Date.now()}`,
      layers: this.layerManager.exportLayers(),
      globalSettings: this.settings,
      metadata: {
        name: 'Untitled',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        tags: [],
      },
    };
  }
}
