/**
 * Import/Export v2.0 Tests - TDD
 *
 * Tests for project serialization including:
 * - v2.0 project format with groups/animation/masks
 * - Backward compatibility with v1.0
 * - ZIP export with assets
 * - Import from URL
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompositionEngine } from '../../../src/composition/CompositionEngine.js';
import { ProjectSerializer } from '../../../src/composition/ProjectSerializer.js';
import {
  createLayer,
  createComposition,
  Layer,
  LiminalProject,
  Animation,
  LayerMask,
} from '../../../src/composition/types.js';
import { KeyframeAnimation } from '../../../src/composition/KeyframeAnimation.js';

describe('ProjectSerializer', () => {
  let engine: CompositionEngine;
  let serializer: ProjectSerializer;
  let keyframeAnimation: KeyframeAnimation;

  beforeEach(() => {
    engine = new CompositionEngine();
    serializer = new ProjectSerializer();
    keyframeAnimation = new KeyframeAnimation();
  });

  describe('v2.0 Project Format', () => {
    it('should export project with version 2.0', () => {
      const layer = createLayer('p5', 'ellipse(50,50,80,80)', 'test prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine);

      expect(project.version).toBe('2.0');
    });

    it('should include composition data', () => {
      const layer = createLayer('p5', 'ellipse(50,50,80,80)', 'test prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine);

      expect(project.composition).toBeDefined();
      expect(project.composition.layers).toHaveLength(1);
      expect(project.composition.layers[0].code).toBe('ellipse(50,50,80,80)');
    });

    it('should include metadata', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine);

      expect(project.metadata).toBeDefined();
      expect(project.metadata.created).toBeDefined();
      expect(project.metadata.modified).toBeDefined();
    });

    it('should export with custom options', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine, {
        includeAssets: true,
        compress: true,
      });

      expect(project.version).toBe('2.0');
    });
  });

  describe('Groups Support', () => {
    it('should export project with layer groups', () => {
      const layer1 = createLayer('p5', 'code1', 'prompt1');
      const layer2 = createLayer('p5', 'code2', 'prompt2');
      engine.addLayer(layer1);
      engine.addLayer(layer2);

      const layerManager = engine.getLayerManager();
      layerManager.createGroup('Test Group', [layer1.id, layer2.id]);

      const project = serializer.exportProject(engine);

      const groupLayer = project.composition.layers.find(l => l.isGroup);
      expect(groupLayer).toBeDefined();
      expect(groupLayer?.name).toBe('Test Group');
      expect(groupLayer?.children).toContain(layer1.id);
      expect(groupLayer?.children).toContain(layer2.id);
    });

    it('should preserve parent-child relationships on export', () => {
      const layer1 = createLayer('p5', 'code1', 'prompt1');
      engine.addLayer(layer1);

      const layerManager = engine.getLayerManager();
      const group = layerManager.createGroup('Group', [layer1.id]);

      const project = serializer.exportProject(engine);

      const exportedLayer = project.composition.layers.find(l => l.id === layer1.id);
      expect(exportedLayer?.parentLayerId).toBe(group.id);
    });

    it('should import project with layer groups', async () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'code1',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'p1', generator: 'g1', model: 'm1', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
              parentLayerId: 'group-1',
            },
            {
              id: 'group-1',
              type: 'group',
              code: '',
              config: { zIndex: 1, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: '', generator: 'group', model: 'none', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
              isGroup: true,
              name: 'Test Group',
              children: ['layer-1'],
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      await serializer.importProject(project, engine);

      const layers = engine.getLayers();
      const group = layers.find(l => l.isGroup);
      const child = layers.find(l => l.id === 'layer-1');

      expect(group).toBeDefined();
      expect(child?.parentLayerId).toBe('group-1');
    });
  });

  describe('Animation Support', () => {
    it('should export project with animations', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const animation = keyframeAnimation.createAnimation(
        layer.id,
        1000,
        [
          { time: 0, properties: { opacity: 0 } },
          { time: 1, properties: { opacity: 1 }, easing: 'ease-in-out' },
        ],
        { loop: true }
      );

      const project = serializer.exportProject(engine, { animations: [animation] });

      expect(project.animations).toBeDefined();
      expect(project.animations).toHaveLength(1);
      expect(project.animations?.[0].layerId).toBe(layer.id);
      expect(project.animations?.[0].duration).toBe(1000);
      expect(project.animations?.[0].loop).toBe(true);
    });

    it('should import project with animations', async () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'code',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'p', generator: 'g', model: 'm', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
        animations: [
          {
            id: 'anim-1',
            layerId: 'layer-1',
            duration: 2000,
            keyframes: [
              { time: 0, properties: { opacity: 0 }, easing: 'linear' },
              { time: 1, properties: { opacity: 1 }, easing: 'ease-out' },
            ],
            loop: false,
            autoplay: true,
          },
        ],
      };

      const result = await serializer.importProject(project, engine);
      expect(result.animations).toBeDefined();
      expect(result.animations).toHaveLength(1);
      expect(result.animations?.[0].id).toBe('anim-1');
    });

    it('should handle empty animations array', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine);

      expect(project.animations).toBeUndefined();
    });
  });

  describe('Mask Support', () => {
    it('should export project with layer masks', () => {
      const layer1 = createLayer('p5', 'code1', 'prompt1');
      const layer2 = createLayer('p5', 'code2', 'prompt2');
      engine.addLayer(layer1);
      engine.addLayer(layer2);

      const maskManager = engine.getMaskManager();
      const mask = maskManager.createMask(layer1.id, layer2.id, 'alpha');

      const project = serializer.exportProject(engine);

      expect(project.masks).toBeDefined();
      expect(project.masks).toHaveLength(1);
      expect(project.masks?.[0].sourceLayerId).toBe(layer1.id);
      expect(project.masks?.[0].targetLayerId).toBe(layer2.id);
      expect(project.masks?.[0].mode).toBe('alpha');
    });

    it('should import project with masks', async () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'code1',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'p1', generator: 'g1', model: 'm1', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
            {
              id: 'layer-2',
              type: 'p5',
              code: 'code2',
              config: { zIndex: 1, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'p2', generator: 'g2', model: 'm2', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
        masks: [
          {
            id: 'mask-1',
            sourceLayerId: 'layer-1',
            targetLayerId: 'layer-2',
            mode: 'luminance',
            invert: true,
            feather: 5,
          },
        ],
      };

      await serializer.importProject(project, engine);

      const maskManager = engine.getMaskManager();
      const masks = maskManager.getAllMasks();

      expect(masks).toHaveLength(1);
      expect(masks[0].mode).toBe('luminance');
      expect(masks[0].invert).toBe(true);
      expect(masks[0].feather).toBe(5);
    });
  });

  describe('Asset Support', () => {
    it('should export project with embedded assets', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const assets = [
        {
          id: 'asset-1',
          type: 'image' as const,
          url: 'https://example.com/image.png',
          data: 'base64encodeddata',
        },
      ];

      const project = serializer.exportProject(engine, { assets });

      expect(project.assets).toBeDefined();
      expect(project.assets).toHaveLength(1);
      expect(project.assets?.[0].type).toBe('image');
      expect(project.assets?.[0].data).toBe('base64encodeddata');
    });

    it('should handle assets without embedded data', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const assets = [
        {
          id: 'asset-1',
          type: 'audio' as const,
          url: 'https://example.com/audio.mp3',
        },
      ];

      const project = serializer.exportProject(engine, { assets });

      expect(project.assets?.[0].url).toBe('https://example.com/audio.mp3');
      expect(project.assets?.[0].data).toBeUndefined();
    });
  });

  describe('Backward Compatibility v1.0', () => {
    it('should migrate v1.0 project to v2.0', () => {
      const v1Project = {
        version: '1.0',
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'ellipse(50,50,80,80)',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'test', generator: 'p5', model: 'test-model', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Legacy Project',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
      };

      const v2Project = serializer.migrateV1ToV2(v1Project);

      expect(v2Project.version).toBe('2.0');
      expect(v2Project.composition).toEqual(v1Project.composition);
      expect(v2Project.animations).toEqual([]);
      expect(v2Project.masks).toEqual([]);
      expect(v2Project.assets).toEqual([]);
    });

    it('should import v1.0 project directly', async () => {
      const v1Project = {
        version: '1.0',
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'ellipse(50,50,80,80)',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'test', generator: 'p5', model: 'test-model', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Legacy Project',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
      };

      await serializer.importProject(v1Project, engine);

      const layers = engine.getLayers();
      expect(layers).toHaveLength(1);
      expect(layers[0].code).toBe('ellipse(50,50,80,80)');
    });
  });

  describe('Project Validation', () => {
    it('should validate valid v2.0 project', () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      const result = serializer.validateProject(project);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject project without version', () => {
      const project = {
        metadata: { created: new Date().toISOString() },
        composition: {},
      };

      const result = serializer.validateProject(project);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid version');
    });

    it('should reject project without composition', () => {
      const project = {
        version: '2.0',
        metadata: { created: new Date().toISOString() },
      };

      const result = serializer.validateProject(project);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing composition');
    });

    it('should reject project with invalid layer structure', () => {
      const project = {
        version: '2.0',
        metadata: { created: new Date().toISOString() },
        composition: {
          id: 'comp-1',
          layers: [{ id: 'bad-layer' }], // Missing required fields
          globalSettings: {},
          metadata: {},
        },
      };

      const result = serializer.validateProject(project);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('layer'))).toBe(true);
    });

    it('should validate supported versions', () => {
      const project = {
        version: '3.0',
        metadata: { created: new Date().toISOString() },
        composition: {
          id: 'comp-1',
          layers: [],
          globalSettings: {},
          metadata: {},
        },
      };

      const result = serializer.validateProject(project);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('version'))).toBe(true);
    });
  });

  describe('ZIP Export/Import', () => {
    it('should export project to ZIP blob', async () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine);
      const zipBlob = await serializer.exportToZip(project);

      expect(zipBlob).toBeInstanceOf(Blob);
      expect(zipBlob.type).toBe('application/zip');
    });

    it('should include project.json in ZIP', async () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const project = serializer.exportProject(engine);
      const zipBlob = await serializer.exportToZip(project);

      // ZIP should contain project.json
      const text = await zipBlob.text();
      expect(text.length).toBeGreaterThan(0);
    });

    it('should import project from ZIP blob', async () => {
      const originalProject: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'ellipse(50,50,80,80)',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'test', generator: 'p5', model: 'm', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'ZIP Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      const zipBlob = await serializer.exportToZip(originalProject);
      const importedProject = await serializer.importFromZip(zipBlob);

      expect(importedProject.version).toBe('2.0');
      expect(importedProject.composition.layers).toHaveLength(1);
      expect(importedProject.composition.layers[0].code).toBe('ellipse(50,50,80,80)');
    });

    it('should handle empty project ZIP export', async () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-empty',
          layers: [],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Empty',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      const zipBlob = await serializer.exportToZip(project);
      expect(zipBlob).toBeInstanceOf(Blob);
    });
  });

  describe('URL Import', () => {
    it('should import project from URL', async () => {
      const mockProject: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'from url',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'url', generator: 'p5', model: 'm', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'URL Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject),
      });
      global.fetch = mockFetch;

      const project = await serializer.importFromURL('https://example.com/project.json');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/project.json');
      expect(project.version).toBe('2.0');
      expect(project.composition.layers[0].code).toBe('from url');
    });

    it('should throw error for failed fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      global.fetch = mockFetch;

      await expect(serializer.importFromURL('https://example.com/notfound.json')).rejects.toThrow(
        'Failed to fetch project: 404 Not Found'
      );
    });

    it('should throw error for invalid JSON response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });
      global.fetch = mockFetch;

      await expect(serializer.importFromURL('https://example.com/bad.json')).rejects.toThrow('Invalid JSON');
    });

    it('should validate imported project from URL', async () => {
      const invalidProject = { version: 'invalid' };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(invalidProject),
      });
      global.fetch = mockFetch;

      await expect(serializer.importFromURL('https://example.com/invalid.json')).rejects.toThrow();
    });
  });

  describe('Import Integration', () => {
    it('should clear existing layers before import', async () => {
      const existingLayer = createLayer('p5', 'existing', 'prompt');
      engine.addLayer(existingLayer);

      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'new-layer',
              type: 'p5',
              code: 'new code',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'new', generator: 'p5', model: 'm', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'New Project',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      await serializer.importProject(project, engine);

      const layers = engine.getLayers();
      expect(layers).toHaveLength(1);
      expect(layers[0].code).toBe('new code');
    });

    it('should update engine settings on import', async () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [],
          globalSettings: {
            width: 1920,
            height: 1080,
            frameRate: 30,
            backgroundColor: '#ffffff',
          },
          metadata: {
            name: 'HD Project',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
      };

      await serializer.importProject(project, engine);

      const settings = engine.getSettings();
      expect(settings.width).toBe(1920);
      expect(settings.height).toBe(1080);
      expect(settings.frameRate).toBe(30);
      expect(settings.backgroundColor).toBe('#ffffff');
    });

    it('should return import result with animations and masks', async () => {
      const project: LiminalProject = {
        version: '2.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
        composition: {
          id: 'comp-1',
          layers: [
            {
              id: 'layer-1',
              type: 'p5',
              code: 'code',
              config: { zIndex: 0, blendMode: 'normal', opacity: 1, position: { x: 0, y: 0 }, scale: 1 },
              metadata: { prompt: 'p', generator: 'g', model: 'm', generatedAt: new Date().toISOString() },
              enabled: true,
              locked: false,
            },
          ],
          globalSettings: {
            width: 800,
            height: 600,
            frameRate: 60,
            backgroundColor: '#000000',
          },
          metadata: {
            name: 'Test',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tags: [],
          },
        },
        animations: [
          {
            id: 'anim-1',
            layerId: 'layer-1',
            duration: 1000,
            keyframes: [{ time: 0, properties: { opacity: 0 } }],
          },
        ],
        masks: [
          {
            id: 'mask-1',
            sourceLayerId: 'layer-1',
            targetLayerId: 'layer-1',
            mode: 'alpha',
            invert: false,
            feather: 0,
          },
        ],
      };

      const result = await serializer.importProject(project, engine);

      expect(result.animations).toHaveLength(1);
      expect(result.masks).toHaveLength(1);
    });
  });
});
