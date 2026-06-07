import { describe, expect, it } from 'vitest';
import { AnalysisRingBuffer } from '@sinter/audio-core/dsp/RingBuffer.js';

const SIZE = 2048;
const HOP = 256;

describe('AnalysisRingBuffer', () => {
  it('returns null until hop samples have accumulated, then a SIZE-length frame', () => {
    const rb = new AnalysisRingBuffer(SIZE);
    rb.push(new Float32Array(128).fill(1));
    expect(rb.takeFrameIfReady(HOP)).toBeNull();
    rb.push(new Float32Array(128).fill(2));
    const frame = rb.takeFrameIfReady(HOP);
    expect(frame).not.toBeNull();
    expect((frame as Float32Array).length).toBe(SIZE);
  });

  it('zero-pads the front until full and places newest samples at the end', () => {
    const rb = new AnalysisRingBuffer(SIZE);
    rb.push(new Float32Array(128).fill(1));
    rb.push(new Float32Array(128).fill(2));
    const f = rb.takeFrameIfReady(HOP) as Float32Array;
    expect(f[0]).toBe(0); // only 256 of 2048 written → front is zero
    expect(f[SIZE - 256]).toBe(1); // oldest of the written samples
    expect(f[SIZE - 1]).toBe(2); // newest
  });

  it('preserves chronological order (oldest → newest), including across wrap', () => {
    const rb = new AnalysisRingBuffer(8);
    for (let i = 0; i < 4; i++) rb.push(new Float32Array([i * 2, i * 2 + 1])); // 0..7
    expect(Array.from(rb.takeFrameIfReady(2) as Float32Array)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    rb.push(new Float32Array([8, 9])); // wraps; window is now 2..9
    expect(Array.from(rb.takeFrameIfReady(2) as Float32Array)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('returns null again immediately after taking (counter consumes hop)', () => {
    const rb = new AnalysisRingBuffer(SIZE);
    rb.push(new Float32Array(256).fill(1));
    expect(rb.takeFrameIfReady(HOP)).not.toBeNull();
    expect(rb.takeFrameIfReady(HOP)).toBeNull();
  });
});
