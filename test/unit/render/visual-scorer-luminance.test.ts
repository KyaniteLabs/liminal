import { describe, it, expect, beforeAll } from 'vitest';
import { VisualScorer } from '../../../src/render/VisualScorer.js';

async function getSharp() {
  const mod = await import('sharp');
  return (mod.default ?? mod) as unknown as {
    (input: unknown, options?: unknown): {
      png(): { toBuffer(): Promise<Buffer> };
    };
  };
}

async function createSolidPng(r: number, g: number, b: number): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp({
    create: { width: 16, height: 16, channels: 4, background: { r, g, b, alpha: 255 } },
  }).png().toBuffer();
}

async function createVariedPng(): Promise<Buffer> {
  const sharp = await getSharp();
  const width = 16;
  const height = 16;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = x * 16;
      data[idx + 1] = y * 16;
      data[idx + 2] = (x + y) * 8;
      data[idx + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

describe('VisualScorer luminance verdict (F19/F12)', () => {
  let scorer: VisualScorer;

  beforeAll(() => {
    scorer = new VisualScorer();
  });

  it('flags near-white washout images', async () => {
    const png = await createSolidPng(250, 250, 245);
    const result = await scorer.score(png);
    expect(result.luminanceVerdict).toBe('washout');
    expect(result.warnings?.some(w => w.includes('washout'))).toBe(true);
    // Penalized score should be lower than the raw metric would produce
    expect(result.score).toBeLessThan(0.5);
  });

  it('flags too-dark images with no bright content', async () => {
    const png = await createSolidPng(5, 5, 8);
    const result = await scorer.score(png);
    expect(result.luminanceVerdict).toBe('too-dark');
    expect(result.warnings?.some(w => w.includes('too-dark'))).toBe(true);
  });

  it('returns ok for varied images with good contrast', async () => {
    const png = await createVariedPng();
    const result = await scorer.score(png);
    expect(result.luminanceVerdict).toBe('ok');
    // Good images should not be penalized
    expect(result.warnings?.some(w => w.includes('luminance verdict'))).toBeFalsy();
  });
});
