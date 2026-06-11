import { describe, expect, it } from 'vitest';
import { analyzeDecodedPixels } from '../../../src/render/DecodedImageVisibility.js';

describe('DecodedImageVisibility', () => {
  it('returns luminance fractions alongside visibility stats', () => {
    const analysis = analyzeDecodedPixels({
      width: 2,
      height: 2,
      data: new Uint8Array([
        255, 255, 255, 255,
        0, 0, 0, 255,
        128, 128, 128, 255,
        255, 0, 0, 255,
      ]),
    });

    expect(analysis.sampledPixels).toBe(4);
    expect(analysis.opaquePixels).toBe(4);
    expect(analysis.meanLuminance).toBeCloseTo((1 + 0 + (128 / 255) + 0.299) / 4, 5);
    expect(analysis.brightFraction).toBe(0.5);
    expect(analysis.darkFraction).toBe(0.25);
    expect(analysis.hasVisibleContent).toBe(true);
  });
});
