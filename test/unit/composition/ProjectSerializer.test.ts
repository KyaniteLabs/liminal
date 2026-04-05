import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectSerializer } from '../../../src/composition/ProjectSerializer.js';
import type { LiminalProject, LiminalProjectV1 } from '../../../src/composition/types.js';

// ═══════════════════════════════════════════════════════════════════════════
// vi.hoisted() — mandatory for all mock variables referenced in vi.mock()
// ═══════════════════════════════════════════════════════════════════════════

const { mockGetLayers, mockGetSettings, mockGetMaskManager, mockCleanup, mockUpdateSettings, mockGetLayerManager } = vi.hoisted(() => ({
  mockGetLayers: vi.fn(),
  mockGetSettings: vi.fn(),
  mockGetMaskManager: vi.fn(),
  mockCleanup: vi.fn(),
  mockUpdateSettings: vi.fn(),
  mockGetLayerManager: vi.fn(),
}));

const { mockClearMasks, mockGetAllMasks, mockCreateMask, mockGetMasksForLayer, mockUpdateMask } = vi.hoisted(() => ({
  mockClearMasks: vi.fn(),
  mockGetAllMasks: vi.fn(() => []),
  mockCreateMask: vi.fn(),
  mockGetMasksForLayer: vi.fn(() => []),
  mockUpdateMask: vi.fn(),
}));

const { mockClear, mockAddLayer } = vi.hoisted(() => ({
  mockClear: vi.fn(),
  mockAddLayer: vi.fn(),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeEngine(overrides: Record<string, unknown> = {}) {
  const maskManager = {
    clearMasks: mockClearMasks,
    getAllMasks: mockGetAllMasks,
    createMask: mockCreateMask,
    getMasksForLayer: mockGetMasksForLayer,
    updateMask: mockUpdateMask,
  };
  const layerManager = {
    clear: mockClear,
    addLayer: mockAddLayer,
  };
  return {
    getLayers: mockGetLayers.mockReturnValue([]),
    getSettings: mockGetSettings.mockReturnValue({ width: 400, height: 400 }),
    getMaskManager: mockGetMaskManager.mockReturnValue(maskManager),
    getLayerManager: mockGetLayerManager.mockReturnValue(layerManager),
    cleanup: mockCleanup,
    updateSettings: mockUpdateSettings,
    ...overrides,
  };
}

function validV2Project(overrides: Partial<LiminalProject> = {}): LiminalProject {
  return {
    version: '2.0',
    composition: {
      id: 'comp_test',
      layers: [{
        id: 'layer_1', type: 'p5', code: 'setup(){}', config: {}, metadata: {},
        enabled: true, locked: false,
      }],
      globalSettings: { width: 400, height: 400 },
      metadata: { name: 'Test', createdAt: '2024-01-01', modifiedAt: '2024-01-01', tags: [] },
    },
    metadata: { created: '2024-01-01', modified: '2024-01-01' },
    ...overrides,
  };
}

function validV1Project(): LiminalProjectV1 {
  return {
    version: '1.0',
    composition: {
      id: 'comp_v1',
      layers: [{
        id: 'layer_v1', type: 'p5', code: 'draw(){}', config: {}, metadata: {},
        enabled: true, locked: false,
      }],
      globalSettings: { width: 200, height: 200 },
      metadata: { name: 'V1 Project', createdAt: '2023-01-01', modifiedAt: '2023-01-01', tags: [] },
    },
    metadata: { created: '2023-01-01', modified: '2023-01-01' },
  };
}

describe('ProjectSerializer', () => {
  let serializer: ProjectSerializer;

  beforeEach(() => {
    vi.clearAllMocks();
    serializer = new ProjectSerializer();
  });

  // ───────────────────────────────────────────────────────────────────────
  // exportProject
  // ───────────────────────────────────────────────────────────────────────
  describe('exportProject', () => {
    it('exports engine state with version 2.0', () => {
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any);
      expect(project.version).toBe('2.0');
      expect(project.composition.id).toMatch(/^comp_\d+$/);
      expect(project.composition.layers).toEqual([]);
    });

    it('includes global settings from engine', () => {
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any);
      expect(project.composition.globalSettings).toEqual({ width: 400, height: 400 });
    });

    it('includes animations when provided in options', () => {
      const engine = makeEngine();
      const animations = [{ id: 'anim_1', type: 'loop' as const, layers: ['layer_1'], config: {}, duration: 60 }];
      const project = serializer.exportProject(engine as any, { animations });
      expect(project.animations).toEqual(animations);
    });

    it('omits animations when empty array provided', () => {
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any, { animations: [] });
      expect(project.animations).toBeUndefined();
    });

    it('includes masks from mask manager', () => {
      const masks = [{ id: 'mask_1', sourceLayerId: 'a', targetLayerId: 'b', mode: 'multiply' as const }];
      mockGetAllMasks.mockReturnValue(masks);
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any);
      expect(project.masks).toEqual(masks);
    });

    it('omits masks when none exist', () => {
      mockGetAllMasks.mockReturnValue([]);
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any);
      expect(project.masks).toBeUndefined();
    });

    it('includes assets when provided in options', () => {
      const engine = makeEngine();
      const assets = [{ id: 'asset_1', type: 'image' as const, name: 'bg.png', data: 'base64data' }];
      const project = serializer.exportProject(engine as any, { assets });
      expect(project.assets).toEqual(assets);
    });

    it('omits assets when empty array provided', () => {
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any, { assets: [] });
      expect(project.assets).toBeUndefined();
    });

    it('sets metadata timestamps', () => {
      const engine = makeEngine();
      const project = serializer.exportProject(engine as any);
      expect(project.metadata.created).toBeTruthy();
      expect(project.metadata.modified).toBeTruthy();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // importProject
  // ───────────────────────────────────────────────────────────────────────
  describe('importProject', () => {
    it('imports v2.0 project successfully', async () => {
      const engine = makeEngine();
      const project = validV2Project();
      const result = await serializer.importProject(project, engine as any);

      expect(result.animations).toEqual([]);
      expect(result.masks).toEqual([]);
      expect(result.assets).toEqual([]);
      expect(mockCleanup).toHaveBeenCalled();
      expect(mockAddLayer).toHaveBeenCalledTimes(1);
    });

    it('migrates and imports v1.0 project', async () => {
      const engine = makeEngine();
      const v1 = validV1Project();
      const result = await serializer.importProject(v1, engine as any);

      expect(result.animations).toEqual([]);
      expect(result.masks).toEqual([]);
      expect(result.assets).toEqual([]);
    });

    it('imports project with animations', async () => {
      const engine = makeEngine();
      const animations = [{ id: 'anim_1', type: 'loop' as const, layers: ['layer_1'], config: {}, duration: 60 }];
      const project = validV2Project({ animations });
      const result = await serializer.importProject(project, engine as any);
      expect(result.animations).toEqual(animations);
    });

    it('imports project with masks', async () => {
      const engine = makeEngine();
      const masks = [{ id: 'mask_1', sourceLayerId: 'layer_1', targetLayerId: 'layer_2', mode: 'multiply' as const }];
      const project = validV2Project({ masks });
      mockGetMasksForLayer.mockReturnValue([]);
      const result = await serializer.importProject(project, engine as any);
      expect(result.masks).toEqual(masks);
      expect(mockCreateMask).toHaveBeenCalledWith('layer_1', 'layer_2', 'multiply');
    });

    it('imports project with masks and updates created mask', async () => {
      const engine = makeEngine();
      const masks = [{ id: 'mask_1', sourceLayerId: 'layer_1', targetLayerId: 'layer_2', mode: 'multiply' as const, invert: true, feather: 5 }];
      const project = validV2Project({ masks });
      mockGetMasksForLayer.mockReturnValue([{ id: 'mask_created', sourceLayerId: 'layer_1' }]);
      await serializer.importProject(project, engine as any);
      expect(mockUpdateMask).toHaveBeenCalledWith('mask_created', { invert: true, feather: 5 });
    });

    it('throws on invalid project', async () => {
      const engine = makeEngine();
      await expect(serializer.importProject({} as any, engine as any)).rejects.toThrow('Invalid project');
    });

    it('imports project with assets', async () => {
      const engine = makeEngine();
      const assets = [{ id: 'asset_1', type: 'image' as const, name: 'bg.png' }];
      const project = validV2Project({ assets });
      const result = await serializer.importProject(project, engine as any);
      expect(result.assets).toEqual(assets);
    });

    it('defaults to empty arrays for missing optional fields', async () => {
      const engine = makeEngine();
      const project = validV2Project(); // no animations, masks, or assets
      const result = await serializer.importProject(project, engine as any);
      expect(result.animations).toEqual([]);
      expect(result.masks).toEqual([]);
      expect(result.assets).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // validateProject
  // ───────────────────────────────────────────────────────────────────────
  describe('validateProject', () => {
    it('validates a correct v2.0 project', () => {
      const result = serializer.validateProject(validV2Project());
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('validates a correct v1.0 project', () => {
      const result = serializer.validateProject(validV1Project());
      expect(result.valid).toBe(true);
    });

    it('rejects null', () => {
      const result = serializer.validateProject(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Project must be an object');
    });

    it('rejects non-object', () => {
      const result = serializer.validateProject('string');
      expect(result.valid).toBe(false);
    });

    it('rejects missing version', () => {
      const project = validV2Project();
      delete (project as any).version;
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid version');
    });

    it('rejects unsupported version', () => {
      const project = validV2Project();
      project.version = '3.0';
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Unsupported version: 3.0');
    });

    it('rejects missing composition', () => {
      const result = serializer.validateProject({ version: '2.0' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing composition');
    });

    it('rejects composition missing id', () => {
      const project = validV2Project();
      delete (project.composition as any).id;
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Composition missing id');
    });

    it('rejects composition missing layers', () => {
      const project = validV2Project();
      delete (project.composition as any).layers;
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Composition missing layers array');
    });

    it('rejects composition missing globalSettings', () => {
      const project = validV2Project();
      delete (project.composition as any).globalSettings;
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Composition missing globalSettings');
    });

    it('rejects composition missing metadata', () => {
      const project = validV2Project();
      delete (project.composition as any).metadata;
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Composition missing metadata');
    });

    it('rejects invalid layer (not object)', () => {
      const project = validV2Project();
      project.composition.layers = ['not an object' as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Layer 0 must be an object');
    });

    it('rejects layer missing id', () => {
      const project = validV2Project();
      project.composition.layers = [{ type: 'p5', code: 'x', config: {}, metadata: {}, enabled: true, locked: false } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Layer 0 missing id');
    });

    it('rejects layer missing type', () => {
      const project = validV2Project();
      project.composition.layers = [{ id: 'l1', code: 'x', config: {}, metadata: {}, enabled: true, locked: false } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('missing type');
    });

    it('rejects layer missing code', () => {
      const project = validV2Project();
      project.composition.layers = [{ id: 'l1', type: 'p5', config: {}, metadata: {}, enabled: true, locked: false } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('missing code');
    });

    it('rejects layer missing config', () => {
      const project = validV2Project();
      project.composition.layers = [{ id: 'l1', type: 'p5', code: 'x', metadata: {}, enabled: true, locked: false } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('missing config');
    });

    it('rejects layer missing metadata', () => {
      const project = validV2Project();
      project.composition.layers = [{ id: 'l1', type: 'p5', code: 'x', config: {}, enabled: true, locked: false } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('missing metadata');
    });

    it('rejects layer missing enabled', () => {
      const project = validV2Project();
      project.composition.layers = [{ id: 'l1', type: 'p5', code: 'x', config: {}, metadata: {}, locked: false } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('missing enabled flag');
    });

    it('rejects layer missing locked', () => {
      const project = validV2Project();
      project.composition.layers = [{ id: 'l1', type: 'p5', code: 'x', config: {}, metadata: {}, enabled: true } as any];
      const result = serializer.validateProject(project);
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('missing locked flag');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // migrateV1ToV2
  // ───────────────────────────────────────────────────────────────────────
  describe('migrateV1ToV2', () => {
    it('converts v1.0 to v2.0 format', () => {
      const v1 = validV1Project();
      const v2 = serializer.migrateV1ToV2(v1);
      expect(v2.version).toBe('2.0');
      expect(v2.animations).toEqual([]);
      expect(v2.masks).toEqual([]);
      expect(v2.assets).toEqual([]);
      expect(v2.composition).toBe(v1.composition);
      expect(v2.metadata).toBe(v1.metadata);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // exportToZip
  // ───────────────────────────────────────────────────────────────────────
  describe('exportToZip', () => {
    it('returns a Blob (fallback in Node)', async () => {
      const project = validV2Project();
      const blob = await serializer.exportToZip(project);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('fallback blob contains JSON', async () => {
      const project = validV2Project();
      const blob = await serializer.exportToZip(project);
      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.version).toBe('2.0');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // importFromZip
  // ───────────────────────────────────────────────────────────────────────
  describe('importFromZip', () => {
    it('parses JSON blob as project (fallback)', async () => {
      const project = validV2Project();
      const json = JSON.stringify(project);
      const blob = new Blob([json], { type: 'application/json' });
      const result = await serializer.importFromZip(blob);
      expect(result.version).toBe('2.0');
      expect(result.composition.id).toBe('comp_test');
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // importFromURL
  // ───────────────────────────────────────────────────────────────────────
  describe('importFromURL', () => {
    it('fetches and validates project from URL', async () => {
      const project = validV2Project();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(project),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await serializer.importFromURL('https://example.com/project.json');
      expect(result.version).toBe('2.0');
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/project.json');
      vi.unstubAllGlobals();
    });

    it('throws on non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(serializer.importFromURL('https://example.com/missing.json'))
        .rejects.toThrow('Failed to fetch project: 404 Not Found');
      vi.unstubAllGlobals();
    });

    it('throws on invalid project from URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: true }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(serializer.importFromURL('https://example.com/bad.json'))
        .rejects.toThrow('Invalid project from URL');
      vi.unstubAllGlobals();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // getAssetExtension
  // ───────────────────────────────────────────────────────────────────────
  describe('getAssetExtension (via exportProject assets)', () => {
    it('handles image assets via export path', async () => {
      // Test getAssetExtension indirectly through exportToZip with assets
      const project = validV2Project({
        assets: [
          { id: 'img1', type: 'image' as const, name: 'bg.png', data: 'dGVzdA==' },
        ],
      });
      const blob = await serializer.exportToZip(project);
      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.assets[0].type).toBe('image');
    });
  });
});
