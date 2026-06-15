/**
 * B8 + B11 wiring — the CLI run() path (the autonomous/daemon path) must forward
 * the AestheticCritic guardrails AND construct a GuidanceEngine into RalphLoop.run.
 *
 * B8: run() previously dropped useAestheticGuardrails / aestheticConfig, so even
 *     when bin/sinter set --aesthetic the "soul" critic never ran in the loop and
 *     contributed ZERO to autonomous fitness.
 * B11: run() never set guidanceEngine, so the MetaHarness→HarnessMemory→
 *     GuidanceEngine feed-forward only reached the chat loop — the MAIN learning
 *     loop got none of it.
 *
 * We mock RalphLoop.run to capture the options object it is called with, and
 * assert the wiring survives end-to-end into the loop's options. This asserts
 * REAL behavior (the option reaches the consumer), not that a function was called.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockRun } = vi.hoisted(() => ({ mockRun: vi.fn() }));

vi.mock('../../../src/core/RalphLoop.js', () => ({
  RalphLoop: { run: mockRun },
}));

import { run } from '../../../src/index.js';
import { GuidanceEngine } from '../../../src/chat/GuidanceEngine.js';

// A valid p5 artifact so the post-loop validation gate passes and run() resolves.
const VALID_CODE = 'function setup() { createCanvas(400, 400); }\nfunction draw() { background(0); ellipse(200, 200, 50, 50); }';

describe('run() forwards aesthetic + guidance wiring into RalphLoop.run (B8, B11)', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sinter-wiring-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    mockRun.mockReset();
    mockRun.mockResolvedValue({
      code: VALID_CODE,
      iterations: 1,
      completed: true,
      reason: 'Quality threshold met',
      timestamp: '2026-06-14T00:00:00Z',
      duration: 1000,
      finalScore: 0.9,
    });
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function callRun(opts: Record<string, unknown>) {
    // Output/gallery live under ~/.sinter (HOME is the temp dir) so resolveOutputPath
    // accepts them — they are outside cwd by design.
    // run() continues past RalphLoop.run to export artifacts; that work is not under
    // test here, so capture (don't silently swallow) any post-loop error so a
    // pre-loop failure surfaces instead of masquerading as "mock not called".
    let postLoopError: unknown;
    try {
      await run('a never-before-seen calm tide pool at dawn', {
        output: join(tempDir, '.sinter', 'out'),
        galleryDir: join(tempDir, '.sinter', 'gallery'),
        project: 'wiring-test',
        ...opts,
      });
    } catch (e) {
      postLoopError = e;
    }
    if (mockRun.mock.calls.length === 0 && postLoopError) {
      // Re-throw a pre-loop failure so the test reports the real cause.
      throw postLoopError;
    }
    expect(mockRun).toHaveBeenCalledTimes(1);
    return mockRun.mock.calls[0][1] as Record<string, unknown>;
  }

  it('B8: forwards useAestheticGuardrails=true and the aestheticConfig preset', async () => {
    const options = await callRun({
      useAestheticGuardrails: true,
      aestheticConfig: { preset: 'free' },
    });
    expect(options.useAestheticGuardrails).toBe(true);
    expect(options.aestheticConfig).toEqual({ preset: 'free' });
  });

  it('B8: does not enable the guardrail when the caller does not ask for it', async () => {
    const options = await callRun({});
    // undefined (not true) → AestheticCritic stays off unless explicitly requested.
    expect(options.useAestheticGuardrails).toBeUndefined();
  });

  it('B11: constructs and wires a live GuidanceEngine into the loop on the non-chat path', async () => {
    const options = await callRun({});
    expect(options.guidanceEngine).toBeInstanceOf(GuidanceEngine);
    // chatMode is NOT set on this path, proving guidance is wired for the
    // autonomous loop, not gated behind chat.
    expect(options.chatMode).toBeUndefined();
  });
});
