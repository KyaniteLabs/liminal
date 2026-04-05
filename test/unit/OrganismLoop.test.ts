import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────
const { mockGenerate, mockGetHistory, mockSave, mockSaveOrganism, mockEmit, mockGetRandomSeed } = vi.hoisted(() => ({
  mockGenerate: vi.fn(async () => ({ musicCode: '$0 s0 ~ :seq(1,2)', visualCode: 'osc(10).rotate(0.5)' })),
  mockGetHistory: vi.fn(() => []),
  mockSave: vi.fn(),
  mockSaveOrganism: vi.fn(),
  mockEmit: vi.fn(),
  mockGetRandomSeed: vi.fn(async () => null),
}));

const mockOnProgress = vi.fn();

vi.mock('../../src/core/ContextAccumulation.js', () => ({
  ContextAccumulation: { getHistory: mockGetHistory, save: mockSave },
}));
vi.mock('../../src/gallery/Gallery.js', () => ({
  Gallery: class { saveOrganism = mockSaveOrganism; },
}));
vi.mock('../../src/musicToVisual/generateMusicToVisual.js', () => ({
  generateMusicToVisual: mockGenerate,
}));
vi.mock('../../src/compost/SeedBank.js', () => ({
  SeedBank: class { getRandomSeed = mockGetRandomSeed; },
}));
vi.mock('../../src/compost/defaults.js', () => ({
  mergeConfig: vi.fn(() => ({})),
}));
vi.mock('../../src/core/EventBus.js', () => ({
  eventBus: { emit: mockEmit },
  EventTypes: { PROCESS_START: 'process_start', PROCESS_END: 'process_end' },
}));
vi.mock('../../src/core/lir/LIRPromptFormatter.js', () => ({
  formatSeedForPrompt: vi.fn(() => 'formatted seed'),
}));
vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn() },
}));

import { runOrganismMode } from '../../src/core/OrganismLoop.js';


describe('OrganismLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHistory.mockReturnValue([]);
    mockGetRandomSeed.mockResolvedValue(null);
    mockGenerate.mockResolvedValue({
      musicCode: '$0 s0 ~ :seq(1,2)',
      visualCode: 'osc(10).rotate(0.5)',
    });
  });

  // ── Single iteration ──────────────────────────────────────────────
  it('runs a single iteration and returns completed result', async () => {
    const result = await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.code).toContain('osc');
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeTruthy();
  });

  // ── Multiple iterations ───────────────────────────────────────────
  it('runs multiple iterations and returns final code', async () => {
    mockGenerate
      .mockResolvedValueOnce({ musicCode: '$0 s0', visualCode: 'osc(10).out()' })
      .mockResolvedValueOnce({ musicCode: '$0 s1', visualCode: 'shape(4).out()' });
    const result = await runOrganismMode('test prompt', {
      maxIterations: 2,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(2);
    expect(result.code).toContain('shape');
  });

  // ── Abort handling ────────────────────────────────────────────────
  it('returns incomplete when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runOrganismMode('test prompt', {
      maxIterations: 5,
      galleryDir: '/tmp/test-gallery',
      signal: controller.signal,
    } as any, Date.now());
    expect(result.completed).toBe(false);
    expect(result.reason).toBe('aborted by user');
  });

  // ── Context accumulation ──────────────────────────────────────────
  it('feeds previous iteration scores into enhanced prompt', async () => {
    mockGetHistory.mockReturnValue([{
      code: 'previous code',
      evaluation: { score: 0.75, issues: ['too simple'] },
    }]);
    await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    const callArg = mockGenerate.mock.calls[0][0];
    expect(callArg).toContain('0.75');
    expect(callArg).toContain('too simple');
  });

  it('saves context after each iteration', async () => {
    await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        iteration: 1,
        evaluation: expect.objectContaining({ score: expect.any(Number) }),
      }),
    );
  });

  // ── Stagnation detection ──────────────────────────────────────────
  it('breaks early when quality stagnates beyond threshold', async () => {
    // Return identical low-quality code each time → score won't improve
    mockGenerate.mockResolvedValue({ musicCode: 'x', visualCode: 'y' });
    const result = await runOrganismMode('test prompt', {
      maxIterations: 10,
      galleryDir: '/tmp/test-gallery',
      stagnationThreshold: 3,
    } as any, Date.now());
    expect(result.iterations).toBeLessThan(10);
    expect(result.completed).toBe(true);
  });

  // ── Compost seed injection ────────────────────────────────────────
  it('injects compost seed into prompt when available', async () => {
    mockGetRandomSeed.mockResolvedValue({ content: 'creative seed content' });
    await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    const callArg = mockGenerate.mock.calls[0][0];
    expect(callArg).toContain('formatted seed');
  });

  it('continues without compost seed when none available', async () => {
    mockGetRandomSeed.mockResolvedValue(null);
    const result = await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    expect(result.completed).toBe(true);
  });

  // ── Gallery save ──────────────────────────────────────────────────
  it('saves organism to gallery when project is specified', async () => {
    await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
      project: 'test-project',
    } as any, Date.now());
    expect(mockSaveOrganism).toHaveBeenCalledWith(
      'test-project', 1,
      expect.any(String), expect.any(String),
    );
  });

  it('does not save to gallery when no project specified', async () => {
    await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    expect(mockSaveOrganism).not.toHaveBeenCalled();
  });

  // ── Progress callback ─────────────────────────────────────────────
  it('calls onProgress callback per iteration', async () => {
    mockGenerate
      .mockResolvedValueOnce({ musicCode: '$0 s0', visualCode: 'osc(10).out()' })
      .mockResolvedValueOnce({ musicCode: '$0 s1', visualCode: 'shape(4).out()' });
    await runOrganismMode('test prompt', {
      maxIterations: 2,
      galleryDir: '/tmp/test-gallery',
      onProgress: mockOnProgress,
    } as any, Date.now());
    expect(mockOnProgress).toHaveBeenCalledTimes(2);
    expect(mockOnProgress).toHaveBeenCalledWith(
      expect.objectContaining({ iteration: 1, score: expect.any(Number) }),
    );
    expect(mockOnProgress).toHaveBeenCalledWith(
      expect.objectContaining({ iteration: 2 }),
    );
  });

  // ── EventBus events ───────────────────────────────────────────────
  it('emits PROCESS_START and PROCESS_END events', async () => {
    await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any, Date.now());
    expect(mockEmit).toHaveBeenCalledWith('process_start', expect.any(String), expect.any(Object));
    expect(mockEmit).toHaveBeenCalledWith('process_end', expect.any(String), expect.any(Object));
  });
});
