import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ── Hoisted mocks ──────────────────────────────────────────────────
const mockRevideoRender = vi.hoisted(() => vi.fn());
const mockHyperFramesRender = vi.hoisted(() => vi.fn());

// Use actual class syntax so `new` works in ESM
vi.mock('../../../src/render/RevideoRenderer.js', () => {
  return {
    RevideoRenderer: class {
      render = mockRevideoRender;
    },
  };
});

vi.mock('../../../src/render/HyperFramesRenderer.js', () => ({
  HyperFramesRenderer: class {
    render = mockHyperFramesRender;
  },
}));

// ── System under test ──────────────────────────────────────────────
import { VideoPipeline, type PipelineStep } from '../../../src/render/VideoPipeline.js';

describe('VideoPipeline', () => {
  let tempDir: string;

  beforeEach(async () => {
    mockRevideoRender.mockReset();
    mockHyperFramesRender.mockReset();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('executes a single Revideo step', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockRevideoRender.mockResolvedValue({
      outputPath,
      duration: 5,
      width: 1920,
      height: 1080,
      format: 'mp4',
    });

    const steps: PipelineStep[] = [
      { type: 'revideo', code: 'makeScene2D(...)' },
    ];

    const result = await new VideoPipeline().execute(steps, outputPath);

    expect(mockRevideoRender).toHaveBeenCalledTimes(1);
    expect(result.outputPath).toBe(outputPath);
    expect(result.format).toBe('mp4');
  });

  it('executes a single HyperFrames step', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockHyperFramesRender.mockResolvedValue({
      outputPath,
      duration: 5,
      width: 1920,
      height: 1080,
      format: 'mp4',
    });

    const steps: PipelineStep[] = [
      { type: 'hyperframes', code: '<html>...</html>' },
    ];

    const result = await new VideoPipeline().execute(steps, outputPath);

    expect(mockHyperFramesRender).toHaveBeenCalledTimes(1);
    expect(result.outputPath).toBe(outputPath);
  });

  it('chains Revideo output as HyperFrames asset', async () => {
    const outputPath = path.join(tempDir, 'final.mp4');
    const revideoOutput = '/tmp/liminal-pipeline-revideo-0.mp4';

    mockRevideoRender.mockResolvedValue({
      outputPath: revideoOutput,
      duration: 5,
      width: 1920,
      height: 1080,
      format: 'mp4',
    });
    mockHyperFramesRender.mockResolvedValue({
      outputPath,
      duration: 5,
      width: 1920,
      height: 1080,
      format: 'mp4',
    });

    const steps: PipelineStep[] = [
      { type: 'revideo', code: 'makeScene2D(...)' },
      { type: 'hyperframes', code: '<html><body>overlay</body></html>' },
    ];

    const result = await new VideoPipeline().execute(steps, outputPath);

    expect(mockRevideoRender).toHaveBeenCalledTimes(1);
    expect(mockHyperFramesRender).toHaveBeenCalledTimes(1);

    // HyperFrames should receive Revideo output as an asset
    const hyperCall = mockHyperFramesRender.mock.calls[0];
    const hyperOpts = hyperCall[2] as { assets?: Array<{ path: string; type: string }> };
    expect(hyperOpts.assets).toBeDefined();
    expect(hyperOpts.assets?.[0]?.path).toBe(revideoOutput);
    expect(hyperOpts.assets?.[0]?.type).toBe('video');

    expect(result.outputPath).toBe(outputPath);
  });

  it('throws on empty steps array', async () => {
    const pipeline = new VideoPipeline();
    await expect(pipeline.execute([], '/dev/null/out.mp4')).rejects.toThrow(
      'at least one step'
    );
  });

  it('throws on unknown step type', async () => {
    const steps = [{ type: 'unknown', code: '' }] as unknown as PipelineStep[];
    const pipeline = new VideoPipeline();

    await expect(pipeline.execute(steps, '/dev/null/out.mp4')).rejects.toThrow(
      'Unknown pipeline step type'
    );
  });

  it('merges base options with step options', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockHyperFramesRender.mockResolvedValue({
      outputPath,
      duration: 5,
      width: 1920,
      height: 1080,
      format: 'mp4',
    });

    const steps: PipelineStep[] = [
      { type: 'hyperframes', code: '<html></html>', options: { fps: 60 } },
    ];

    await new VideoPipeline().execute(steps, outputPath, { width: 1280, height: 720 });

    const callOpts = mockHyperFramesRender.mock.calls[0][2] as Record<string, unknown>;
    expect(callOpts.fps).toBe(60);
    expect(callOpts.width).toBe(1280);
    expect(callOpts.height).toBe(720);
  });

  it('does not pass assets to HyperFrames when previous step is not Revideo', async () => {
    const outputPath = path.join(tempDir, 'out.mp4');
    mockHyperFramesRender.mockResolvedValue({
      outputPath,
      duration: 3,
      width: 1920,
      height: 1080,
      format: 'mp4',
    });

    const steps: PipelineStep[] = [
      { type: 'hyperframes', code: '<html>first</html>' },
      { type: 'hyperframes', code: '<html>second</html>' },
    ];

    await new VideoPipeline().execute(steps, outputPath);

    // Second HyperFrames call should NOT have assets
    const secondCall = mockHyperFramesRender.mock.calls[1];
    const secondOpts = secondCall[2] as { assets?: unknown[] };
    expect(secondOpts.assets).toBeUndefined();
  });
});
