import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ── Hoisted mocks ──────────────────────────────────────────────────
const mockCreateRenderJob = vi.hoisted(() => vi.fn((config) => config));
const mockExecuteRenderJob = vi.hoisted(() =>
  vi.fn(async (job) => ({ duration: job?.duration ?? 5 }))
);

let shouldThrowOnImport = false;

vi.mock('@hyperframes/producer', () => {
  if (shouldThrowOnImport) {
    throw new Error('Cannot find module @hyperframes/producer');
  }
  return {
    createRenderJob: mockCreateRenderJob,
    executeRenderJob: mockExecuteRenderJob,
  };
});

// ── System under test ──────────────────────────────────────────────
import { HyperFramesRenderer } from '../../../src/render/HyperFramesRenderer.js';

describe('HyperFramesRenderer', () => {
  let renderer: HyperFramesRenderer;
  let tempDir: string;

  beforeEach(async () => {
    shouldThrowOnImport = false;
    mockCreateRenderJob.mockClear();
    mockExecuteRenderJob.mockClear();
    mockCreateRenderJob.mockImplementation((config) => config);
    mockExecuteRenderJob.mockImplementation(async (job) => ({ duration: job?.duration ?? 5 }));
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hfr-test-'));
    renderer = new HyperFramesRenderer({ tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('returns VideoRenderResult with correct outputPath, duration, and dimensions on success', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockExecuteRenderJob.mockResolvedValue({ duration: 7 });

    const result = await renderer.render('<html><body>scene</body></html>', outputPath, {
      fps: 60,
      width: 1280,
      height: 720,
      duration: 7,
    });

    expect(result.outputPath).toBe(outputPath);
    expect(result.duration).toBe(7);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.format).toBe('mp4');
  });

  it('throws with install instructions when @hyperframes/producer is missing', async () => {
    shouldThrowOnImport = true;
    vi.resetModules();

    vi.doMock('@hyperframes/producer', () => {
      throw new Error('Cannot find module @hyperframes/producer');
    });

    const { HyperFramesRenderer: FreshRenderer } = await import(
      '../../../src/render/HyperFramesRenderer.js'
    );
    const freshRenderer = new FreshRenderer({ tempDir });
    const outputPath = path.join(tempDir, 'out.mp4');

    await expect(freshRenderer.render('<html></html>', outputPath)).rejects.toThrow(
      'Install with: pnpm add @hyperframes/producer'
    );

    // Restore for remaining tests
    vi.resetModules();
    vi.doMock('@hyperframes/producer', () => ({
      createRenderJob: mockCreateRenderJob,
      executeRenderJob: mockExecuteRenderJob,
    }));
    await import('../../../src/render/HyperFramesRenderer.js');
  });

  it('writeComposition creates an HTML file in a temp dir', async () => {
    const html = '<html><body><h1>Hello</h1></body></html>';
    const compDir = await renderer.writeComposition(html);

    const indexFile = path.join(compDir, 'index.html');
    const contents = await fs.readFile(indexFile, 'utf-8');
    expect(contents).toBe(html);

    // Cleanup
    await fs.rm(compDir, { recursive: true, force: true });
  });

  it('cleanup removes the temp dir', async () => {
    const html = '<html></html>';
    const compDir = await renderer.writeComposition(html);

    await fs.access(compDir); // dir exists
    await renderer.cleanup(compDir);

    await expect(fs.access(compDir)).rejects.toThrow();
  });

  it('injects asset elements into HTML when opts.assets are provided', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');

    // Capture the HTML at render time — before cleanup deletes the temp dir
    let capturedHtml = '';
    mockExecuteRenderJob.mockImplementation(async (job) => {
      const inputPath = typeof job === 'object' && job !== null ? job.input : '';
      if (inputPath) {
        capturedHtml = await fs.readFile(inputPath, 'utf-8');
      }
      return { duration: 3 };
    });

    const assets = [
      { path: '/clips/intro.mp4', type: 'video' as const, startAt: 0, duration: 5 },
      { path: '/images/logo.png', type: 'image' as const, startAt: 2, duration: 3 },
      { path: '/audio/bgm.wav', type: 'audio' as const, startAt: 0, duration: 10 },
    ];

    await renderer.render('<html><body>scene</body></html>', outputPath, { assets, duration: 3 });

    // Video element with data attributes — paths converted to file:// URLs
    expect(capturedHtml).toContain('<video src="file:///clips/intro.mp4"');
    expect(capturedHtml).toContain('data-start="0"');
    expect(capturedHtml).toContain('data-duration="5"');
    expect(capturedHtml).toContain('data-track-index="0"');

    // Image element
    expect(capturedHtml).toContain('<img src="file:///images/logo.png"');
    expect(capturedHtml).toContain('data-track-index="1"');

    // Audio element
    expect(capturedHtml).toContain('<audio src="file:///audio/bgm.wav"');
    expect(capturedHtml).toContain('data-track-index="2"');

    // Injection container
    expect(capturedHtml).toContain('id="liminal-injected-assets"');
  });

  it('defaults fps to 30 and quality to standard', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockExecuteRenderJob.mockResolvedValue({ duration: 0 });

    await renderer.render('<html></html>', outputPath);

    const callConfig = mockCreateRenderJob.mock.calls[0][0] as {
      fps: number;
      quality: string;
    };
    expect(callConfig.fps).toBe(30);
    expect(callConfig.quality).toBe('standard');
  });
});
