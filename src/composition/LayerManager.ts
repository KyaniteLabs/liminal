/**
 * LayerManager - CRUD operations for composition layers.
 *
 * Manages layer lifecycle: create, edit, move, toggle, delete, duplicate.
 * Also manages layer groups with support for nested groups (max depth 3).
 * Also manages keyframe animations for layers.
 */

import { Layer, LayerConfig, DomainType, Animation, Keyframe } from './types.js';
import { KeyframeAnimation } from './KeyframeAnimation.js';

/** Maximum nesting depth for layer groups */
const MAX_GROUP_DEPTH = 3;

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
   * If the layer is a group, its children are unparented.
   * If the layer is a child of a group, it's removed from the group.
   */
  removeLayer(id: string): boolean {
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1) return false;

    const layer = this.layers[index];
    
    // If this layer is a group, unparent all children
    if (layer.isGroup && layer.children) {
      for (const childId of layer.children) {
        const child = this.layers.find(l => l.id === childId);
        if (child) {
          child.parentLayerId = undefined;
        }
      }
    }

    // Remove the layer from parent's children array if it's a child
    if (layer.parentLayerId) {
      const parent = this.layers.find(l => l.id === layer.parentLayerId);
      if (parent && parent.children) {
        parent.children = parent.children.filter(childId => childId !== id);
      }
    }
    
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

  // ==================== GROUP OPERATIONS ====================

  /**
   * Create a group from layer IDs.
   * @param name - Group name
   * @param layerIds - IDs of layers to include in the group
   * @returns The created group layer, or null if invalid
   */
  createGroup(name: string, layerIds: string[]): Layer | null {
    // Validate input
    if (layerIds.length === 0) return null;

    // Verify all layer IDs exist
    for (const id of layerIds) {
      const layer = this.layers.find(l => l.id === id);
      if (!layer) return null;
    }

    // Check that nesting wouldn't exceed max depth
    for (const id of layerIds) {
      if (this.getGroupDepth(id) >= MAX_GROUP_DEPTH) {
        return null;
      }
    }

    // Create the group layer
    const groupId = this.generateLayerId();
    const group: Layer = {
      id: groupId,
      type: 'group',
      code: '',
      config: {
        zIndex: 0,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: '',
        generator: 'LayerManager',
        model: 'internal',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
      isGroup: true,
      children: [...layerIds],
      name,
    };

    // Auto-assign z-index
    if (this.layers.length > 0) {
      const maxZ = Math.max(...this.layers.map(l => l.config.zIndex));
      group.config.zIndex = maxZ + 1;
    }

    // Update parentLayerId for all grouped layers
    for (const id of layerIds) {
      const layer = this.layers.find(l => l.id === id);
      if (layer) {
        layer.parentLayerId = groupId;
      }
    }

    this.layers.push(group);
    this.emitChange();
    return group;
  }

  /**
   * Move a layer to a group.
   * @param layerId - ID of layer to move
   * @param groupId - ID of target group
   * @returns true if successful
   */
  moveToGroup(layerId: string, groupId: string): boolean {
    const layer = this.layers.find(l => l.id === layerId);
    const group = this.layers.find(l => l.id === groupId);

    if (!layer || !group) return false;
    if (!group.isGroup) return false;
    if (layerId === groupId) return false; // Can't be its own child

    // Check for circular reference
    if (this.wouldCreateCycle(layerId, groupId)) return false;

    // Check depth limit - target group depth + 1 + tree depth of item being moved
    const targetDepth = this.getGroupDepth(groupId);
    const itemTreeDepth = this.getTreeDepth(layerId);
    if (targetDepth + 1 + itemTreeDepth > MAX_GROUP_DEPTH) return false;

    // Remove from current parent if exists
    if (layer.parentLayerId) {
      const currentParent = this.layers.find(l => l.id === layer.parentLayerId);
      if (currentParent && currentParent.children) {
        currentParent.children = currentParent.children.filter(id => id !== layerId);
      }
    }

    // Add to new group (avoid duplicates)
    if (!group.children?.includes(layerId)) {
      group.children = group.children || [];
      group.children.push(layerId);
    }

    // Update parent reference
    layer.parentLayerId = groupId;

    this.emitChange();
    return true;
  }

  /**
   * Remove a layer from its group.
   * @param layerId - ID of layer to remove from group
   * @returns true if successful
   */
  removeFromGroup(layerId: string): boolean {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return false;
    if (!layer.parentLayerId) return false;

    const parent = this.layers.find(l => l.id === layer.parentLayerId);
    if (!parent || !parent.children) return false;

    // Remove from parent's children
    parent.children = parent.children.filter(id => id !== layerId);

    // Clear parent reference
    layer.parentLayerId = undefined;

    this.emitChange();
    return true;
  }

  /**
   * Toggle all layers in a group.
   * @param groupId - ID of group to toggle
   * @returns true if successful
   */
  toggleGroup(groupId: string): boolean {
    const group = this.layers.find(l => l.id === groupId);
    if (!group || !group.isGroup) return false;

    const newEnabledState = !group.enabled;
    group.enabled = newEnabledState;

    // Toggle all children
    if (group.children) {
      for (const childId of group.children) {
        const child = this.layers.find(l => l.id === childId);
        if (child) {
          child.enabled = newEnabledState;
        }
      }
    }

    this.emitChange();
    return true;
  }

  /**
   * Set opacity for all layers in a group.
   * @param groupId - ID of group
   * @param opacity - Opacity value (0-1)
   * @returns true if successful
   */
  setGroupOpacity(groupId: string, opacity: number): boolean {
    // Validate opacity
    if (opacity < 0 || opacity > 1) return false;

    const group = this.layers.find(l => l.id === groupId);
    if (!group || !group.isGroup) return false;

    group.config.opacity = opacity;

    // Apply to all children
    if (group.children) {
      for (const childId of group.children) {
        const child = this.layers.find(l => l.id === childId);
        if (child) {
          child.config.opacity = opacity;
        }
      }
    }

    this.emitChange();
    return true;
  }

  /**
   * Move a group to a new z-index.
   * @param groupId - ID of group
   * @param newZIndex - New z-index position
   * @returns true if successful
   */
  moveGroup(groupId: string, newZIndex: number): boolean {
    const group = this.layers.find(l => l.id === groupId);
    if (!group || !group.isGroup) return false;

    group.config.zIndex = newZIndex;
    this.emitChange();
    return true;
  }

  /**
   * Flatten a group - remove the group and unparent all children.
   * @param groupId - ID of group to flatten
   * @returns true if successful
   */
  flattenGroup(groupId: string): boolean {
    const group = this.layers.find(l => l.id === groupId);
    if (!group || !group.isGroup) return false;

    // Unparent all children
    if (group.children) {
      for (const childId of group.children) {
        const child = this.layers.find(l => l.id === childId);
        if (child) {
          child.parentLayerId = undefined;
        }
      }
    }

    // Remove the group layer
    const index = this.layers.findIndex(l => l.id === groupId);
    if (index !== -1) {
      this.layers.splice(index, 1);
    }

    this.emitChange();
    return true;
  }

  /**
   * Get all layers that are direct children of a group.
   * @param groupId - ID of group
   * @returns Array of child layers
   */
  getGroupLayers(groupId: string): Layer[] {
    const group = this.layers.find(l => l.id === groupId);
    if (!group || !group.isGroup || !group.children) {
      return [];
    }

    // Return only non-group children (direct children only)
    return group.children
      .map(id => this.layers.find(l => l.id === id))
      .filter((l): l is Layer => l !== undefined && !l.isGroup);
  }

  /**
   * Get the nesting depth of a layer within groups.
   * @param layerId - ID of layer
   * @returns Depth (0 = not in a group, 1 = in a group, etc.)
   */
  getGroupDepth(layerId: string): number {
    let depth = 0;
    let currentId = layerId;

    while (currentId) {
      const layer = this.layers.find(l => l.id === currentId);
      if (!layer || !layer.parentLayerId) break;

      depth++;
      currentId = layer.parentLayerId;
    }

    return depth;
  }

  /**
   * Get the maximum tree depth of a layer and its descendants.
   * @param layerId - ID of layer
   * @returns Tree depth (0 = no children, 1 = has children, etc.)
   */
  getTreeDepth(layerId: string): number {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer || !layer.isGroup || !layer.children || layer.children.length === 0) {
      return 0;
    }

    let maxChildDepth = 0;
    for (const childId of layer.children) {
      const childDepth = this.getTreeDepth(childId);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }

  // ==================== ANIMATION OPERATIONS ====================

  private animationEngine = new KeyframeAnimation();
  private layerAnimations = new Map<string, Animation[]>();

  /**
   * Create a keyframe animation for a layer.
   * @param layerId - ID of target layer
   * @param duration - Animation duration in milliseconds
   * @param keyframes - Array of keyframes
   * @param options - Animation options (loop, autoplay)
   * @returns The created animation, or null if layer not found
   */
  createAnimation(
    layerId: string,
    duration: number,
    keyframes: Keyframe[],
    options?: { loop?: boolean; autoplay?: boolean }
  ): Animation | null {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) return null;

    const animation = this.animationEngine.createAnimation(layerId, duration, keyframes, options);

    // Store animation for the layer
    const existingAnimations = this.layerAnimations.get(layerId) || [];
    existingAnimations.push(animation);
    this.layerAnimations.set(layerId, existingAnimations);

    return animation;
  }

  /**
   * Get all animations for a layer.
   * @param layerId - ID of layer
   * @returns Array of animations (empty if none)
   */
  getAnimations(layerId: string): Animation[] {
    return this.layerAnimations.get(layerId) || [];
  }

  /**
   * Remove an animation by ID.
   * @param animationId - ID of animation to remove
   * @returns true if removed, false if not found
   */
  removeAnimation(animationId: string): boolean {
    for (const [layerId, animations] of this.layerAnimations.entries()) {
      const index = animations.findIndex(a => a.id === animationId);
      if (index !== -1) {
        animations.splice(index, 1);
        if (animations.length === 0) {
          this.layerAnimations.delete(layerId);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Play a layer animation.
   * @param animationId - ID of animation to play
   * @returns true if found and played
   */
  playAnimation(animationId: string): boolean {
    for (const animations of this.layerAnimations.values()) {
      const animation = animations.find(a => a.id === animationId);
      if (animation) {
        this.animationEngine.play(animation);
        return true;
      }
    }
    return false;
  }

  /**
   * Pause a layer animation.
   * @param animationId - ID of animation to pause
   * @returns true if found and paused
   */
  pauseAnimation(animationId: string): boolean {
    for (const animations of this.layerAnimations.values()) {
      const animation = animations.find(a => a.id === animationId);
      if (animation) {
        this.animationEngine.pause(animation);
        return true;
      }
    }
    return false;
  }

  /**
   * Stop a layer animation.
   * @param animationId - ID of animation to stop
   * @returns true if found and stopped
   */
  stopAnimation(animationId: string): boolean {
    for (const animations of this.layerAnimations.values()) {
      const animation = animations.find(a => a.id === animationId);
      if (animation) {
        this.animationEngine.stop(animation);
        return true;
      }
    }
    return false;
  }

  /**
   * Generate CSS for an animation.
   * @param animationId - ID of animation
   * @returns CSS string, or null if not found
   */
  generateAnimationCSS(animationId: string): string | null {
    for (const animations of this.layerAnimations.values()) {
      const animation = animations.find(a => a.id === animationId);
      if (animation) {
        return this.animationEngine.generateCSS(animation);
      }
    }
    return null;
  }

  /**
   * Generate JavaScript for an animation.
   * @param animationId - ID of animation
   * @returns JS string, or null if not found
   */
  generateAnimationJS(animationId: string): string | null {
    for (const animations of this.layerAnimations.values()) {
      const animation = animations.find(a => a.id === animationId);
      if (animation) {
        return this.animationEngine.generateJS(animation);
      }
    }
    return null;
  }

  /**
   * Interpolate layer properties at a specific time in an animation.
   * @param animationId - ID of animation
   * @param time - Time position 0-1
   * @returns Interpolated properties, or null if not found
   */
  interpolateAnimation(animationId: string, time: number): Partial<LayerConfig> | null {
    for (const animations of this.layerAnimations.values()) {
      const animation = animations.find(a => a.id === animationId);
      if (animation) {
        return this.animationEngine.interpolate(animation, time);
      }
    }
    return null;
  }

  /**
   * Export all animations across all layers.
   * @returns Flat array of all animations
   */
  exportAnimations(): Animation[] {
    const all: Animation[] = [];
    for (const animations of this.layerAnimations.values()) {
      all.push(...animations);
    }
    return all;
  }

  // ==================== PRIVATE HELPERS ====================

  private emitChange(): void {
    // Use void operator to handle both sync and async callbacks
    void this.onChange?.(this.getLayers());
  }

  private generateLayerId(): string {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if moving a layer to a group would create a cycle.
   */
  private wouldCreateCycle(layerId: string, groupId: string): boolean {
    // Check if groupId is a descendant of layerId
    let currentId: string | undefined = groupId;

    while (currentId) {
      if (currentId === layerId) return true;

      const layer = this.layers.find(l => l.id === currentId);
      currentId = layer?.parentLayerId;
    }

    return false;
  }
}
