/**
 * B8 (daemon path) — the autonomous self-improve cycle must invoke `sinter` with
 * `--aesthetic` so the AestheticCritic "soul" critic actually runs in the loop.
 *
 * The cycle is a .mjs driver that shells out to `node bin/sinter ...` via execSync.
 * Before the fix the invocation passed `--learn --intuition` but NO `--aesthetic`,
 * so useAestheticGuardrails defaulted false and the critic contributed ZERO to
 * autonomous fitness. We assert the generated CLI invocation enables it.
 *
 * This asserts on the actual command the cycle runs (the wiring contract), not on
 * an internal function call.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CYCLE_PATH = join(here, '..', '..', '..', 'scripts', 'quality', 'self-improve-cycle.mjs');
const source = readFileSync(CYCLE_PATH, 'utf-8');

describe('self-improve-cycle aesthetic wiring (B8)', () => {
  it('the sinter invocation includes --aesthetic so the critic runs in the autonomous loop', () => {
    // The exec command template that drives each generation.
    const execLine = source
      .split('\n')
      .find((l) => l.includes('bin/sinter') && l.includes('--learn'));
    expect(execLine).toBeTypeOf('string');
    expect(execLine).toContain('--aesthetic');
  });

  it('uses the permissive "free" preset (enables critic without over-constraining domains)', () => {
    const execLine = source
      .split('\n')
      .find((l) => l.includes('bin/sinter') && l.includes('--aesthetic'));
    expect(execLine).toContain('--aesthetic free');
  });

  it('keeps the existing --learn and --intuition flags intact', () => {
    const execLine = source
      .split('\n')
      .find((l) => l.includes('bin/sinter') && l.includes('--aesthetic'));
    expect(execLine).toContain('--learn');
    expect(execLine).toContain('--intuition');
  });
});
