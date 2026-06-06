import { describe, expect, it } from 'vitest';
import {
  sampleRingByteLength,
  createSampleRingViews,
  writeSamplesToRing,
  readWindowFromRing,
} from '@liminal/audio-core/dsp/SampleRingShared.js';

function freshRing(capacity: number) {
  const buf = new ArrayBuffer(sampleRingByteLength(capacity));
  return createSampleRingViews(buf, capacity);
}

describe('SampleRingShared', () => {
  it('reads back the full window in chronological order', () => {
    const { control, ring } = freshRing(8);
    writeSamplesToRing(control, ring, new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]));
    const out = new Float32Array(8);
    readWindowFromRing(control, ring, 8, out);
    expect(Array.from(out)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the most recent window after wrap', () => {
    const { control, ring } = freshRing(8);
    writeSamplesToRing(control, ring, new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]));
    writeSamplesToRing(control, ring, new Float32Array([8, 9]));
    const out = new Float32Array(8);
    readWindowFromRing(control, ring, 8, out);
    expect(Array.from(out)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('zero-pads the front until enough samples have been written', () => {
    const { control, ring } = freshRing(8);
    writeSamplesToRing(control, ring, new Float32Array([1, 1, 1, 1]));
    const out = new Float32Array(8);
    readWindowFromRing(control, ring, 8, out);
    expect(Array.from(out)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('reads a window smaller than the ring (most recent N)', () => {
    const { control, ring } = freshRing(8);
    writeSamplesToRing(control, ring, new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]));
    const out = new Float32Array(4);
    readWindowFromRing(control, ring, 4, out);
    expect(Array.from(out)).toEqual([4, 5, 6, 7]);
  });

  it('sizes the buffer for the header plus capacity floats', () => {
    expect(sampleRingByteLength(4096)).toBe(8 + 4 * 4096);
  });
});
