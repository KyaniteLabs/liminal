import { describe, expect, it } from 'vitest';
import {
  emptyMovementFrame,
  extractMovementFeatures,
  isMovementWorkerStalled,
  markMovementStale,
  reduceMovementFrame,
} from '../../../packages/sing/src/movement/MovementFeatures.js';
import { processPoseWorkerFrame } from '../../../packages/sing/src/movement/PoseWorkerCore.js';
import { mapSingPresetUniforms, type SingUniformFrame } from '../../../packages/sing/src/render/pipeline.js';
import { createSingPreset } from '../../../packages/audio-core/src/PresetSchema.js';

describe('Sing movement features', () => {
  it('extracts movement energy and center from frame differences', () => {
    const previous = rgba(4, 4, []);
    const current = rgba(4, 4, [
      [2, 1, 255],
      [3, 1, 255],
      [2, 2, 255],
      [3, 2, 255],
    ]);

    const frame = extractMovementFeatures({
      width: 4,
      height: 4,
      data: current,
      previousData: previous,
      capturedAt: 100,
    });

    expect(frame.movementEnergy).toBeGreaterThan(0);
    expect(frame.movementX).toBeGreaterThan(0.6);
    expect(frame.movementY).toBeGreaterThan(0.3);
    expect(frame.distanceToCamera).toBeGreaterThan(0.4);
    expect(frame.confidence).toBeGreaterThan(0);
  });

  it('keeps first worker frame empty and uses it as the next baseline', () => {
    const first = processPoseWorkerFrame({
      imageData: { width: 2, height: 2, data: rgba(2, 2, [[0, 0, 255]]) },
      capturedAt: 10,
    }, null);
    const second = processPoseWorkerFrame({
      imageData: { width: 2, height: 2, data: rgba(2, 2, [[1, 1, 255]]) },
      capturedAt: 20,
    }, first.nextPreviousData);

    expect(first.frame).toMatchObject(emptyMovementFrame(10));
    expect(second.frame.movementEnergy).toBeGreaterThan(0);
  });

  it('smooths movement frames and marks stalled worker output stale', () => {
    const first = reduceMovementFrame(null, {
      movementEnergy: 1,
      movementX: 1,
      movementY: 0,
      distanceToCamera: 0.8,
      confidence: 1,
      capturedAt: 100,
    });
    const second = reduceMovementFrame(first, {
      movementEnergy: 0,
      movementX: 0,
      movementY: 1,
      distanceToCamera: 0,
      confidence: 0,
      capturedAt: 120,
    });

    expect(second.frame.movementEnergy).toBeGreaterThan(0);
    expect(second.frame.movementX).toBeGreaterThan(0);
    expect(isMovementWorkerStalled(second.frame, 900, 750)).toBe(true);
    expect(markMovementStale(second, 900, 750)?.stale).toBe(true);
  });

  it('maps movement features to default shader uniforms', () => {
    const preset = createSingPreset({
      id: 'movement',
      name: 'Movement',
      shader: 'void main() { gl_FragColor = vec4(1.0); }',
      mappings: [
        { feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 },
      ],
    });
    const frame: SingUniformFrame = {
      rms: 0.2,
      pitchHz: 220,
      centroid: 0.5,
      spectralFlux: 0.2,
      onset: 0,
      voiced: 1,
      confidence: 0.8,
      elapsedSeconds: 1,
      movementEnergy: 0.7,
      movementX: 0.25,
      movementY: 0.75,
      distanceToCamera: 0.4,
    };

    const uniforms = mapSingPresetUniforms(preset, frame);

    expect(uniforms.get('u_movement')).toBe(0.7);
    expect(uniforms.get('u_movement_x')).toBe(0.25);
    expect(uniforms.get('u_movement_y')).toBe(0.75);
    expect(uniforms.get('u_distance')).toBe(0.4);
  });
});

function rgba(width: number, height: number, lit: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, value] of lit) {
    const offset = (y * width + x) * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return data;
}
