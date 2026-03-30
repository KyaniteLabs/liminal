import { describe, it, expect } from 'vitest';
import { Exporter } from '../../../src/export/Exporter.js';

describe('Exporter.exportVideo', () => {
  it('exists as a method on Exporter', () => {
    const exporter = new Exporter();
    expect(typeof exporter.exportVideo).toBe('function');
  });

  it('rejects empty code', async () => {
    const exporter = new Exporter();
    await expect(exporter.exportVideo('', '/tmp/out.mp4', { domain: 'p5' }))
      .rejects.toThrow('Code is required');
  });

  it('rejects empty output path', async () => {
    const exporter = new Exporter();
    await expect(exporter.exportVideo('code', '', { domain: 'p5' }))
      .rejects.toThrow('Output path is required');
  });

  it('rejects missing domain', async () => {
    const exporter = new Exporter();
    await expect(exporter.exportVideo('code', '/tmp/out.mp4', {} as any))
      .rejects.toThrow('domain is required');
  });
});
