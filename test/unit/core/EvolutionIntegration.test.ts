import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvolutionIntegration } from '../../../src/core/EvolutionIntegration.js';

// Mock extractBehavior to return a known behavior vector
vi.mock('../../../src/evolution/BehaviorVectors.js', () => ({
  extractBehavior: vi.fn(() => [0.1, 0.2, 0.3]),
}));

// Mock ContextAccumulation.save so we don't need the real one
vi.mock('../../../src/core/ContextAccumulation.js', () => ({
  ContextAccumulation: { save: vi.fn() },
}));

import { extractBehavior } from '../../../src/evolution/BehaviorVectors.js';
import { ContextAccumulation } from '../../../src/core/ContextAccumulation.js';

function makeMapElites() {
  return {
    insert: vi.fn(),
    coverage: vi.fn(() => 0.5),
    getElites: vi.fn(() => []),
  };
}

function makeNoveltyArchive() {
  return {
    noveltyScore: vi.fn(() => 0.75),
  };
}

function makeAestheticModel() {
  return {
    predict: vi.fn(() => 0.6),
    update: vi.fn(),
  };
}

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    useMapElites: true,
    maxIterations: 10,
    _mapElites: makeMapElites(),
    _noveltyArchive: makeNoveltyArchive(),
    collabDomain: 'p5',
    ...overrides,
  } as any;
}

describe('EvolutionIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zeroed result when useMapElites is false', () => {
    const options = makeOptions({ useMapElites: false });
    const ei = new EvolutionIntegration(options, null);
    const result = ei.update(1, 'code', 0.8, 'prompt');
    expect(result).toEqual({ noveltyScore: 0, hints: '' });
  });

  it('calls extractBehavior and computes novelty from archive', () => {
    const archive = makeNoveltyArchive();
    const options = makeOptions({ _noveltyArchive: archive });
    const ei = new EvolutionIntegration(options, null);
    const result = ei.update(3, 'function setup() {}', 0.9, 'make circles');

    expect(extractBehavior).toHaveBeenCalledWith('function setup() {}');
    expect(archive.noveltyScore).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
    expect(result.noveltyScore).toBe(0.75);
  });

  it('inserts into mapElites and returns without hints when coverage is healthy', () => {
    const mapElites = makeMapElites();
    mapElites.coverage.mockReturnValue(0.6);
    const options = makeOptions({ _mapElites: mapElites, _noveltyArchive: undefined });
    const ei = new EvolutionIntegration(options, null);
    const result = ei.update(1, 'code', 0.8, 'prompt');

    expect(mapElites.insert).toHaveBeenCalledWith('iteration-1', [0.1, 0.2, 0.3], 0.8);
    expect(result.hints).toBe('');
  });

  it('saves context when coverage is low (<0.3) and iteration > 1 and elites exist', () => {
    const mapElites = makeMapElites();
    mapElites.coverage.mockReturnValue(0.15);
    mapElites.getElites.mockReturnValue([{ id: 'e1' }, { id: 'e2' }]);
    const options = makeOptions({ _mapElites: mapElites });
    const ei = new EvolutionIntegration(options, null);
    ei.update(3, 'code', 0.5, 'generate waves');

    expect(ContextAccumulation.save).toHaveBeenCalledTimes(1);
    const saved = (ContextAccumulation.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(saved.evaluation.mapElitesCoverage).toBe(0.15);
    expect(saved.evaluation.mapElitesDiversityHint).toContain('15%');
    expect(saved.iteration).toBe(3.1);
  });

  it('does NOT save context when coverage < 0.3 but iteration is 1', () => {
    const mapElites = makeMapElites();
    mapElites.coverage.mockReturnValue(0.1);
    mapElites.getElites.mockReturnValue([{ id: 'e1' }]);
    const options = makeOptions({ _mapElites: mapElites });
    const ei = new EvolutionIntegration(options, null);
    ei.update(1, 'code', 0.5, 'prompt');
    expect(ContextAccumulation.save).not.toHaveBeenCalled();
  });

  it('does NOT save context when coverage < 0.3 but no elites exist', () => {
    const mapElites = makeMapElites();
    mapElites.coverage.mockReturnValue(0.2);
    mapElites.getElites.mockReturnValue([]);
    const options = makeOptions({ _mapElites: mapElites });
    const ei = new EvolutionIntegration(options, null);
    ei.update(3, 'code', 0.5, 'prompt');
    expect(ContextAccumulation.save).not.toHaveBeenCalled();
  });

  it('does NOT save context when coverage is >= 0.3', () => {
    const mapElites = makeMapElites();
    mapElites.coverage.mockReturnValue(0.5);
    const options = makeOptions({ _mapElites: mapElites });
    const ei = new EvolutionIntegration(options, null);
    ei.update(3, 'code', 0.5, 'prompt');
    expect(ContextAccumulation.save).not.toHaveBeenCalled();
  });

  it('feeds behavior into aesthetic model and produces no hint at moderate quality', () => {
    const aestheticModel = makeAestheticModel();
    aestheticModel.predict.mockReturnValue(0.5);
    const options = makeOptions();
    const ei = new EvolutionIntegration(options, aestheticModel);
    const result = ei.update(2, 'code', 0.6, 'prompt');

    expect(aestheticModel.predict).toHaveBeenCalledWith([0.1, 0.2, 0.3], { domain: 'p5' });
    expect(aestheticModel.update).toHaveBeenCalledWith([{ behavior: [0.1, 0.2, 0.3], rating: 3, domain: 'p5' }]);
    expect(result.hints).toBe('');
  });

  it('produces low-quality hint when aesthetic prediction < 0.3 and iteration > 1', () => {
    const aestheticModel = makeAestheticModel();
    aestheticModel.predict.mockReturnValue(0.2);
    const options = makeOptions();
    const ei = new EvolutionIntegration(options, aestheticModel);
    const result = ei.update(3, 'code', 0.4, 'prompt');
    expect(result.hints).toContain('low-quality outputs');
    expect(result.hints).toContain('significantly different approach');
  });

  it('does NOT produce low-quality hint at iteration 1', () => {
    const aestheticModel = makeAestheticModel();
    aestheticModel.predict.mockReturnValue(0.1);
    const options = makeOptions();
    const ei = new EvolutionIntegration(options, aestheticModel);
    const result = ei.update(1, 'code', 0.4, 'prompt');
    expect(result.hints).toBe('');
  });

  it('produces high-quality hint when aesthetic prediction > 0.7', () => {
    const aestheticModel = makeAestheticModel();
    aestheticModel.predict.mockReturnValue(0.85);
    const options = makeOptions();
    const ei = new EvolutionIntegration(options, aestheticModel);
    const result = ei.update(2, 'code', 0.9, 'prompt');
    expect(result.hints).toContain('high-quality outputs');
    expect(result.hints).toContain('Lean into this direction');
  });

  it('uses collabDomain from options when present', () => {
    const aestheticModel = makeAestheticModel();
    aestheticModel.predict.mockReturnValue(0.8);
    const options = makeOptions({ collabDomain: 'glsl' });
    const ei = new EvolutionIntegration(options, aestheticModel);
    ei.update(2, 'code', 0.9, 'prompt');
    expect(aestheticModel.predict).toHaveBeenCalledWith([0.1, 0.2, 0.3], { domain: 'glsl' });
    expect(aestheticModel.update).toHaveBeenCalledWith([{ behavior: [0.1, 0.2, 0.3], rating: 4.5, domain: 'glsl' }]);
  });

  it('skips aesthetic model when null', () => {
    const options = makeOptions();
    const ei = new EvolutionIntegration(options, null);
    const result = ei.update(2, 'code', 0.8, 'prompt');
    expect(result.hints).toBe('');
  });

  it('skips novelty archive when undefined', () => {
    const options = makeOptions({ _noveltyArchive: undefined });
    const ei = new EvolutionIntegration(options, null);
    const result = ei.update(2, 'code', 0.8, 'prompt');
    expect(result.noveltyScore).toBe(0);
  });

  it('skips mapElites when undefined', () => {
    const archive = makeNoveltyArchive();
    const options = makeOptions({ _mapElites: undefined, _noveltyArchive: archive });
    const ei = new EvolutionIntegration(options, null);
    const result = ei.update(2, 'code', 0.8, 'prompt');
    expect(result.noveltyScore).toBe(0.75);
  });
});
