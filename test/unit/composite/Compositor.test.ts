import { describe, expect, it } from 'vitest';
import { Compositor, type CompositionSpec } from '../../../src/composite/Compositor.js';

const validSpec: CompositionSpec = {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 10,
  layers: [{ type: 'video', source: '/visual.mp4' }],
};

describe('Compositor compatibility surface', () => {
  it('returns a rejected promise when the removed composite path is invoked', async () => {
    const result = new Compositor().composite(validSpec, '/output.mp4');

    await expect(result).rejects.toThrow('Video compositing is no longer available');
  });
});
