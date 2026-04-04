import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/core/ContextAccumulation.js', () => ({
  ContextAccumulation: { getHistory: vi.fn(() => []), save: vi.fn() },
}));
vi.mock('../../src/gallery/Gallery.js', () => ({
  Gallery: class { saveOrganism = vi.fn(); },
}));
vi.mock('../../src/musicToVisual/generateMusicToVisual.js', () => ({
  generateMusicToVisual: vi.fn(async () => ({ musicCode: '$0 s0 ~ :seq(1,2)', visualCode: 'osc(10).rotate(0.5)' })),
}));
vi.mock('../../src/compost/SeedBank.js', () => ({
  SeedBank: class { getRandomSeed = vi.fn(async () => null); },
}));
vi.mock('../../src/compost/defaults.js', () => ({
  mergeConfig: vi.fn(() => ({})),
}));
vi.mock('../../src/core/EventBus.js', () => ({
  eventBus: { emit: vi.fn() },
  EventTypes: { PROCESS_START: 'process_start', PROCESS_END: 'process_end' },
}));
vi.mock('../../src/core/lir/LIRPromptFormatter.js', () => ({
  formatSeedForPrompt: vi.fn(() => ''),
}));
vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn() },
}));

import { runOrganismMode } from '../../src/core/OrganismLoop.js';

describe('OrganismLoop', () => {
  it('runs a single iteration and returns a result', async () => {
    const result = await runOrganismMode('test prompt', {
      maxIterations: 1,
      galleryDir: '/tmp/test-gallery',
    } as any);
    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.code).toContain('osc');
  });
});
