/**
 * Layer Groups Tests - TDD
 *
 * Tests for layer grouping functionality including:
 * - Group creation
 * - Nested groups (max depth 3)
 * - Group operations (toggle, opacity, move)
 * - Flatten groups
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayerManager } from '../../../src/composition/LayerManager.js';
import { createLayer, Layer } from '../../../src/composition/types.js';

describe('LayerGroups', () => {
  let manager: LayerManager;
  let layer1: Layer;
  let layer2: Layer;
  let layer3: Layer;

  beforeEach(() => {
    manager = new LayerManager();
    layer1 = createLayer('p5', 'code1', 'prompt1');
    layer2 = createLayer('p5', 'code2', 'prompt2');
    layer3 = createLayer('p5', 'code3', 'prompt3');
    manager.addLayer(layer1);
    manager.addLayer(layer2);
    manager.addLayer(layer3);
  });

  describe('Group Creation', () => {
    it('should create a group from layer IDs', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);

      expect(group?.isGroup).toBe(true);
      expect(group.name).toBe('My Group');
      expect(group.children).toEqual([layer1.id, layer2.id]);
    });

    it('should set parentLayerId on grouped layers', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);

      const updatedLayer1 = manager.getLayer(layer1.id);
      const updatedLayer2 = manager.getLayer(layer2.id);

      expect(updatedLayer1?.parentLayerId).toBe(group.id);
      expect(updatedLayer2?.parentLayerId).toBe(group.id);
    });

    it('should return null for empty layerIds array', () => {
      const group = manager.createGroup('Empty Group', []);
      expect(group).toBeNull();
    });

    it('should return null if any layer ID does not exist', () => {
      const group = manager.createGroup('Invalid Group', [layer1.id, 'nonexistent']);
      expect(group).toBeNull();
    });

    it('should add group to layers array', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);

      const allLayers = manager.getLayers();
      const groupLayer = allLayers.find(l => l.id === group.id);

      expect(groupLayer?.isGroup).toBe(true);
    });

    it('should have group type as "group"', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      expect(group.type).toBe('group');
    });
  });

  describe('Move to Group', () => {
    it('should move a layer to a group', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      const result = manager.moveToGroup(layer2.id, group.id);

      expect(result).toBe(true);

      const updatedGroup = manager.getLayer(group.id);
      expect(updatedGroup?.children).toContain(layer2.id);

      const updatedLayer2 = manager.getLayer(layer2.id);
      expect(updatedLayer2?.parentLayerId).toBe(group.id);
    });

    it('should return false for nonexistent layer', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      const result = manager.moveToGroup('nonexistent', group.id);

      expect(result).toBe(false);
    });

    it('should return false for nonexistent group', () => {
      const result = manager.moveToGroup(layer1.id, 'nonexistent');
      expect(result).toBe(false);
    });

    it('should return false if target is not a group', () => {
      const result = manager.moveToGroup(layer2.id, layer1.id);
      expect(result).toBe(false);
    });

    it('should not duplicate layer in group', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      manager.moveToGroup(layer1.id, group.id);

      const updatedGroup = manager.getLayer(group.id);
      const occurrences = updatedGroup?.children?.filter(id => id === layer1.id).length;
      expect(occurrences).toBe(1);
    });
  });

  describe('Remove from Group', () => {
    it('should remove a layer from its group', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      const result = manager.removeFromGroup(layer1.id);

      expect(result).toBe(true);

      const updatedGroup = manager.getLayer(group.id);
      expect(updatedGroup?.children).not.toContain(layer1.id);

      const updatedLayer1 = manager.getLayer(layer1.id);
      expect(updatedLayer1?.parentLayerId).toBeUndefined();
    });

    it('should return false for nonexistent layer', () => {
      const result = manager.removeFromGroup('nonexistent');
      expect(result).toBe(false);
    });

    it('should return false if layer is not in a group', () => {
      const result = manager.removeFromGroup(layer1.id);
      expect(result).toBe(false);
    });

    it('should keep other layers in group', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      manager.removeFromGroup(layer1.id);

      const updatedGroup = manager.getLayer(group.id);
      expect(updatedGroup?.children).toContain(layer2.id);
    });
  });

  describe('Group Operations', () => {
    it('should toggle all layers in group', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      const result = manager.toggleGroup(group.id);

      expect(result).toBe(true);

      const updatedLayer1 = manager.getLayer(layer1.id);
      const updatedLayer2 = manager.getLayer(layer2.id);

      expect(updatedLayer1?.enabled).toBe(false);
      expect(updatedLayer2?.enabled).toBe(false);
    });

    it('should return false when toggling nonexistent group', () => {
      const result = manager.toggleGroup('nonexistent');
      expect(result).toBe(false);
    });

    it('should set opacity for all layers in group', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      const result = manager.setGroupOpacity(group.id, 0.5);

      expect(result).toBe(true);

      const updatedLayer1 = manager.getLayer(layer1.id);
      const updatedLayer2 = manager.getLayer(layer2.id);

      expect(updatedLayer1?.config.opacity).toBe(0.5);
      expect(updatedLayer2?.config.opacity).toBe(0.5);
    });

    it('should return false for invalid opacity values', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      expect(manager.setGroupOpacity(group.id, -0.1)).toBe(false);
      expect(manager.setGroupOpacity(group.id, 1.5)).toBe(false);
    });

    it('should move group to new z-index', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      const result = manager.moveGroup(group.id, 10);

      expect(result).toBe(true);

      const updatedGroup = manager.getLayer(group.id);
      expect(updatedGroup?.config.zIndex).toBe(10);
    });

    it('should return false when moving nonexistent group', () => {
      const result = manager.moveGroup('nonexistent', 10);
      expect(result).toBe(false);
    });
  });

  describe('Nested Groups', () => {
    it('should create nested groups', () => {
      const innerGroup = manager.createGroup('Inner', [layer1.id]);
      const outerGroup = manager.createGroup('Outer', [innerGroup.id]);

      expect(outerGroup.isGroup).toBe(true);
      expect(outerGroup.children).toContain(innerGroup.id);

      const updatedInner = manager.getLayer(innerGroup.id);
      expect(updatedInner?.parentLayerId).toBe(outerGroup.id);
    });

    it('should calculate correct group depth', () => {
      const innerGroup = manager.createGroup('Inner', [layer1.id]);
      const middleGroup = manager.createGroup('Middle', [innerGroup.id]);
      const outerGroup = manager.createGroup('Outer', [middleGroup.id]);

      expect(manager.getGroupDepth(layer1.id)).toBe(3);
      expect(manager.getGroupDepth(innerGroup.id)).toBe(2);
      expect(manager.getGroupDepth(middleGroup.id)).toBe(1);
      expect(manager.getGroupDepth(outerGroup.id)).toBe(0);
    });

    it('should return 0 depth for non-grouped layer', () => {
      expect(manager.getGroupDepth(layer1.id)).toBe(0);
    });

    it('should prevent nesting beyond max depth of 3', () => {
      const group1 = manager.createGroup('Level 1', [layer1.id]);
      const group2 = manager.createGroup('Level 2', [group1.id]);
      const group3 = manager.createGroup('Level 3', [group2.id]);

      // This should fail - would be depth 4
      const group4 = manager.createGroup('Level 4', [group3.id]);
      const result = manager.moveToGroup(group3.id, group4.id);

      expect(result).toBe(false);
    });

    it('should prevent creating group that exceeds max depth', () => {
      const group1 = manager.createGroup('Level 1', [layer1.id]);
      const group2 = manager.createGroup('Level 2', [group1.id]);
      const group3 = manager.createGroup('Level 3', [group2.id]);

      // Trying to move layer2 into group1 would create depth 4
      const result = manager.moveToGroup(group3.id, group1.id);
      expect(result).toBe(false);
    });
  });

  describe('Get Group Layers', () => {
    it('should return all layers in a group', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      const layers = manager.getGroupLayers(group.id);

      expect(layers).toHaveLength(2);
      expect(layers.map(l => l.id)).toContain(layer1.id);
      expect(layers.map(l => l.id)).toContain(layer2.id);
    });

    it('should return empty array for non-group layer', () => {
      const layers = manager.getGroupLayers(layer1.id);
      expect(layers).toEqual([]);
    });

    it('should return empty array for nonexistent group', () => {
      const layers = manager.getGroupLayers('nonexistent');
      expect(layers).toEqual([]);
    });

    it('should return only direct children (not nested)', () => {
      const innerGroup = manager.createGroup('Inner', [layer1.id]);
      const outerGroup = manager.createGroup('Outer', [innerGroup.id, layer2.id]);

      const outerLayers = manager.getGroupLayers(outerGroup.id);
      expect(outerLayers).toHaveLength(1);
      expect(outerLayers[0].id).toBe(layer2.id);
    });
  });

  describe('Flatten Group', () => {
    it('should flatten group and remove parent references', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      const result = manager.flattenGroup(group.id);

      expect(result).toBe(true);

      const updatedLayer1 = manager.getLayer(layer1.id);
      const updatedLayer2 = manager.getLayer(layer2.id);

      expect(updatedLayer1?.parentLayerId).toBeUndefined();
      expect(updatedLayer2?.parentLayerId).toBeUndefined();
    });

    it('should remove group layer after flatten', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      const groupId = group.id;

      manager.flattenGroup(group.id);

      expect(manager.getLayer(groupId)).toBeUndefined();
    });

    it('should return false for non-group layer', () => {
      const result = manager.flattenGroup(layer1.id);
      expect(result).toBe(false);
    });

    it('should return false for nonexistent layer', () => {
      const result = manager.flattenGroup('nonexistent');
      expect(result).toBe(false);
    });

    it('should preserve layer properties when flattening', () => {
      manager.updateLayerConfig(layer1.id, { opacity: 0.5 });
      const group = manager.createGroup('My Group', [layer1.id]);

      manager.flattenGroup(group.id);

      const updatedLayer1 = manager.getLayer(layer1.id);
      expect(updatedLayer1?.config.opacity).toBe(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle removing group with layers', () => {
      const group = manager.createGroup('My Group', [layer1.id, layer2.id]);
      manager.removeLayer(group.id);

      // Layers should still exist but without parent
      const updatedLayer1 = manager.getLayer(layer1.id);
      const updatedLayer2 = manager.getLayer(layer2.id);

      expect(updatedLayer1).not.toBeNull();
      expect(updatedLayer2).not.toBeNull();
      expect(updatedLayer1?.parentLayerId).toBeUndefined();
      expect(updatedLayer2?.parentLayerId).toBeUndefined();
    });

    it('should not allow group to be its own child', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      const result = manager.moveToGroup(group.id, group.id);

      expect(result).toBe(false);
    });

    it('should not allow circular group references', () => {
      const group1 = manager.createGroup('Group 1', [layer1.id]);
      const group2 = manager.createGroup('Group 2', [layer2.id]);

      // Move group2 into group1
      manager.moveToGroup(group2.id, group1.id);

      // Try to move group1 into group2 (would create cycle)
      const result = manager.moveToGroup(group1.id, group2.id);
      expect(result).toBe(false);
    });

    it('should handle group with no children gracefully', () => {
      const group = manager.createGroup('My Group', [layer1.id]);
      manager.removeFromGroup(layer1.id);

      const updatedGroup = manager.getLayer(group.id);
      expect(updatedGroup?.children).toEqual([]);
    });
  });
});
