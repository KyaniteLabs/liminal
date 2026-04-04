/**
 * CollaborationEngine unit tests — swarm-only unified interface.
 */
import { describe, it, expect } from 'vitest';
import { CollaborationEngine } from '../../../src/collab/CollaborationEngine.js';
import type { CollaborationEngineConfig } from '../../../src/collab/CollaborationEngine.js';

/** Fake LLM that echoes the prompt. */
const fakeLLM = async (prompt: string) => `OUTPUT: ${prompt.slice(0, 50)}`;

function makeConfig(overrides?: Partial<CollaborationEngineConfig>): CollaborationEngineConfig {
  return {
    callLLM: fakeLLM,
    domain: 'p5',
    maxRounds: 1,
    convergenceThreshold: 0.99, // Never converge so we test one round
    ...overrides,
  };
}

describe('CollaborationEngine', () => {
  it('swarm strategy returns a valid result', async () => {
    const engine = new CollaborationEngine(makeConfig());
    const result = await engine.run('draw circles');

    expect(result.output).toBeTruthy();
    expect(result.mode).toBe('swarm');
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(1);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty('raw');
  });

  it('progress callback receives mode info', async () => {
    const updates: Array<{ mode: string }> = [];

    const engine = new CollaborationEngine({
      ...makeConfig(),
      onProgress: (update) => updates.push({ mode: update.mode }),
    });

    await engine.run('test prompt');
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every(u => u.mode === 'swarm')).toBe(true);
  });

  it('result has expected shape', async () => {
    const engine = new CollaborationEngine(makeConfig());
    const result = await engine.run('test');

    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('qualityScore');
    expect(result).toHaveProperty('mode', 'swarm');
    expect(result).toHaveProperty('durationSeconds');
    expect(result).toHaveProperty('converged');
    expect(result).toHaveProperty('raw');
  });
});
