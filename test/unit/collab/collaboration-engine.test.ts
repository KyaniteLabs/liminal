/**
 * CollaborationEngine unit tests — strategy dispatch and unified interface.
 */
import { describe, it, expect } from 'vitest';
import { CollaborationEngine } from '../../../src/collab/CollaborationEngine.js';
import type { CollaborationEngineConfig, CollaborationMode } from '../../../src/collab/CollaborationEngine.js';

/** Fake LLM that echoes the prompt. */
const fakeLLM = async (prompt: string) => `OUTPUT: ${prompt.slice(0, 50)}`;

function makeConfig(mode: CollaborationMode): CollaborationEngineConfig {
  return {
    mode,
    callLLM: fakeLLM,
    domain: 'p5',
    maxRounds: 1,
    convergenceThreshold: 0.99, // Never converge so we test one round
  };
}

describe('CollaborationEngine', () => {
  it('simple strategy returns a valid result', async () => {
    const engine = new CollaborationEngine(makeConfig('simple'));
    const result = await engine.run('draw circles');

    expect(result.output).toBeTruthy();
    expect(result.mode).toBe('simple');
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.qualityScore).toBeLessThanOrEqual(1);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty('raw');
  });

  it('phases strategy returns a valid result', async () => {
    const engine = new CollaborationEngine(makeConfig('phases'));
    const result = await engine.run('generative art');

    expect(result.output).toBeTruthy();
    expect(result.mode).toBe('phases');
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(result).toHaveProperty('raw');
  });

  it('throws on unknown mode', async () => {
    const engine = new CollaborationEngine({
      mode: 'nonexistent' as CollaborationMode,
      callLLM: fakeLLM,
    });

    await expect(engine.run('test')).rejects.toThrow('Unknown collaboration mode');
  });

  it('progress callback receives mode info', async () => {
    const updates: Array<{ mode: string }> = [];

    const engine = new CollaborationEngine({
      ...makeConfig('simple'),
      onProgress: (update) => updates.push({ mode: update.mode }),
    });

    await engine.run('test prompt');
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every(u => u.mode === 'simple')).toBe(true);
  });

  it('each strategy result has expected shape', async () => {
    const modes: CollaborationMode[] = ['simple', 'phases'];

    for (const mode of modes) {
      const engine = new CollaborationEngine(makeConfig(mode));
      const result = await engine.run('test');

      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('mode', mode);
      expect(result).toHaveProperty('durationSeconds');
      expect(result).toHaveProperty('converged');
      expect(result).toHaveProperty('raw');
    }
  });
});
