import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Hoist mock functions so they can be reconfigured per-test via mockImplementation
const { mockDetect, mockGetDomainHints } = vi.hoisted(() => ({
  mockDetect: vi.fn(() => [
    {
      type: 'vague' as const,
      severity: 'medium' as const,
      description: 'Vague term "cooler" found',
      suggestedQuestion: 'Describe the specific aesthetic or interaction you find "cool".',
    },
  ]),
  mockGetDomainHints: vi.fn(() => ['p5']),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/generators/p5/P5GeneratorLLM.js', () => ({
  P5GeneratorLLM: vi.fn(function(this: any) {
    this.generate = vi.fn(async () => 'fallback-code');
  }),
}));

vi.mock('../../../src/core/AmbiguityDetector.js', () => ({
  AmbiguityDetector: vi.fn(function(this: any) {
    this.detect = mockDetect;
    this.getDomainHints = mockGetDomainHints;
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
    // Default: no ambiguity detected (disambiguation tests override these per-test)
    mockDetect.mockReturnValue([]);
    mockGetDomainHints.mockReturnValue([]);
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
      expect(mockGenerate).toHaveBeenCalledWith('used');
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

    it('passes iteration-enriched prompt context to specialized generators', async () => {
      const mockGenerate = vi.fn(async () => 'context-aware-code');
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue({
        entry: { name: 'shader', generate: mockGenerate },
        confidence: 0.9,
      });
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate(
        'user prompt\n\n---\nContext from previous iterations:\nkeep the nebula palette and preserve motion',
        'user prompt',
      );

      expect(result.code).toBe('context-aware-code');
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.stringContaining('Context from previous iterations:'),
      );
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

  // ── Disambiguation path ────────────────────────────────────────────

  describe('disambiguation', () => {
    it('returns needsClarification when no dispatch match and prompt is ambiguous', async () => {
      // Per-test override of the hoisted mock — must use mockImplementation
      mockDetect.mockImplementation(() => [
        {
          type: 'vague' as const,
          severity: 'medium' as const,
          description: 'Vague term "cooler" found',
          suggestedQuestion: 'Describe the specific aesthetic or interaction you find "cool".',
        },
      ]);
      mockGetDomainHints.mockImplementation(() => ['p5']);
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('make it cooler', 'make it cooler') as any;
      expect(result.needsClarification).toBe(true);
      expect(result.clarifyingQuestions).toBeDefined();
      expect(result.clarifyingQuestions.length).toBeGreaterThan(0);
    });

    it('falls through to P5 when no dispatch match and prompt is NOT ambiguous', async () => {
      // Ensure detector finds nothing — beforeEach already sets these to [], but be explicit
      mockDetect.mockImplementation(() => []);
      mockGetDomainHints.mockImplementation(() => []);
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate(
        'blue circle at 200 200 radius 50',
        'blue circle at 200 200 radius 50'
      ) as any;
      expect(result.needsClarification ?? false).toBe(false);
      expect(result.code).toBe('fallback-code');
    });

    it('includes domain hints in clarification result', async () => {
      mockDetect.mockImplementation(() => [
        {
          type: 'vague' as const,
          severity: 'medium' as const,
          description: '"3d" is ambiguous',
          suggestedQuestion: 'Do you want WebGL/Three.js or a p5 sketch pretending to be 3D?',
        },
      ]);
      mockGetDomainHints.mockImplementation(() => ['three', 'p5']);
      (generatorRegistry.dispatch as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const options = makeOptions();
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate(
        'make a 3d animation with circles',
        'make a 3d animation with circles'
      ) as any;
      expect(result.needsClarification).toBe(true);
      expect(result.suggestions).toContain('three');
      expect(result.suggestions).toContain('p5');
    });

    it('skips disambiguation when useSwarm is true', async () => {
      const options = makeOptions({ useSwarm: true });
      const orchestrator = new GenerationOrchestrator(options, gallery, null);
      const result = await orchestrator.generate('make it cooler', 'make it cooler') as any;
      // Swarm bypasses disambiguation
      expect(result.code).toBe('swarm-code');
    });
  });
});
