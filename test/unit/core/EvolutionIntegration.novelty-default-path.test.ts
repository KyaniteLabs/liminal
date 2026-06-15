/**
 * B7 regression — production novelty score must be a REAL signal on the default
 * (non-MAP-Elites) path, not structurally always 0.
 *
 * Before the fix, EvolutionIntegration.update early-returned { noveltyScore: 0 }
 * whenever useMapElites was false (and the CLI never sets it), and the novelty
 * archive was only constructed under useMapElites — so the production novelty
 * score was pinned at 0 and the stagnation novelty-reset branch was dead.
 *
 * These tests run with a REAL NoveltyArchive and REAL extractBehavior (no mocks)
 * to prove the archive is live: a distinct artifact yields a non-zero novelty
 * score, and a repeated near-identical artifact scores LOWER (because the archive
 * now accumulates and the second one lands near its own neighbor).
 */

import { describe, it, expect } from 'vitest';
import { EvolutionIntegration } from '../../../src/core/EvolutionIntegration.js';
import { NoveltyArchive } from '../../../src/evolution/NoveltyArchive.js';
import { normalizeOptions } from '../../../src/core/LoopConfig.js';

// Two structurally DIFFERENT p5 artifacts so extractBehavior produces distinct
// behavior vectors (interactivity + classes + arrays differ).
const ARTIFACT_A = `function setup() { createCanvas(400, 400); }
function draw() { background(0); fill(255); ellipse(mouseX, mouseY, 40, 40); }`;

const ARTIFACT_B = `function setup() { createCanvas(400, 400); }
function draw() { background(0); for (let i = 0; i < 10; i++) { rect(i*10, i*10, 5, 5); } }`;

describe('EvolutionIntegration novelty on the default (non-mapelites) path', () => {
  // Deterministic K-NN novelty values for these two fixed artifacts (Euclidean
  // distance / sqrt(dim), single-neighbor archive). Verified by running the real
  // NoveltyArchive against the real extractBehavior output.
  const NOVELTY_B_VS_A = 0.12509996003196805; // distinct artifact, populated archive
  const NOVELTY_A_REPEAT = 0.06254998001598402; // A re-scored after A+B in archive

  it('returns a non-zero novelty score for a second distinct artifact', () => {
    // normalizeOptions now always constructs _noveltyArchive, even with mapElites off.
    const options = normalizeOptions({ useMapElites: false, collabDomain: undefined });
    expect(options.useMapElites).toBe(false);
    expect(options._noveltyArchive).toBeInstanceOf(NoveltyArchive);

    const ei = new EvolutionIntegration(options, null);

    // First artifact: archive empty → noveltyScore is the empty-archive baseline (1.0),
    // and the behavior is added to the archive.
    const first = ei.update(1, ARTIFACT_A, 0.8, 'prompt');
    expect(first.noveltyScore).toBe(1);

    // Second DISTINCT artifact: scored against the now-populated archive. The
    // K-NN distance to the single different neighbor is a concrete non-zero value
    // (was structurally 0 before the fix because the method early-returned).
    const second = ei.update(2, ARTIFACT_B, 0.8, 'prompt');
    expect(second.noveltyScore).toBeCloseTo(NOVELTY_B_VS_A, 12);
  });

  it('scores a repeated near-identical artifact LOWER than a distinct one (archive is live)', () => {
    const options = normalizeOptions({ useMapElites: false });
    const ei = new EvolutionIntegration(options, null);

    // Seed the archive with A.
    ei.update(1, ARTIFACT_A, 0.8, 'prompt');

    // A distinct artifact scores a concrete positive distance.
    const distinct = ei.update(2, ARTIFACT_B, 0.8, 'prompt');
    expect(distinct.noveltyScore).toBeCloseTo(NOVELTY_B_VS_A, 12);

    // Now re-run A: its behavior vector equals an item already in the archive
    // (distance 0 to that neighbor), so the K-NN average is halved → strictly
    // lower novelty than the distinct one, proving the archive accumulated.
    const repeated = ei.update(3, ARTIFACT_A, 0.8, 'prompt');
    expect(repeated.noveltyScore).toBeCloseTo(NOVELTY_A_REPEAT, 12);
    expect(repeated.noveltyScore).toBeLessThan(distinct.noveltyScore);
  });

  it('accumulates behaviors across iterations (archive size grows)', () => {
    const options = normalizeOptions({ useMapElites: false });
    const archive = options._noveltyArchive as NoveltyArchive;
    const ei = new EvolutionIntegration(options, null);

    expect(archive.size()).toBe(0);
    ei.update(1, ARTIFACT_A, 0.8, 'prompt');
    ei.update(2, ARTIFACT_B, 0.8, 'prompt');
    expect(archive.size()).toBe(2);
  });
});
