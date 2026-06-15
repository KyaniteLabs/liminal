import { describe, it, expect } from 'vitest';
import { validateSingPreset } from '@sinter/audio-core/PresetSchema.js';
import { mapVoiceToSemantic } from '@sinter/audio-core/SemanticMapper.js';
import { moonlitGardenPreset } from '../src/presets/moonlitGarden.js';
import {
  emptyMovementFrame,
  extractMovementFeatures,
  reduceMovementFrame,
  markMovementStale,
  type MovementImageSample,
  type MovementState,
} from '../src/movement/MovementFeatures.js';
import { createSingStabilizer, type SingUniformFrame } from '../src/render/pipeline.js';
import { SessionRecorder } from '../src/recording/SessionRecorder.js';
import type { VoiceFeatureFrame } from '@sinter/audio-core/VoiceFeatureStream.js';

function makeVoiceFrame(overrides: Partial<VoiceFeatureFrame> = {}): VoiceFeatureFrame {
  return {
    rms: 0.08,
    pitchHz: 440,
    centroid: 2000,
    spectralFlux: 0.3,
    onset: false,
    voiced: true,
    confidence: 0.9,
    pitchClass: 9, // A
    octave: 4,
    brightness: 0.5,
    breathiness: 0.2,
    formants: { f1: 700, f2: 1200, f3: 2500 },
    vowel: 'open-front',
    capturedAt: Date.now(),
    spectrum: new Float32Array(32),
    ...overrides,
  };
}

describe('sing pipeline wiring (F4)', () => {
  it('validates the moonlitGarden showpiece preset', () => {
    const result = validateSingPreset(moonlitGardenPreset());
    expect(result.ok).toBe(true);
  });

  it('maps a voice frame to a valid semantic visual state', () => {
    const frame = makeVoiceFrame();
    const state = mapVoiceToSemantic(frame);
    // All channels should be in 0..1 (hue is a normalized turn, wrapped)
    expect(state.palette.hue).toBeGreaterThanOrEqual(0);
    expect(state.palette.hue).toBeLessThanOrEqual(1);
    expect(state.density.coverage).toBeGreaterThanOrEqual(0);
    expect(state.density.coverage).toBeLessThanOrEqual(1);
    expect(state.motion.shimmer).toBeGreaterThanOrEqual(0);
    expect(state.composition.scale).toBeGreaterThanOrEqual(0);
  });

  it('maps an unvoiced frame to near-zero coverage', () => {
    const frame = makeVoiceFrame({ voiced: false, rms: 0.001 });
    const state = mapVoiceToSemantic(frame);
    expect(state.density.coverage).toBeLessThan(0.1);
  });

  it('extracts movement features from an image sample', () => {
    const w = 8, h = 8;
    const data = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7) % 256;
    const sample: MovementImageSample = {
      width: w,
      height: h,
      data,
      capturedAt: 1000,
    };
    const frame = extractMovementFeatures(sample);
    expect(frame.movementEnergy).toBeGreaterThanOrEqual(0);
    expect(frame.movementX).toBeGreaterThanOrEqual(0);
    expect(frame.movementX).toBeLessThanOrEqual(1);
    expect(frame.confidence).toBeGreaterThanOrEqual(0);
  });

  it('reduces movement frames into a stable state', () => {
    const f1 = emptyMovementFrame(1000);
    const state1 = reduceMovementFrame(null, f1);
    expect(state1.stale).toBe(false);

    const f2 = emptyMovementFrame(2000);
    const state2 = reduceMovementFrame(state1, f2);
    expect(state2.frame.capturedAt).toBe(2000);
  });

  it('marks stale movement after stall threshold', () => {
    const frame = emptyMovementFrame(1000);
    const state = reduceMovementFrame(null, frame);
    const stale = markMovementStale(state, 1000 + 1000, 750);
    expect(stale?.stale).toBe(true);
  });

  it('creates a sing stabilizer that processes uniform frames', () => {
    const stabilizer = createSingStabilizer();
    const frame: SingUniformFrame = {
      rms: 0.08,
      pitchHz: 440,
      centroid: 2000,
      spectralFlux: 0.3,
      onset: 0,
      voiced: 1,
      confidence: 0.9,
      elapsedSeconds: 1.0,
    };
    const stabilized = stabilizer.stabilize(frame);
    expect(stabilized.rms).toBeGreaterThanOrEqual(0);
    expect(stabilized.pitchHz).toBeGreaterThanOrEqual(0);
  });

  it('instantiates a SessionRecorder', () => {
    const recorder = new SessionRecorder();
    expect(recorder).toBeDefined();
  });
});
