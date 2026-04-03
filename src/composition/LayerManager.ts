/**
 * LayerManager - CRUD operations for composition layers.
 *
 * Manages layer lifecycle: create, edit, move, toggle, delete, duplicate.
 */

import { Layer, LayerConfig, DomainType } from './types.js';

export interface LayerManagerOptions {
  /** Callback when layers change */
  onChange?: (layers: Layer[]) => void;
}

export class LayerManager {
  private layers: Layer[] = [];
  private onChange?: (layers: Layer[]) => void;

  constructor(options?: LayerManagerOptions) {
    this.onChange = options?.onChange;
  }

  /**
   * Get all layers (sorted by z-index).
   */
  getLayers(): Layer[] {
    return [...this.layers].sort((a, b) => a.config.zIndex - b.config.zIndex);
  }

  /**
   * Get a single layer by ID.
   */
  getLayer(id: string): Layer | undefined {
    return this.layers.find(l => l.id === id);
  }

  /**
   * Add a layer to the composition.
   */
  addLayer(layer: Layer): void {
    // Auto-assign z-index if not set
    if (layer.config.zIndex === 0 && this.layers.length > 0) {
      const maxZ = Math.max(...this.layers.map(l => l.config.zIndex));
      layer.config.zIndex = maxZ + 1;
    }
    
    this.layers.push(layer);
    this.emitChange();
  }

  /**
   * Remove a layer by ID.
   */
  removeLayer(id: string): boolean {
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1) return false;
    
    this.layers.splice(index, 1);
    this.emitChange();
    return true;
  }

  /**
   * Update a layer's code and metadata.
   */
  updateLayer(id: string, updates: Partial<Pick<Layer, 'code' | 'enabled' | 'locked' | 'metadata'>>): boolean {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return false;
    
    if (updates.code !== undefined) layer.code = updates.code;
    if (updates.enabled !== undefined) layer.enabled = updates.enabled;
    if (updates.locked !== undefined) layer.locked = updates.locked;
    if (updates.metadata !== undefined) {
      layer.metadata = { ...layer.metadata, ...updates.metadata };
    }
    
    this.emitChange();
    return true;
  }

  /**
   * Update a layer's configuration.
   */
  updateLayerConfig(id: string, config: Partial<LayerConfig>): boolean {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return false;
    
    layer.config = { ...layer.config, ...config };
    this.emitChange();
    return true;
  }

  /**
   * Move layer to new z-index position.
   */
  moveLayer(id: string, newZIndex: number): boolean {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return false;
    
    layer.config.zIndex = newZIndex;
    this.emitChange();
    return true;
  }

  /**
   * Reorder layers by array of IDs (bottom to top).
   */
  reorderLayers(orderedIds: string[]): boolean {
    if (orderedIds.length !== this.layers.length) return false;
    
    // Verify all IDs exist
    const currentIds = new Set(this.layers.map(l => l.id));
    if (!orderedIds.every(id => currentIds.has(id))) return false;
    
    // Update z-index based on position
    orderedIds.forEach((id, index) => {
      const layer = this.layers.find(l => l.id === id);
      if (layer) layer.config.zIndex = index;
    });
    
    this.emitChange();
    return true;
  }

  /**
   * Toggle layer enabled state.
   */
  toggleLayer(id: string): boolean {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return false;
    
    layer.enabled = !layer.enabled;
    this.emitChange();
    return true;
  }

  /**
   * Toggle layer locked state.
   */
  toggleLocked(id: string): boolean {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return false;
    
    layer.locked = !layer.locked;
    this.emitChange();
    return true;
  }

  /**
   * Duplicate a layer.
   */
  duplicateLayer(id: string): Layer | null {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) return null;
    
    const duplicated: Layer = {
      ...layer,
      id: this.generateLayerId(),
      config: {
        ...layer.config,
        zIndex: layer.config.zIndex + 1,
      },
      metadata: {
        ...layer.metadata,
        generatedAt: new Date().toISOString(),
      },
    };
    
    this.layers.push(duplicated);
    this.emitChange();
    return duplicated;
  }

  /**
   * Get layers by type.
   */
  getLayersByType(type: DomainType): Layer[] {
    return this.layers.filter(l => l.type === type);
  }

  /**
   * Get enabled layers only.
   */
  getEnabledLayers(): Layer[] {
    return this.layers.filter(l => l.enabled);
  }

  /**
   * Clear all layers.
   */
  clear(): void {
    this.layers = [];
    this.emitChange();
  }

  /**
   * Get layer count.
   */
  get count(): number {
    return this.layers.length;
  }

  /**
   * Export layers array.
   */
  exportLayers(): Layer[] {
    return [...this.layers];
  }

  /**
   * Import layers array.
   */
  importLayers(layers: Layer[]): void {
    this.layers = [...layers];
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange?.(this.getLayers());
  }

  private generateLayerId(): string {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
