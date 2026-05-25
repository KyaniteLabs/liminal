import { describe, expect, it } from 'vitest';
import {
  analyzeMovementPixels,
  applyMovementCalibration,
  applyMovementSensitivity,
  decayStaleMovementFeatures,
  EMPTY_MOVEMENT_FEATURES,
} from '../../../packages/sing/src/movement/features.js';

describe('Sing camera movement reducer', () => {
  it('extracts coarse movement features from video pixels without a pose dependency', () => {
    const first = analyzeMovementPixels(blockFrame(12, 8, { leftY: 6, rightY: 6 }), 12, 8);
    const second = analyzeMovementPixels(blockFrame(12, 8, { leftY: 1, rightY: 2 }), 12, 8, first.luma);

    expect(second.features.leftHandHeight).toBeGreaterThan(first.features.leftHandHeight);
    expect(second.features.rightHandHeight).toBeGreaterThan(first.features.rightHandHeight);
    expect(second.features.movementEnergy).toBeGreaterThan(0);
    expect(second.features.stillness).toBeLessThan(1);
  });

  it('decays stale worker output instead of blocking rendering', () => {
    const stale = decayStaleMovementFeatures({
      ...EMPTY_MOVEMENT_FEATURES,
      movementEnergy: 0.8,
      stillness: 0.2,
      gestureOnset: true,
    }, 900);

    expect(stale.movementEnergy).toBeLessThan(0.8);
    expect(stale.stillness).toBeGreaterThan(0.2);
    expect(stale.gestureOnset).toBe(false);
  });

  it('calibrates neutral pose and applies sensitivity around center', () => {
    const calibrated = applyMovementCalibration({
      ...EMPTY_MOVEMENT_FEATURES,
      bodyCenterX: 0.7,
      bodyCenterY: 0.3,
      torsoAngle: 0.4,
    }, {
      ...EMPTY_MOVEMENT_FEATURES,
      bodyCenterX: 0.6,
      bodyCenterY: 0.4,
      torsoAngle: 0.1,
    });
    const sensitive = applyMovementSensitivity(calibrated, 2);

    expect(calibrated.bodyCenterX).toBeCloseTo(0.6);
    expect(calibrated.bodyCenterY).toBeCloseTo(0.4);
    expect(calibrated.torsoAngle).toBeCloseTo(0.3);
    expect(sensitive.bodyCenterX).toBeCloseTo(0.7);
  });
});

function blockFrame(width: number, height: number, points: { leftY: number; rightY: number }): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  fillBlock(pixels, width, 2, points.leftY);
  fillBlock(pixels, width, width - 4, points.rightY);
  return pixels;
}

function fillBlock(pixels: Uint8ClampedArray, width: number, xStart: number, yStart: number): void {
  for (let y = yStart; y < yStart + 2; y += 1) {
    for (let x = xStart; x < xStart + 2; x += 1) {
      const index = ((y * width) + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = 255;
    }
  }
}
