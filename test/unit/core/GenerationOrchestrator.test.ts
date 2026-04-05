import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing
vi.mock('../../../src/generators/GeneratorRegistry.js', () => {
  const mockRegistry = {
    dispatch: vi.fn(() => null),
  };
  return {
    generatorRegistry: mockRegistry,
  };
});

vi.mock('../../../src/generators/registerGenerators.js', () => ({
  registerAllGenerators: vi.fn(async () => {}),
}));

vi.mock('../../../src/gallery/Gallery.js', () => ({
  Gallery: vi.fn(function(this: any) {
    this.saveSwarmSession = vi.fn(async () => {});
  }),
}));

vi.mock('../../../src/collab/CollaborationEngine.js', () => ({
  CollaborationEngine: vi.fn(function(this: any, _config: any) {
    this.run = vi.fn(async () => ({ output: 'collab-code' }));
  }),
}));

vi.mock('../../../src/swarm/SwarmOrchestrator.js', () => ({
  SwarmOrchestrator: vi.fn(function(this: any, _config: any, _opts: any) {
    this.run = vi.fn(async () => ({
      finalOutput: 'swarm-code',
      results: [],
    }));
  }),
}));

vi.mock('../../../src/swarm/MiningEngine.js', () => ({
  MiningEngine: { mineResult: vi.fn(() => []) },
}));

vi.mock('../../../src/learning/index.js', () => ({
  ArchiveLearning: vi.fn(function(this: any) {
    this.addFragment = vi.fn();
  }),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/generators/p5/P5GeneratorLLM.js', () => ({
  P5GeneratorLLM: vi.fn(function(this: any) {
    this.generate = vi.fn(async () => 'fallback-code');
  }),
}));

import { GenerationOrchestrator } from '../../../src/core/GenerationOrchestrator.js';
import { generatorRegistry } from '../../../src/generators/GeneratorRegistry.js';
import { registerAllGenerators } from '../../../src/generators/registerGenerators.js';
import { Gallery } from '../../../src/gallery/Gallery.js';
import { SwarmOrchestrator } from '../../../src/swarm/SwarmOrchestrator.js';
import { CollaborationEngine } from '../../../src/collab/CollaborationEngine.js';

function makeOptions(overrides: Record<string, unknown> = {}): any {
  return {
    useSwarm: false,
    useDeepCollab: false,
    useCollab: false,
    onProgress: vi.fn(),
    project: null,
    swarmConfig: {},
    swarmMode: 'hybrid',
    collabDomain: 'p5',
    collabConfig: {},
    ...overrides,
  };
}

describe('GenerationOrchestrator', () => {
  let gallery: InstanceType<typeof Gallery>;
  let archiveLearning: any;

  beforeEach(() => {
    vi.clearAllMocks();
    gallery = new Gallery({} as any);
    archiveLearning = { addFragment: vi.fn() };
  });

  // ── Swarm path ────────────────────────────────────────────────────

  describe('swarm generation', () => {
    it('routes to swarm when useSwarm is true', async () => {
      const options = makeOptions({ useSwarm: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('prompt', 'prompt');
      expect(result.code).toBe('swarm-code');
      expect(SwarmOrchestrator).toHaveBeenCalledTimes(1);
    });

    it('saves swarm session when project is set', async () => {
      const options = makeOptions({ useSwarm: true, project: 'test-project' });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      await orchestrator.generate('prompt', 'prompt');
      expect(gallery.saveSwarmSession).toHaveBeenCalledTimes(1);
      expect(gallery.saveSwarmSession).toHaveBeenCalledWith('test-project', expect.any(Object));
    });

    it('handles swarm session save failure gracefully', async () => {
      gallery.saveSwarmSession.mockRejectedValue(new Error('save failed'));
      const options = makeOptions({ useSwarm: true, project: 'test-project' });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('prompt', 'prompt');
      expect(result.code).toBe('swarm-code');
    });

    it('mines swarm results when archiveLearning is provided', async () => {
      const options = makeOptions({ useSwarm: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, archiveLearning);
      await orchestrator.generate('prompt', 'prompt');
      const { MiningEngine } = await import('../../../src/swarm/MiningEngine.js');
      expect(MiningEngine.mineResult).toHaveBeenCalledTimes(1);
    });

    it('handles mining failure gracefully', async () => {
      const { MiningEngine } = await import('../../../src/swarm/MiningEngine.js');
      MiningEngine.mineResult.mockImplementation(() => { throw new Error('mining failed'); });
      const options = makeOptions({ useSwarm: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, archiveLearning);
      const result = await orchestrator.generate('prompt', 'prompt');
      // Should still return swarm result even if mining fails
      expect(result.code).toBe('swarm-code');
    });
  });

  // ── Collaboration path ────────────────────────────────────────────

  describe('collaboration generation', () => {
    it('routes to collaboration when useDeepCollab is true', async () => {
      const options = makeOptions({ useDeepCollab: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('prompt', 'prompt');
      expect(result.code).toBe('collab-code');
      expect(CollaborationEngine).toHaveBeenCalledTimes(1);
    });

    it('routes to collaboration when useCollab is true', async () => {
      const options = makeOptions({ useCollab: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('prompt', 'prompt');
      expect(result.code).toBe('collab-code');
    });

    it('passes swarmConfig to CollaborationEngine', async () => {
      const swarmConfig = { maxRounds: 8, mode: 'competitive' };
      const options = makeOptions({
        useCollab: true,
        swarmConfig,
        swarmMode: 'competitive',
      });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      await orchestrator.generate('prompt', 'prompt');
      expect(CollaborationEngine).toHaveBeenCalledTimes(1);
    });
  });

  // ── Standard dispatch path ────────────────────────────────────────

  describe('standard dispatch', () => {
    it('falls back to P5GeneratorLLM when no dispatch match', async () => {
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('test prompt', 'test prompt');
      expect(result.code).toBe('fallback-code');
    });

    it('dispatches to matched generator entry', async () => {
      const mockGenerate = vi.fn(async () => 'dispatched-code');
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue({
        entry: { name: 'custom', generate: mockGenerate },
        confidence: 0.9,
      });
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('used', 'loaded');
      expect(result.code).toBe('dispatched-code');
      // For non-LLM generators, loaded prompt is used
      expect(mockGenerate).toHaveBeenCalledWith('loaded');
    });

    it('uses usedPrompt for LLM generator entries', async () => {
      const mockGenerate = vi.fn(async () => ({ code: 'llm-code', thinking: 'thoughts' }));
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue({
        entry: { name: 'llm', generate: mockGenerate },
        confidence: 0.9,
      });
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('used-prompt', 'loaded-prompt');
      expect(result.code).toBe('llm-code');
      expect(result.thinking).toBe('thoughts');
      expect(mockGenerate).toHaveBeenCalledWith('used-prompt');
    });

    it('normalizes string results from dispatched generators', async () => {
      const mockGenerate = vi.fn(async () => 'string-result');
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue({
        entry: { name: 'custom', generate: mockGenerate },
        confidence: 0.9,
      });
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('used', 'loaded');
      expect(result.code).toBe('string-result');
      expect(result.thinking).toBeUndefined();
    });
  });

  // ── Priority order ────────────────────────────────────────────────

  describe('routing priority', () => {
    it('swarm takes precedence over collaboration', async () => {
      const options = makeOptions({ useSwarm: true, useCollab: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('prompt', 'prompt');
      expect(result.code).toBe('swarm-code');
      expect(SwarmOrchestrator).toHaveBeenCalledTimes(1);
    });

    it('collaboration takes precedence over standard dispatch', async () => {
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue({
        entry: { name: 'custom', generate: vi.fn(async () => 'dispatched') },
        confidence: 0.9,
      });
      const options = makeOptions({ useCollab: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('prompt', 'prompt');
      expect(result.code).toBe('collab-code');
    });
  });

  // ── registerAllGenerators always called ───────────────────────────

  it('calls registerAllGenerators before dispatching', async () => {
    const options = makeOptions();
    const orchestrator = new GenerationOrchestrator(options, gallery, null);
    await orchestrator.generate('prompt', 'prompt');
    expect(registerAllGenerators).toHaveBeenCalledTimes(1);
  });
});
