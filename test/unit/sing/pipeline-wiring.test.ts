/**
 * Sing render-pipeline wiring test (Phase-5 carryover; audit F4).
 *
 * The performance instrument's binder must condition raw audio frames through
 * the One-Euro stabilizer (low lag on fast change, smooth at rest, pitch held
 * across unvoiced gaps, onsets decaying) and map them onto preset uniforms.
 * This pins that wiring without a browser or microphone.
 */

import { describe, it, expect } from 'vitest';
import {
  createSingStabilizer,
  mapSingPresetUniforms,
  type SingUniformFrame,
} from '../../../packages/sing/src/render/pipeline.js';

const frame = (overrides: Partial<SingUniformFrame> = {}): SingUniformFrame => ({
  rms: 0.02,
  pitchHz: 0,
  centroid: 0.4,
  spectralFlux: 0.004,
  onset: 0,
  voiced: 0,
  confidence: 0,
  elapsedSeconds: 0,
  ...overrides,
});

describe('sing pipeline wiring (audit F4)', () => {
  it('smooths an rms step through the One-Euro binder instead of passing it raw', () => {
    const stabilizer = createSingStabilizer();
    const quiet = stabilizer.stabilize(frame({ rms: 0.02, elapsedSeconds: 0.0 }));
    const loud = stabilizer.stabilize(frame({ rms: 0.2, elapsedSeconds: 0.016 }));
    // 0.2 raw normalizes to 1.0; a One-Euro output one 16ms step after a jump
    // must move toward the target but not teleport onto it.
    expect(loud.rms).toBeGreaterThan(quiet.rms);
    expect(loud.rms).toBeLessThan(1);
  });

  it('holds pitch across unvoiced gaps and releases it after reset', () => {
    const stabilizer = createSingStabilizer();
    const sung = stabilizer.stabilize(frame({ pitchHz: 220, voiced: 1, confidence: 0.9, elapsedSeconds: 0.0 }));
    expect(sung.pitchHz).toBeGreaterThan(0);

    const gap = stabilizer.stabilize(frame({ pitchHz: 0, voiced: 0, confidence: 0, elapsedSeconds: 0.016 }));
    expect(gap.pitchHz).toBeGreaterThan(150); // held near 220, not dropped to 0

    stabilizer.reset();
    const fresh = stabilizer.stabilize(frame({ pitchHz: 0, voiced: 0, confidence: 0, elapsedSeconds: 0.032 }));
    expect(fresh.pitchHz).toBe(0); // no stale pitch survives a session reset
  });

  it('decays onsets exponentially instead of holding them', () => {
    const stabilizer = createSingStabilizer();
    const hit = stabilizer.stabilize(frame({ onset: 1, elapsedSeconds: 0.0 }));
    expect(hit.onset).toBe(1);
    const after = stabilizer.stabilize(frame({ onset: 0, elapsedSeconds: 0.016 }));
    expect(after.onset).toBeCloseTo(0.82, 5);
    const later = stabilizer.stabilize(frame({ onset: 0, elapsedSeconds: 0.032 }));
    expect(later.onset).toBeCloseTo(0.82 * 0.82, 5);
  });

  it('maps a frame onto preset uniforms with the default semantic vocabulary', () => {
    const values = mapSingPresetUniforms(
      { mappings: [] },
      frame({ rms: 0.1, centroid: 0.7, voiced: 1, elapsedSeconds: 1 }),
    );
    expect(values.size).toBeGreaterThan(0);
    for (const [target, value] of values) {
      expect(typeof target).toBe('string');
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
